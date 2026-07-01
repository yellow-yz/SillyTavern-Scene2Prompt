/**
 * Scene2Prompt v2.0 Community Edition — Entry Point
 *
 * 将聊天上下文发送给 LLM 增强为 Danbooru 标签，再交给 ComfyUI 生成更精准的画面。
 * 支持 DeepSeek / OpenAI / OpenRouter / Ollama / 自定义 Provider。
 */

import {
    eventSource,
    event_types,
    saveSettingsDebounced,
    getRequestHeaders
} from '../../../../script.js';
import {
    extension_settings,
    getContext,
    renderExtensionTemplateAsync
} from '../../../extensions.js';

// ═══════════════════════════════════════════════════════════
// Module-level state (populated during init)
// ═══════════════════════════════════════════════════════════

const MODULE_NAME = 'scene2prompt';
let engine = null;           // S2PEngine instance
let providerRegistry = null; // ProviderRegistry instance
let presetManager = null;    // PresetManager instance

let lastPrompt = '';
let lastNegative = '';

// ═══════════════════════════════════════════════════════════
// Default settings
// ═══════════════════════════════════════════════════════════

const DEFAULT_SETTINGS = {
    // Core
    enabled: true,
    provider: 'deepseek',
    secondaryProvider: '',

    // Provider configs (per-provider credentials)
    providerConfigs: {
        deepseek: { model: 'deepseek-chat', temperature: 0.7, maxTokens: 2048 },
        openai: { model: 'gpt-4o-mini', temperature: 0.7, maxTokens: 2048 },
        openrouter: { model: 'anthropic/claude-sonnet-4-20250514', temperature: 0.7, maxTokens: 2048 },
        ollama: { baseUrl: 'http://127.0.0.1:11434', model: 'qwen2.5:7b', temperature: 0.7, maxTokens: 2048 },
        custom: { url: '', apiKey: '', model: '', temperature: 0.7, maxTokens: 2048 },
    },

    // Image generation
    style: 'WAI',
    intensity: '自动',          // 自动 / 显式 / 软色情 / 无
    contextMessages: 12,       // 2-30
    pov: false,                // POV 手动强制
    preprocess: true,          // 过滤对话/心理描写

    // Appearance
    userAppearance: '',
    appearanceCache: {},       // { charName: "tag1, tag2, ..." }
    appearanceSeed: -1,

    // Presets
    presets: {
        custom: [],            // User-created presets
        activePresetId: 'manhwa_specialized',
    },

    // Advanced
    logLevel: 'info',         // debug / info / error / silent
    systemPromptOverride: '',  // Empty = use built-in
    providerTimeout: 60,       // seconds
    maxRetries: 3,

    // Migration marker
    _migrated: 2,
};

// ═══════════════════════════════════════════════════════════
// Settings accessor
// ═══════════════════════════════════════════════════════════

/**
 * Returns the S2P settings object, initializing defaults if needed.
 * Provides backward compatibility with v4 settings.
 */
