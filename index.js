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
import { Popup, POPUP_TYPE } from '../../../popup.js';

// ═══════════════════════════════════════════════════════════
// Module-level state (populated during init)
// ═══════════════════════════════════════════════════════════

const MODULE_NAME = 'scene2prompt';
let engine = null;           // S2PEngine instance
let providerRegistry = null; // ProviderRegistry instance
let presetManager = null;    // PresetManager instance
let modelProfileManager = null; // ModelProfileManager instance

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

    // Diagnostic
    diagnosticMode: 'off',    // 'always' | 'off'

    // Advanced
    logLevel: 'info',         // debug / info / error / silent
    systemPromptOverride: '',  // Empty = use built-in
    providerTimeout: 60,       // seconds
    maxRetries: 3,

    // Migration marker (NOT set by default — migration runs on first init)
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

        sendArea.parentNode.insertBefore(btn, sendArea.nextSibling);
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
        if (!presetManager) return;
        const preset = presetManager.get(this.value);
        presetManager.apply(this.value);
        updatePresetUI();
        if (preset) {
            log('已切换预设: ' + preset.name + ' → Provider:' + (preset.config.provider||'?') + ' 风格:' + (preset.config.style||'?') + ' 内容:' + (preset.config.intensity||'?'), 'info');
            if (typeof toastr !== 'undefined') toastr.info('预设: ' + preset.name, 'Scene2Prompt');
        }
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

    // Model Profile
    bind('s2p_model_profile', 'change', function() {
        const s = getSettings();
        if (!s.modelProfiles) s.modelProfiles = {};

        // Check if this is a detected model filename or a profile ID
        const isFilename = /\.(safetensors|ckpt|pt)$/i.test(this.value);
        let profileId = this.value;
        let profile;

        if (isFilename) {
            // Try to match to built-in profile
            const matchedId = matchModelProfile(this.value);
            profileId = matchedId || this.value;
            s.modelProfiles.activeProfileId = profileId;
            profile = matchedId ? modelProfileManager.get(profileId) : null;
        } else {
            s.modelProfiles.activeProfileId = this.value;
            profile = modelProfileManager.get(this.value);
        }

        // Sync style
        const styleMap = { wai_illustrious_v140:'WAI', animagine_xl_v31:'Animagine', noobai_xl_v10:'Animagine', pony_diffusion_v6:'Animagine', illustrious_xl_v10:'Animagine', hassaku_xl_v10:'Animagine', sdxl_base_10:'写实' };
        if (styleMap[profileId]) s.style = styleMap[profileId];

        saveSettingsDebounced();
        updateModelProfileUI();
        updateSettingsUI();
        applyModelParamsToST();

        if (profile) {
            log('已切换模型: ' + profile.name + ' (' + profile.baseModel + ' · ' + profile.promptFormat + ') Steps:' + profile.recommendedSteps + ' CFG:' + profile.recommendedCfg, 'info');
        } else if (isFilename) {
            log('已切换模型: ' + this.value + ' (通用SDXL配置)', 'info');
        }
    });
    bind('s2p_profile_save', 'click', () => {
        if (!modelProfileManager) return;
        const name = prompt('模型配置名称：');
        if (name) { modelProfileManager.save(name); updateModelProfileUI(); log('模型配置已保存: ' + name, 'info'); }
    });
    bind('s2p_refresh_models', 'click', () => refreshModelList());
    bind('s2p_apply_to_st', 'click', () => applyModelParamsToST());

    bind('s2p_profile_delete', 'click', () => {
        if (!modelProfileManager) return;
        const id = getSettings().modelProfiles?.activeProfileId;
        if (!id) return;
        const p = modelProfileManager.get(id);
        if (!p) return;
        if (p.builtIn) { alert('内置模型配置不可删除'); return; }
        if (confirm(`确定删除「${p.name}」？`)) { modelProfileManager.delete(id); updateModelProfileUI(); }
    });
    bind('s2p_profile_export', 'click', () => {
        if (!modelProfileManager) return;
        const id = getSettings().modelProfiles?.activeProfileId;
        if (!id) return;
        const json = modelProfileManager.export(id);
        if (json) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], {type:'application/json'})); a.download = 's2p_profile_' + id + '.json'; a.click(); }
    });
    bind('s2p_profile_import', 'click', () => {
        const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
        input.onchange = async (e) => {
            const f = e.target.files[0]; if (!f) return;
            try { modelProfileManager.import(await f.text()); updateModelProfileUI(); log('模型配置已导入', 'info'); }
            catch (err) { log('导入失败: ' + err.message, 'error'); }
        };
        input.click();
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

    // Diagnostic mode
    bind('s2p_diag_off', 'change', function() { if (this.checked) { s.diagnosticMode = 'off'; saveSettingsDebounced(); } });
    bind('s2p_diag_always', 'change', function() { if (this.checked) { s.diagnosticMode = 'always'; saveSettingsDebounced(); } });

    // Batch appearance extraction
    bind('s2p_batch_extract', 'click', () => batchExtractAppearance());
    bind('s2p_clear_cache', 'click', () => {
        if (confirm('确定清空所有角色外貌缓存？')) {
            s.appearanceCache = {};
            saveSettingsDebounced();
            updateCacheListUI();
            log('外貌缓存已全部清空', 'info');
        }
    });

    // Cache list button delegation (avoids inline onclick JS injection risk)
    const cacheList = document.getElementById('s2p_cache_list');
    if (cacheList) {
        cacheList.addEventListener('click', function(e) {
            const row = e.target.closest('.s2p-preset-item');
            if (!row) return;
            const name = row.dataset.cacheName;
            if (!name) return;

            if (e.target.classList.contains('s2p-cache-del')) {
                delete s.appearanceCache[name];
                saveSettingsDebounced();
                updateCacheListUI();
                log('已删除外貌缓存: ' + name, 'info');
            } else if (e.target.classList.contains('s2p-cache-extract')) {
                if (!engine) return;
                const ctx = getContext();
                const char = Object.values(ctx.characters || {}).find(c => c.name === name);
                if (char) {
                    engine.extractAppearance(name, char.description);
                    updateSettingsUI();
                    updateCacheListUI();
                }
            }
        });
    }

    // Test connection
    bind('s2p_test_connection', 'click', async () => {
        await testConnection();
    });

    // Listen for preset change events from presets.js
    window.addEventListener('s2p_preset_changed', () => {
        updateSettingsUI();
        updateProviderUI();
        updatePresetUI();
        updateModelProfileUI();
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

    // Diagnostic
    setCheck('s2p_diag_off', s.diagnosticMode === 'off');
    setCheck('s2p_diag_always', s.diagnosticMode === 'always');

    // Cache list
    setTimeout(updateCacheListUI, 200);

    // Model profile
    setTimeout(updateModelProfileUI, 100);
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
 * Update model profile dropdown and info display.
 */
function updateModelProfileUI() {
    const sel = document.getElementById('s2p_model_profile');
    if (!sel || !modelProfileManager) return;

    const s = getSettings();
    if (!s.modelProfiles) s.modelProfiles = { activeProfileId: 'noobai_xl_v10' };
    const activeId = s.modelProfiles.activeProfileId;

    sel.innerHTML = '';

    // If we have detected models from ComfyUI, show them prefixed with "我的:"
    const detectedModels = s.detectedModels || [];
    if (detectedModels.length > 0) {
        // Group: built-in profiles that match detected models
        const matched = new Set();
        for (const filename of detectedModels) {
            const pid = matchModelProfile(filename);
            if (pid) matched.add(pid);
        }

        // Show detected model filenames as options
        sel.appendChild(new Option('── 我的模型 ──', '', true, true));
        for (const filename of detectedModels) {
            const pid = matchModelProfile(filename);
            const profile = pid ? modelProfileManager.get(pid) : null;
            const label = profile ? `${filename} → ${profile.name}` : filename + ' (通用SDXL)';
            const opt = new Option(label, filename);
            if (filename === activeId) opt.selected = true;
            sel.appendChild(opt);
        }

        sel.appendChild(new Option('── 内置配置 ──', '', true, true));
        const profiles = modelProfileManager.getAll();
        for (const p of profiles) {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.builtIn ? `${p.name} [内置]` : p.name;
            if (p.id === activeId && !detectedModels.includes(activeId)) opt.selected = true;
            sel.appendChild(opt);
        }
    } else {
        // Fallback: show built-in profiles only
        const profiles = modelProfileManager.getAll();
        for (const p of profiles) {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.builtIn ? `${p.name} [内置]` : p.name;
            if (p.id === activeId) opt.selected = true;
            sel.appendChild(opt);
        }
    }

    const profile = modelProfileManager.get(activeId);
    if (!profile) return;

    // Info line
    const fmt = profile.promptFormat === 'danbooru' ? 'Danbooru标签' : profile.promptFormat === 'natural' ? '自然语言' : '混合';
    const infoEl = document.getElementById('s2p_model_profile_info');
    if (infoEl) {
        const vPredNote = profile.vPred ? ' ⚡v-pred' : '';
        infoEl.textContent = `${profile.baseModel}${vPredNote} · ${fmt} · ${profile.recommendedSize.width}×${profile.recommendedSize.height} · Steps:${profile.recommendedSteps} CFG:${profile.recommendedCfg} · 采样器:${profile.recommendedSampler} · ${profile.description}`;
    }

    // Warning
    const warnEl = document.getElementById('s2p_model_profile_warning');
    if (warnEl) {
        if (profile.warning) {
            warnEl.textContent = '⚠️ ' + profile.warning;
            warnEl.style.display = 'block';
        } else {
            warnEl.style.display = 'none';
        }
    }
}

// ═══════════════════════════════════════════════════════════
// Apply model params to SillyTavern's SD extension
// ═══════════════════════════════════════════════════════════

function applyModelParamsToST() {
    if (!modelProfileManager || !extension_settings.sd) return;
    const s = getSettings();
    const activeId = s.modelProfiles?.activeProfileId;

    // Check if it's a detected filename
    const isFilename = /\.(safetensors|ckpt|pt)$/i.test(activeId || '');
    let profile = modelProfileManager.getActive();
    const sd = extension_settings.sd;

    // Determine workflow and params
    let workflow, steps, cfg, sampler, scheduler, width, height;
    if (profile && !isFilename) {
        // Known profile
        workflow = profile.workflowFile || (profile.vPred ? 'S2P_SDXL_vpred.json' : 'S2P_SDXL_eps.json');
        steps = profile.recommendedSteps;
        cfg = profile.recommendedCfg;
        sampler = profile.recommendedSampler;
        scheduler = profile.recommendedScheduler || 'normal';
        width = profile.recommendedSize?.width || 1024;
        height = profile.recommendedSize?.height || 1024;
    } else if (isFilename) {
        // Detected model — auto-detect type
        const fn = (activeId || '').toLowerCase();
        if (/noobai|vpred|v_pred|v-pred/i.test(fn)) {
            workflow = 'S2P_SDXL_vpred.json'; steps = 28; cfg = 4; sampler = 'euler'; scheduler = 'simple';
        } else if (/anything.*v5|sd.?1\.?5|sd15/i.test(fn)) {
            workflow = 'S2P_SD15.json'; steps = 20; cfg = 7; sampler = 'dpmpp_2m'; scheduler = 'karras';
        } else {
            workflow = 'S2P_SDXL_eps.json'; steps = 28; cfg = 6; sampler = 'euler_ancestral'; scheduler = 'normal';
        }
        width = 1024; height = 1024;
    } else {
        // Fallback
        workflow = 'S2P_SDXL_eps.json'; steps = 28; cfg = 6; sampler = 'euler_ancestral'; scheduler = 'normal';
        width = 1024; height = 1024;
    }

    sd.comfy_workflow = workflow;
    sd.steps = steps;
    sd.scale = cfg;
    sd.sampler = sampler;
    sd.scheduler = scheduler;
    sd.width = width;
    sd.height = height;

    // Also set the actual checkpoint model filename
    if (isFilename && activeId) {
        sd.model = activeId;
        const modelSel = document.getElementById('sd_model');
        if (modelSel) { modelSel.value = activeId; modelSel.dispatchEvent(new Event('change', {bubbles:true})); }
    }

    saveSettingsDebounced();

    // Update all ST SD settings UI elements to reflect changes
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = val;
        el.dispatchEvent(new Event('input', {bubbles: true}));
        el.dispatchEvent(new Event('change', {bubbles: true}));
    };
    setVal('sd_comfy_workflow', sd.comfy_workflow);
    setVal('sd_steps', sd.steps);
    setVal('sd_scale', sd.scale);
    setVal('sd_sampler', sd.sampler);
    setVal('sd_scheduler', sd.scheduler);
    setVal('sd_width', sd.width);
    setVal('sd_height', sd.height);
    if (sd.model) setVal('sd_model', sd.model);

    log(`已同步到 ST: ${profile.name} → ${sd.comfy_workflow} | ${sd.width}×${sd.height} | Steps:${sd.steps} | CFG:${sd.scale} | ${sd.sampler}`, 'info');
    if (typeof toastr !== 'undefined') toastr.success('参数已同步: ' + profile.name, 'Scene2Prompt');
}

// ═══════════════════════════════════════════════════════════
// Fetch & match ComfyUI models
// ═══════════════════════════════════════════════════════════

const MODEL_MATCH_RULES = [
    { pattern: /noobai|nai-xl|vpred|v_pred|v-pred/i, profileId: 'noobai_xl_v10' },
    { pattern: /wai.*illustrious|wai.*nsfw/i, profileId: 'wai_illustrious_v140' },
    { pattern: /animagine/i, profileId: 'animagine_xl_v31' },
    { pattern: /hassaku/i, profileId: 'hassaku_xl_v10' },
    { pattern: /pony/i, profileId: 'pony_diffusion_v6' },
    { pattern: /kohaku/i, profileId: 'kohaku_xl' },
    { pattern: /nutella|fudge.?pie|apple.?pie|blueberry.?pie|cherry.?pie|derby.?pie|elderberry.?pie|grape.?pie|honey.?pie|impossible.?pie|jam.?pie|key.?lime.?pie|lemon.?pie|mango.?pie|pie.?models/i, profileId: 'nutella_pie' },
    { pattern: /illustrious/i, profileId: 'illustrious_xl_v10' },
    { pattern: /sdxl.*base|sd_xl.*base/i, profileId: 'sdxl_base_10' },
    { pattern: /anything.*v5|sd.?1\.?5|sd15/i, profileId: 'sd15_generic' },
];

async function fetchComfyModels() {
    const sd = extension_settings.sd;
    if (!sd?.comfy_url) {
        log('未配置 ComfyUI URL，请在 ST 的 SD 设置中配置', 'error');
        if (typeof toastr !== 'undefined') toastr.warning('请先在 ST 的 SD 设置中配置 ComfyUI URL', 'Scene2Prompt');
        return [];
    }

    try {
        const resp = await fetch('/api/sd/comfy/models', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ url: sd.comfy_url }),
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();
        // ST returns [{value, text}, ...] from ComfyUI object_info
        let list = Array.isArray(data) ? data : (data.checkpoints || data.models || []);
        list = list.map(item => typeof item === 'string' ? item : (item.value || item.name || item.filename || String(item)));
        return list;
    } catch (e) {
        log('获取 ComfyUI 模型列表失败: ' + e.message, 'error');
        return [];
    }
}

function matchModelProfile(filename) {
    for (const rule of MODEL_MATCH_RULES) {
        if (rule.pattern.test(filename)) {
            return rule.profileId;
        }
    }
    return null; // No match → will be auto-generated
}

async function refreshModelList() {
    const btn = document.getElementById('s2p_refresh_models');
    if (btn) { btn.disabled = true; btn.textContent = '加载中...'; }

    const models = await fetchComfyModels();
    const s = getSettings();
    if (!s.detectedModels) s.detectedModels = [];
    s.detectedModels = models;
    saveSettingsDebounced();

    // Update model profile dropdown
    updateModelProfileUI();
    log(`检测到 ${models.length} 个 ComfyUI 模型`, 'info');
    if (typeof toastr !== 'undefined') toastr.success(`检测到 ${models.length} 个模型`, 'Scene2Prompt');

    if (btn) { btn.disabled = false; btn.textContent = '刷新模型列表'; }
}

// ═══════════════════════════════════════════════════════════
// Button state helper
// ═══════════════════════════════════════════════════════════

function setGenButtonState(text) {
    const btn = document.getElementById('s2p_gen_btn');
    if (!btn) return;
    if (text) {
        btn.textContent = text;
        btn.disabled = true;
        btn.style.opacity = '0.7';
    } else {
        btn.textContent = '画面';
        btn.disabled = false;
        btn.style.opacity = '1';
    }
}

// ═══════════════════════════════════════════════════════════
// Diagnostic Popup (Prompt Inspector)
// ═══════════════════════════════════════════════════════════

async function showDiagnosticPopup(result, eventData) {
    const d = result.diagnosis || {};
    const changesText = (d.changes && d.changes.length > 0)
        ? d.changes.map(c => '• ' + c).join('\n')
        : '（无变更）';

    const content = `
    <div style="display:flex;flex-direction:column;gap:8px;max-height:70vh">
        <div style="display:flex;gap:8px;flex:1;min-height:300px">
            <div style="flex:1;display:flex;flex-direction:column">
                <small style="color:#aaa">LLM 原始输出</small>
                <textarea readonly class="text_pole" style="flex:1;font-size:10px;font-family:monospace;resize:none">${escapeHtml(d.llmRaw || '')}</textarea>
            </div>
            <div style="flex:1;display:flex;flex-direction:column">
                <small style="color:#88cc88">正向提示词（可编辑）</small>
                <textarea id="s2p_diag_prompt" class="text_pole" style="flex:1;font-size:10px;font-family:monospace;resize:none">${escapeHtml(result.prompt)}</textarea>
            </div>
            <div style="flex:1;display:flex;flex-direction:column">
                <small style="color:#ddaa66">后处理变更</small>
                <textarea readonly class="text_pole" style="flex:1;font-size:10px;font-family:monospace;resize:none;background:#1a1a1a">${escapeHtml(changesText)}</textarea>
            </div>
        </div>
        <div style="font-size:11px;color:#888;border-top:1px solid #333;padding-top:4px">
            Provider: ${escapeHtml(d.provider || '?')} | 模型: ${escapeHtml(d.model || '?')} | LLM响应: ${d.llmTime || '?'}ms |
            标签: ${d.tagCount || '?'} → ${d.tagCountAfter || '?'} | 缓存命中: ${(d.cacheHit || []).join(', ') || '无'}
        </div>
    </div>`;

    const popup = new Popup(content, POPUP_TYPE.CONFIRM, '诊断模式 — Prompt Inspector', { okButton: '发送', cancelButton: '取消' });
    const confirmed = await popup.show();

    if (!confirmed) {
        log('用户取消发送', 'info');
        return false;
    }

    // Use edited prompt if user modified it
    const editedPrompt = document.getElementById('s2p_diag_prompt')?.value;
    if (editedPrompt && editedPrompt !== result.prompt) {
        result.prompt = editedPrompt;
        log('用户编辑了提示词', 'info');
    }
    return true;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ═══════════════════════════════════════════════════════════
// Batch Appearance Extraction
// ═══════════════════════════════════════════════════════════

async function batchExtractAppearance() {
    if (!engine) return;
    const ctx = getContext();
    const chars = ctx.characters || {};
    const charList = Object.entries(chars).filter(([, c]) => c.description);

    if (charList.length === 0) {
        alert('没有找到有角色卡描述的角色');
        return;
    }

    const s = getSettings();
    const cached = Object.keys(s.appearanceCache).filter(k => s.appearanceCache[k]?.length > 5);
    const toExtract = charList.filter(([, c]) => !cached.includes(c.name));

    if (toExtract.length === 0) {
        alert('所有角色已有外貌缓存');
        return;
    }

    if (!confirm(`将为 ${toExtract.length} 个角色提取外貌（已有缓存的跳过）：\n\n${toExtract.map(([,c]) => '• ' + c.name).join('\n')}\n\n确定？`)) {
        return;
    }

    let done = 0;
    for (const [, char] of toExtract) {
        const statusEl = document.getElementById('s2p_panel_status');
        if (statusEl) statusEl.textContent = `提取外貌 ${char.name} (${done + 1}/${toExtract.length})...`;

        const success = await engine.extractAppearance(char.name, char.description);
        done++;
        if (success) {
            log(`外貌提取 [${done}/${toExtract.length}]: ${char.name} ✓`, 'info');
        } else {
            log(`外貌提取 [${done}/${toExtract.length}]: ${char.name} ✗`, 'error');
        }
    }

    const statusEl = document.getElementById('s2p_panel_status');
    if (statusEl) statusEl.textContent = `提取完成 (${done} 个角色)`;
    setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);

    updateSettingsUI();
    updateCacheListUI();
}

// ═══════════════════════════════════════════════════════════
// Cache List UI
// ═══════════════════════════════════════════════════════════

function updateCacheListUI() {
    const container = document.getElementById('s2p_cache_list');
    if (!container) return;

    const ctx = getContext();
    const chars = ctx.characters || {};
    const s = getSettings();
    const cache = s.appearanceCache || {};

    // Build cache entries from characters + cache
    const allChars = Object.entries(chars).filter(([, c]) => c.description);
    if (allChars.length === 0) {
        container.innerHTML = '<small style="color:#666">没有找到角色卡</small>';
        return;
    }

    let html = '';
    let cachedCount = 0;
    for (const [, char] of allChars) {
        const tags = cache[char.name];
        if (tags && tags.length > 5) {
            cachedCount++;
            const preview = tags.length > 50 ? tags.substring(0, 50) + '...' : tags;
            html += `<div class="s2p-preset-item" data-cache-name="${escapeHtml(char.name)}">
                <span>${escapeHtml(char.name)} — <span style="color:#88cc88;font-size:10px">${escapeHtml(preview)}</span></span>
                <button class="s2p-btn s2p-btn-sm s2p-cache-del">删除</button>
            </div>`;
        } else {
            html += `<div class="s2p-preset-item" data-cache-name="${escapeHtml(char.name)}">
                <span>${escapeHtml(char.name)} — <span style="color:#666;font-size:10px">(未缓存)</span></span>
                <button class="s2p-btn s2p-btn-sm s2p-cache-extract">提取</button>
            </div>`;
        }
    }
    container.innerHTML = html;
    container.dataset.count = cachedCount + '/' + allChars.length;
}

// ═══════════════════════════════════════════════════════════
// Enhanced Test Connection
// ═══════════════════════════════════════════════════════════

async function testConnection() {
    const btn = document.getElementById('s2p_test_connection');
    if (btn) { btn.disabled = true; btn.textContent = '测试中...'; }

    const s = getSettings();
    const primaryId = s.provider;
    const config = s.providerConfigs?.[primaryId] || {};
    const model = config.model || '?';

    let report = '';

    try {
        if (!providerRegistry) throw new Error('Provider 系统尚未初始化');

        const provider = providerRegistry.get(primaryId);
        if (!provider) throw new Error(`未找到 Provider: ${primaryId}`);
        if (!provider.isConfigured(s)) throw new Error(`${provider.name} 未配置（请填写 API Key）`);

        const startTime = performance.now();
        const raw = await provider.call('', 'Hi', s);
        const elapsed = Math.round(performance.now() - startTime);

        report = `Provider: ${provider.name}
URL: ${provider.buildUrl(config)}
HTTP 状态: 200 OK ✅
响应延迟: ${elapsed}ms
模型: ${model}
━━━━━━━━━━━━━━━━━━
✅ 连接正常，可以开始生图`;

        log(`Provider ${provider.name} 连接成功 (${elapsed}ms)`, 'info');
    } catch (e) {
        const msg = e.message || String(e);
        let hint = '';
        if (msg.includes('401')) hint = '\n💡 API Key 无效，请检查是否正确';
        else if (msg.includes('404')) hint = `\n💡 模型不存在，确认模型名是否正确（当前: ${model}）`;
        else if (msg.includes('超时') || msg.includes('timeout')) hint = '\n💡 请求超时，检查网络或增大超时时间';
        else if (msg.includes('CORS') || msg.includes('NetworkError')) hint = '\n💡 网络错误。Ollama 需加 OLLAMA_ORIGINS=* 启动；其他 Provider 一般支持浏览器调用';
        else if (msg.includes('Failed to fetch')) hint = '\n💡 无法连接到 API 服务器，检查网络和代理设置';

        report = `Provider: ${primaryId}
URL: ${providerRegistry?.get(primaryId)?.buildUrl(config) || '?'}
❌ 连接失败
错误: ${msg}${hint}`;

        log(`连接测试失败: ${msg}`, 'error');
    }

    // Show report in popup
    const popup = new Popup(
        `<pre style="font-size:12px;white-space:pre-wrap;font-family:Consolas,Monaco,monospace">${escapeHtml(report)}</pre>`,
        POPUP_TYPE.TEXT,
        '连接测试报告'
    );
    await popup.show();

    if (btn) { btn.disabled = false; btn.textContent = '测试连接'; }
}

// ═══════════════════════════════════════════════════════════
// Core event handler (delegates to engine when available)
// ═══════════════════════════════════════════════════════════

async function onPromptProcessing(eventData) {
    const s = getSettings();
    if (!s.enabled) return;

    if (!engine) {
        log('引擎尚未初始化，跳过生图事件', 'debug');
        return;
    }

    log('生图事件触发 | 模式: ' + (eventData.generationType || '?'), 'debug');

    try {
        setGenButtonState('生成中...');
        const diagMode = s.diagnosticMode || 'off';
        const result = await engine.process(eventData, {
            onProgress: (stage) => {
                if (stage === 'llm') setGenButtonState('LLM请求中...');
                else if (stage === 'postprocess') setGenButtonState('后处理中...');
            },
            diagnosticMode: diagMode,
        });

        if (!result || !result.prompt) {
            setGenButtonState(null);
            log('提示词生成失败', 'error');
            return;
        }

        // Diagnostic popup if enabled
        if (diagMode === 'always' && result.diagnosis) {
            const confirmed = await showDiagnosticPopup(result, eventData);
            if (!confirmed) {
                setGenButtonState(null);
                log('用户取消发送', 'info');
                return;
            }
            eventData.prompt = result.prompt;
        }

        // Store for preview
        lastPrompt = result.prompt;
        lastNegative = result.negative || '';

        // Update preview textareas
        const previewBox = document.getElementById('s2p_preview');
        if (previewBox) { previewBox.value = result.prompt; previewBox.style.display = ''; }
        const negBox = document.getElementById('s2p_neg_preview');
        if (negBox && result.negative) { negBox.value = result.negative; negBox.style.display = ''; }
        // Mini preview in Tab 2
        const miniPos = document.getElementById('s2p_preview_mini');
        if (miniPos) miniPos.value = result.prompt.substring(0, 500);
        const miniNeg = document.getElementById('s2p_neg_preview_mini');
        if (miniNeg && result.negative) miniNeg.value = result.negative.substring(0, 300);

        setGenButtonState(null);

    } catch (e) {
        setGenButtonState(null);
        log('生图事件处理错误: ' + e.message, 'error');
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

        const modelProfilesMod = await import('./model_profiles.js');
        modelProfileManager = new modelProfilesMod.ModelProfileManager(MODULE_NAME);

        const engineMod = await import('./engine.js');
        engine = new engineMod.S2PEngine(providerRegistry, presetManager, modelProfileManager, log, getSettings);

        log('所有模块已加载', 'info');
    } catch (e) {
        log('模块加载失败: ' + e.message, 'error');
        // Continue without engine — settings panel will still work
    }

    // 3. Register event handler
    eventSource.on(event_types.SD_PROMPT_PROCESSING, onPromptProcessing);

    // 5. Initialize UI
    await initUI();

    // 5. Inject "画面" button
    injectGenButton();

    // 6. Preset placeholders
    presetLoRAPlaceholders();

    log('v2.0 社区版已启动 — 多 LLM + ComfyUI 对接', 'info');
}