function getSettings() {
    if (!extension_settings[MODULE_NAME]) {
        extension_settings[MODULE_NAME] = {};
    }
    const s = extension_settings[MODULE_NAME];

    // Initialize missing defaults
    for (const [key, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
        if (s[key] === undefined) {
            s[key] = defaultValue;
        }
    }

    // Ensure nested objects exist
    if (!s.providerConfigs || typeof s.providerConfigs !== 'object') {
        s.providerConfigs = DEFAULT_SETTINGS.providerConfigs;
    }
    if (!s.appearanceCache || typeof s.appearanceCache !== 'object') {
        s.appearanceCache = {};
    }
    if (!s.presets || typeof s.presets !== 'object') {
        s.presets = DEFAULT_SETTINGS.presets;
    }
    if (!s.presets.custom || !Array.isArray(s.presets.custom)) {
        s.presets.custom = [];
    }

    // Migrate v4 settings if needed
    migrateV4Settings(s);

    return s;
}

/**
 * Migrate from v4 (single DeepSeek) to v2.0 (multi-provider) settings format.
 */
function migrateV4Settings(s) {
    if (s._migrated >= 2) return;

    // v4: deepseek_key -> providerConfigs.deepseek.apiKey
    if (s.deepseek_key && !s.providerConfigs.deepseek.apiKey) {
        s.providerConfigs.deepseek.apiKey = s.deepseek_key;
    }
    // v4: deepseek_model -> providerConfigs.deepseek.model (if not default)
    if (s.deepseek_model && s.providerConfigs.deepseek.model === 'deepseek-chat') {
        s.providerConfigs.deepseek.model = s.deepseek_model;
    }
    // v4: user_appearance -> userAppearance (camelCase)
    if (s.user_appearance && !s.userAppearance) {
        s.userAppearance = s.user_appearance;
    }
    // v4: appearance_cache -> appearanceCache
    if (s.appearance_cache && Object.keys(s.appearance_cache).length > 0) {
        s.appearanceCache = { ...s.appearanceCache, ...s.appearance_cache };
    }

    s._migrated = 2;
    saveSettingsDebounced();
}

// ═══════════════════════════════════════════════════════════
// Logging
// ═══════════════════════════════════════════════════════════

const LOG_LEVELS = { debug: 0, info: 1, error: 2, silent: 3 };

function log(msg, level = 'info') {
    const s = getSettings();
    const currentLevel = LOG_LEVELS[s.logLevel] ?? LOG_LEVELS.info;
    const msgLevel = LOG_LEVELS[level] ?? LOG_LEVELS.info;

    if (msgLevel >= currentLevel) {
        const prefix = `[S2P]`;
        if (level === 'error') {
            console.error(prefix, msg);
        } else {
            console.log(prefix, msg);
        }
    }

    // Always update DOM log (if visible)
    const el = document.getElementById('s2p_log');
    if (el && msgLevel >= currentLevel) {
        const time = new Date().toLocaleTimeString();
        const tag = level === 'error' ? 'ERR' : level === 'debug' ? 'DBG' : 'INF';
        el.value = `[${time}] [${tag}] ${msg}\n` + el.value;
    }
}

// ═══════════════════════════════════════════════════════════
// "画面" Button Injection
// ═══════════════════════════════════════════════════════════

function injectGenButton() {
    const tryInject = () => {
        const sendArea = document.getElementById('send_but');
        if (!sendArea) { setTimeout(tryInject, 1000); return; }
        if (document.getElementById('s2p_gen_btn')) return;

        const btn = document.createElement('button');
        btn.id = 's2p_gen_btn';
        btn.textContent = '画面';
        btn.title = '一键生图 (/sd raw_last)';
        btn.style.cssText =
            'margin:0 4px;padding:4px 10px;font-size:13px;cursor:pointer;' +
            'border-radius:4px;border:1px solid #ddaa66;background:#2a1a0a;' +
            'color:#ddaa66;white-space:nowrap';
        btn.addEventListener('click', () => {
            const textarea = document.getElementById('send_textarea');
            if (!textarea) return;
            textarea.value = '/sd raw_last';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            sendArea.click();
        });

        const statusEl = document.createElement('span');
        statusEl.id = 's2p_status';
        statusEl.style.cssText = 'margin:0 4px;font-size:11px;color:#ddaa66;white-space:nowrap';

        sendArea.parentNode.insertBefore(btn, sendArea.nextSibling);
        sendArea.parentNode.insertBefore(statusEl, btn.nextSibling);
    };
    tryInject();
}

// ═══════════════════════════════════════════════════════════
// Settings UI
// ═══════════════════════════════════════════════════════════

async function initUI() {
    try {
        const html = await renderExtensionTemplateAsync(
            'third-party/scene2prompt',
            'settings'
        );
        const container = document.getElementById('extensions_settings');
        if (!container) {
            setTimeout(initUI, 500);
            return;
        }
        container.insertAdjacentHTML('beforeend', html);
        bindSettingsEvents();

        // Restore last prompt previews
        if (lastPrompt) {
            setTimeout(() => {
                const pb = document.getElementById('s2p_preview');
                if (pb) pb.value = lastPrompt;
                const nb = document.getElementById('s2p_neg_preview');
                if (nb && lastNegative) nb.value = lastNegative;
            }, 200);
        }

        log('设置面板已加载', 'info');
    } catch (e) {
        log('设置面板加载失败: ' + e.message, 'error');
    }
}

function bindSettingsEvents() {
    const s = getSettings();

    // Helper: bind element event to settings field
    const bind = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    };

    // Tab switching
    document.querySelectorAll('.s2p-tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            // Deactivate all
            document.querySelectorAll('.s2p-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.s2p-tab-content').forEach(c => c.classList.remove('active'));
            // Activate selected
            this.classList.add('active');
            const content = document.getElementById('s2p_tab_' + tab);
            if (content) content.classList.add('active');
        });
    });

    // Provider switching → show/hide config fields
    bind('s2p_provider', 'change', function() {
        s.provider = this.value;
        saveSettingsDebounced();
        updateProviderUI();
    });
    bind('s2p_secondary_provider', 'change', function() {
        s.secondaryProvider = this.value;
        saveSettingsDebounced();
        updateProviderUI();
    });

    // Enable toggle
    bind('s2p_on', 'change', function() {
        s.enabled = !!this.checked;
        saveSettingsDebounced();
    });

    // Provider config fields
    const providerFields = ['apiKey', 'model', 'baseUrl', 'url', 'temperature', 'maxTokens'];
    for (const provider of ['deepseek', 'openai', 'openrouter', 'ollama', 'custom']) {
        for (const field of providerFields) {
            bind(`s2p_${provider}_${field}`, 'input', function() {
                if (!s.providerConfigs[provider]) s.providerConfigs[provider] = {};
                const val = field === 'temperature' || field === 'maxTokens'
                    ? parseFloat(this.value) || 0
                    : this.value.trim();
                s.providerConfigs[provider][field] = val;
                saveSettingsDebounced();
            });
        }
    }

    // Image settings
    bind('s2p_style', 'change', function() { s.style = this.value; saveSettingsDebounced(); });
    bind('s2p_intensity', 'change', function() { s.intensity = this.value; saveSettingsDebounced(); });
    bind('s2p_ctx', 'input', function() { s.contextMessages = parseInt(this.value) || 12; saveSettingsDebounced(); });
    bind('s2p_pov', 'change', function() { s.pov = !!this.checked; saveSettingsDebounced(); });
    bind('s2p_pre', 'change', function() { s.preprocess = !!this.checked; saveSettingsDebounced(); });

    // Appearance
    bind('s2p_extract', 'click', () => {
        if (engine) engine.extractAppearance();
    });
    bind('s2p_cache', 'input', function() {
        const ctx = getContext();
        const name = ctx?.name2 || '未知角色';
        s.appearanceCache[name] = this.value.trim();
        saveSettingsDebounced();
    });
    bind('s2p_user_appearance', 'input', function() {
        s.userAppearance = this.value.trim();
        saveSettingsDebounced();
    });

    // Presets
    bind('s2p_preset_select', 'change', function() {
        if (presetManager) presetManager.apply(this.value);
        updatePresetUI();
    });
    bind('s2p_preset_save', 'click', () => {
        if (!presetManager) return;
        const name = prompt('请输入预设名称：');
        if (name) {
            presetManager.save(name);
            updatePresetUI();
            log('预设已保存: ' + name, 'info');
        }
    });
    bind('s2p_preset_delete', 'click', () => {
        if (!presetManager) return;
        const id = document.getElementById('s2p_preset_select')?.value;
        if (!id) return;
        const preset = presetManager.get(id);
        if (!preset) return;
        if (preset.builtIn) {
            alert('内置预设不可删除');
            return;
        }
        if (confirm(`确定删除预设「${preset.name}」？`)) {
            presetManager.delete(id);
            updatePresetUI();
            log('预设已删除: ' + preset.name, 'info');
        }
    });
    bind('s2p_preset_export', 'click', () => {
        if (!presetManager) return;
        const id = document.getElementById('s2p_preset_select')?.value;
        if (!id) return;
        const json = presetManager.export(id);
        if (json) {
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `s2p_preset_${id}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
    });
    bind('s2p_preset_import', 'click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                presetManager.import(text);
                updatePresetUI();
                updateSettingsUI();
                log('预设已导入: ' + file.name, 'info');
            } catch (err) {
                log('预设导入失败: ' + err.message, 'error');
            }
        };
        input.click();
    });
    bind('s2p_preset_restore', 'click', () => {
        if (confirm('确定恢复所有内置预设？自定义预设不会被删除。')) {
            if (presetManager) presetManager.restoreBuiltIns();
            updatePresetUI();
            log('内置预设已恢复', 'info');
        }
    });

    // Advanced
    bind('s2p_log_level', 'change', function() { s.logLevel = this.value; saveSettingsDebounced(); });
    bind('s2p_timeout', 'input', function() { s.providerTimeout = parseInt(this.value) || 60; saveSettingsDebounced(); });
    bind('s2p_max_retries', 'input', function() { s.maxRetries = parseInt(this.value) || 3; saveSettingsDebounced(); });
    bind('s2p_system_prompt_override', 'input', function() {
        s.systemPromptOverride = this.value.trim();
        saveSettingsDebounced();
    });
    bind('s2p_clear_log', 'click', () => {
        const el = document.getElementById('s2p_log');
        if (el) el.value = '';
    });

    // Test connection
    bind('s2p_test_connection', 'click', async () => {
        await testConnection();
    });

    // Listen for preset change events from presets.js
    window.addEventListener('s2p_preset_changed', () => {
        updateSettingsUI();
        updateProviderUI();
        updatePresetUI();
    });

    // Initialize UI state
    updateSettingsUI();
    updateProviderUI();
    updatePresetUI();
}

/**
 * Update all settings UI elements from current settings.
 */
function updateSettingsUI() {
    const s = getSettings();

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };

    setCheck('s2p_on', s.enabled);
    setVal('s2p_provider', s.provider);
    setVal('s2p_secondary_provider', s.secondaryProvider || '');
    setVal('s2p_style', s.style);
    setVal('s2p_intensity', s.intensity);
    setVal('s2p_ctx', s.contextMessages);
    setCheck('s2p_pov', s.pov);
    setCheck('s2p_pre', s.preprocess);

    // Provider-specific fields
    for (const provider of ['deepseek', 'openai', 'openrouter', 'ollama', 'custom']) {
        const config = s.providerConfigs[provider] || {};
        setVal(`s2p_${provider}_apiKey`, config.apiKey || '');
        setVal(`s2p_${provider}_model`, config.model || '');
        if (provider === 'ollama') setVal('s2p_ollama_baseUrl', config.baseUrl || '');
        if (provider === 'custom') setVal('s2p_custom_url', config.url || '');
        setVal(`s2p_${provider}_temperature`, config.temperature ?? 0.7);
        setVal(`s2p_${provider}_maxTokens`, config.maxTokens ?? 2048);
    }

    // Appearance
    const ctx = getContext();
    const charName = ctx?.name2 || '';
    setVal('s2p_cache', s.appearanceCache[charName] || '');
    setVal('s2p_user_appearance', s.userAppearance);

    // Advanced
    setVal('s2p_log_level', s.logLevel);
    setVal('s2p_timeout', s.providerTimeout);
    setVal('s2p_max_retries', s.maxRetries);
    setVal('s2p_system_prompt_override', s.systemPromptOverride);
}

/**
 * Show/hide provider config fields based on selected providers.
 */
function updateProviderUI() {
    const s = getSettings();

    // Hide all provider fields
    document.querySelectorAll('.s2p-provider-fields').forEach(el => el.classList.remove('active'));

    // Show primary provider fields
    const primaryId = `s2p_provider_fields_${s.provider}`;
    const primaryEl = document.getElementById(primaryId);
    if (primaryEl) primaryEl.classList.add('active');

    // Show secondary provider fields
    const secondaryId = `s2p_provider_fields_${s.secondaryProvider}`;
    const secondaryEl = document.getElementById(secondaryId);
    if (secondaryEl) secondaryEl.classList.add('active');

    // Update fallback chain text
    const chainEl = document.getElementById('s2p_fallback_chain');
    if (chainEl) {
        const primaryLabel = document.querySelector(`#s2p_provider option[value="${s.provider}"]`)?.textContent || s.provider;
        const secondaryLabel = s.secondaryProvider
            ? document.querySelector(`#s2p_secondary_provider option[value="${s.secondaryProvider}"]`)?.textContent || s.secondaryProvider
            : null;
        chainEl.textContent = secondaryLabel
            ? `${primaryLabel} → ${secondaryLabel} → 关键词回退`
            : `${primaryLabel} → 关键词回退`;
    }
}

/**
 * Update preset dropdown from PresetManager.
 */
function updatePresetUI() {
    const sel = document.getElementById('s2p_preset_select');
    if (!sel || !presetManager) return;

    const s = getSettings();
    const presets = presetManager.getAll();

    sel.innerHTML = '';
    for (const p of presets) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.builtIn ? `${p.name} [内置]` : p.name;
        if (p.id === s.presets.activePresetId) opt.selected = true;
        sel.appendChild(opt);
    }

    // Show active preset details
    const active = presetManager.get(s.presets.activePresetId);
    const detailsEl = document.getElementById('s2p_preset_details');
    if (detailsEl && active) {
        detailsEl.textContent = active.description || '';
    }
}

/**
 * Test the configured LLM provider connection.
 */
async function testConnection() {
    const btn = document.getElementById('s2p_test_connection');
    if (btn) { btn.disabled = true; btn.textContent = '测试中...'; }

    const statusEl = document.getElementById('s2p_connection_status');
    if (statusEl) { statusEl.textContent = '测试中...'; statusEl.className = 's2p-status'; }

    try {
        // Test message: a simple request to validate API key and endpoint
        const testMsg = [{ role: 'user', content: 'Reply with just: OK' }];

        if (!providerRegistry) {
            throw new Error('Provider 系统尚未初始化');
        }

        const s = getSettings();
        const primaryId = s.provider;
        const provider = providerRegistry.get(primaryId);

        if (!provider) throw new Error(`未找到 Provider: ${primaryId}`);
        if (!provider.isConfigured(s)) throw new Error(`${provider.name} 未配置（请填写 API Key）`);

        const startTime = Date.now();
        const raw = await provider.call('', 'Reply with just: OK', s);
        const elapsed = Date.now() - startTime;

        if (raw && raw.length > 0) {
            if (statusEl) { statusEl.textContent = `连接成功 (${elapsed}ms)`; statusEl.className = 's2p-status s2p-status-ok'; }
            log(`Provider ${provider.name} 连接成功 (${elapsed}ms)`, 'info');
        } else {
            throw new Error('返回内容为空');
        }
    } catch (e) {
        if (statusEl) { statusEl.textContent = `连接失败: ${e.message}`; statusEl.className = 's2p-status s2p-status-err'; }
        log(`连接测试失败: ${e.message}`, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '测试连接'; }
    }
}

// ═══════════════════════════════════════════════════════════
// Core event handler (delegates to engine when available)
// ═══════════════════════════════════════════════════════════

async function onPromptProcessing(eventData) {
    const s = getSettings();
    if (!s.enabled) return;

    // If engine not loaded yet, skip (should only happen briefly during init)
    if (!engine) {
        log('引擎尚未初始化，跳过生图事件', 'debug');
        return;
    }

    const statusEls = ['s2p_status', 's2p_panel_status'];
    const setStatus = (text) => {
        statusEls.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        });
    };

    log('生图事件触发 | 模式: ' + (eventData.generationType || '?'), 'debug');

    try {
        setStatus('生成中...');
        const result = await engine.process(eventData);

        if (!result || !result.prompt) {
            setStatus('提示词生成失败');
            return;
        }

        // Store for preview
        lastPrompt = result.prompt;
        lastNegative = result.negative || '';

        // Update preview textareas
        const previewBox = document.getElementById('s2p_preview');
        if (previewBox) { previewBox.value = result.prompt; previewBox.style.display = ''; }
        const negBox = document.getElementById('s2p_neg_preview');
        if (negBox && result.negative) { negBox.value = result.negative; negBox.style.display = ''; }

        setStatus('已发送 (' + result.method + ')');
        setTimeout(() => setStatus(''), 15000);

    } catch (e) {
        log('生图事件处理错误: ' + e.message, 'error');
        setStatus('错误: ' + e.message);
    }
}

// ═══════════════════════════════════════════════════════════
// Preset LoRA / ComfyUI placeholder initialization
// ═══════════════════════════════════════════════════════════

function presetLoRAPlaceholders() {
    if (!extension_settings.sd) return;
    if (!extension_settings.sd.comfy_placeholders) {
        extension_settings.sd.comfy_placeholders = [];
    }
    // Reserved for future LoRA placeholder registration
    saveSettingsDebounced();
}

// ═══════════════════════════════════════════════════════════
// Public exports
// ═══════════════════════════════════════════════════════════

export { MODULE_NAME, log, getSettings };

// ═══════════════════════════════════════════════════════════
// Initialization (called by ST via hooks.activate)
// ═══════════════════════════════════════════════════════════

export async function init() {
    // 1. Initialize settings
    const s = getSettings();
    log('v2.0 社区版启动中...', 'info');

    // 2. Lazy-load engine and presets modules
    //    (providers, engine, presets will be imported dynamically
    //     once they exist — for P1 this is stubbed)
    try {
        // Dynamic imports for modules that may not exist yet during P1 development
        const providersMod = await import('./providers.js');
        providerRegistry = new providersMod.ProviderRegistry(log);

        const presetsMod = await import('./presets.js');
        presetManager = new presetsMod.PresetManager(MODULE_NAME);

        const engineMod = await import('./engine.js');
        engine = new engineMod.S2PEngine(providerRegistry, presetManager, log, getSettings);

        log('所有模块已加载', 'info');
    } catch (e) {
        log('模块加载失败: ' + e.message, 'error');
        // Continue without engine — settings panel will still work
    }

    // 3. Register event handler
    eventSource.on(event_types.SD_PROMPT_PROCESSING, onPromptProcessing);

    // 4. Initialize UI
    await initUI();

    // 5. Inject "画面" button
    injectGenButton();

    // 6. Preset placeholders
    presetLoRAPlaceholders();

    log('v2.0 社区版已启动 — 多 LLM + ComfyUI 对接', 'info');
}
