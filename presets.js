/**
 * Scene2Prompt v2.0 — Preset System
 *
 * 预设管理：5 个内置预设 + 用户自定义预设 CRUD。
 * 预设不存储 API Key，只存储行为参数和 Provider/Model 选择。
 */

import { extension_settings } from '../../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';

// ═══════════════════════════════════════════════════════════
// Built-in Presets
// ═══════════════════════════════════════════════════════════

const BUILT_IN_PRESETS = [
    {
        id: 'manhwa_specialized',
        name: '韩漫特化',
        description: '韩漫半写实风格，DeepSeek + WAI Illustrious。896×1152',
        builtIn: true,
        config: {
            provider: 'deepseek',
            secondaryProvider: '',
            modelProfileId: 'wai_illustrious_v140',
            style: 'WAI',
            intensity: '自动',
            contextMessages: 12,
            pov: false,
            preprocess: true,
            prompt_template: null,
        },
    },
    {
        id: 'generic_anime',
        name: '通用动漫',
        description: '精细动漫风格，Animagine XL。1024×1024',
        builtIn: true,
        config: {
            provider: 'deepseek',
            secondaryProvider: '',
            modelProfileId: 'animagine_xl_v31',
            style: 'Animagine',
            intensity: '自动',
            contextMessages: 10,
            pov: false,
            preprocess: true,
            prompt_template: null,
        },
    },
    {
        id: 'photorealistic',
        name: '写实摄影',
        description: '照片级写实，SDXL Base。1024×1024',
        builtIn: true,
        config: {
            provider: 'openai',
            secondaryProvider: 'deepseek',
            modelProfileId: 'sdxl_base_10',
            style: '写实',
            intensity: '自动',
            contextMessages: 8,
            pov: false,
            preprocess: false,
            prompt_template: null,
        },
    },
    {
        id: 'speed_lite',
        name: '极速轻量',
        description: '本地 Ollama + NoobAI-XL，无需 API Key。768×1024',
        builtIn: true,
        config: {
            provider: 'ollama',
            secondaryProvider: '',
            modelProfileId: 'noobai_xl_v10',
            style: 'Animagine',
            intensity: '自动',
            contextMessages: 6,
            pov: false,
            preprocess: true,
            prompt_template: null,
        },
    },
    {
        id: 'character_design',
        name: '角色设计',
        description: '角色参考图模式，NoobAI-XL。1024×1024',
        builtIn: true,
        config: {
            provider: 'deepseek',
            secondaryProvider: '',
            modelProfileId: 'noobai_xl_v10',
            style: 'Animagine',
            intensity: '无',
            contextMessages: 4,
            pov: false,
            preprocess: false,
            prompt_template: null,
        },
    },
];

// ═══════════════════════════════════════════════════════════
// Preset Manager
// ═══════════════════════════════════════════════════════════

class PresetManager {
    /**
     * @param {string} moduleName - Extension module name ('scene2prompt')
     */
    constructor(moduleName) {
        this.moduleName = moduleName;
        this._ensureBuiltIns();
    }

    /**
     * Get the extension settings object.
     */
    _settings() {
        if (!extension_settings[this.moduleName]) {
            extension_settings[this.moduleName] = {};
        }
        return extension_settings[this.moduleName];
    }

    /**
     * Ensure presets structure exists and built-in presets are populated.
     */
    _ensureBuiltIns() {
        const s = this._settings();
        if (!s.presets) {
            s.presets = { custom: [], activePresetId: BUILT_IN_PRESETS[0].id };
        }
        if (!s.presets.activePresetId) {
            s.presets.activePresetId = BUILT_IN_PRESETS[0].id;
        }
        if (!s.presets.custom) {
            s.presets.custom = [];
        }
        // Built-in presets are always from the source to allow updates
    }

    /**
     * Get all presets (built-in + custom).
     * @returns {Array<{id: string, name: string, description: string, builtIn: boolean, config: object}>}
     */
    getAll() {
        const s = this._settings();
        return [...BUILT_IN_PRESETS, ...(s.presets.custom || [])];
    }

    /**
     * Get a preset by ID.
     * @param {string} id
     * @returns {object|undefined}
     */
    get(id) {
        // Check built-ins first
        const builtIn = BUILT_IN_PRESETS.find(p => p.id === id);
        if (builtIn) return builtIn;

        // Check custom
        const s = this._settings();
        return (s.presets.custom || []).find(p => p.id === id);
    }

    /**
     * Apply a preset's config to the current extension settings.
     * Does NOT overwrite API keys or appearance cache.
     * @param {string} id - Preset ID to apply
     */
    apply(id) {
        const preset = this.get(id);
        if (!preset) return;

        const s = this._settings();

        // Apply config fields (safely — don't overwrite credentials)
        const cfg = preset.config;
        if (cfg.provider !== undefined) s.provider = cfg.provider;
        if (cfg.secondaryProvider !== undefined) s.secondaryProvider = cfg.secondaryProvider;
        if (cfg.style !== undefined) s.style = cfg.style;
        if (cfg.modelProfileId !== undefined) {
            if (!s.modelProfiles) s.modelProfiles = { activeProfileId: 'noobai_xl_v10' };
            s.modelProfiles.activeProfileId = cfg.modelProfileId;
        }
        if (cfg.intensity !== undefined) s.intensity = cfg.intensity;
        if (cfg.contextMessages !== undefined) s.contextMessages = cfg.contextMessages;
        if (cfg.pov !== undefined) s.pov = cfg.pov;
        if (cfg.preprocess !== undefined) s.preprocess = cfg.preprocess;
        if (cfg.prompt_template !== undefined) s.systemPromptOverride = cfg.prompt_template || '';

        // Apply provider-specific config (model selection, but not API keys)
        if (cfg.provider && cfg.providerConfig) {
            if (!s.providerConfigs[cfg.provider]) {
                s.providerConfigs[cfg.provider] = {};
            }
            const target = s.providerConfigs[cfg.provider];
            if (cfg.providerConfig.model) target.model = cfg.providerConfig.model;
            if (cfg.providerConfig.temperature !== undefined) target.temperature = cfg.providerConfig.temperature;
            if (cfg.providerConfig.maxTokens !== undefined) target.maxTokens = cfg.providerConfig.maxTokens;
        }

        s.presets.activePresetId = id;
        saveSettingsDebounced();

        // Update settings UI if available
        this._updateUI();
    }

    /**
     * Save the current settings as a new custom preset.
     * @param {string} name - Display name for the preset
     * @returns {string} The new preset's ID
     */
    save(name) {
        const s = this._settings();
        const id = 'custom_' + Date.now();

        const cfg = s.providerConfigs?.[s.provider] || {};
        const preset = {
            id,
            name,
            description: `自定义预设 — ${s.provider} / ${s.style} / ${s.intensity}`,
            builtIn: false,
            config: {
                provider: s.provider,
                secondaryProvider: s.secondaryProvider || '',
                style: s.style,
                intensity: s.intensity,
                contextMessages: s.contextMessages,
                pov: s.pov,
                preprocess: s.preprocess,
                prompt_template: s.systemPromptOverride || null,
                providerConfig: {
                    model: cfg.model || '',
                    temperature: cfg.temperature ?? 0.7,
                    maxTokens: cfg.maxTokens ?? 2048,
                },
            },
        };

        s.presets.custom.push(preset);
        s.presets.activePresetId = id;
        saveSettingsDebounced();
        return id;
    }

    /**
     * Delete a custom preset.
     * @param {string} id
     */
    delete(id) {
        const s = this._settings();
        const preset = this.get(id);
        if (!preset || preset.builtIn) return;

        s.presets.custom = s.presets.custom.filter(p => p.id !== id);

        // If the deleted preset was active, switch to first built-in
        if (s.presets.activePresetId === id) {
            s.presets.activePresetId = BUILT_IN_PRESETS[0].id;
            this.apply(BUILT_IN_PRESETS[0].id);
        }
        saveSettingsDebounced();
    }

    /**
     * Export a preset as a JSON string (for file download).
     * API keys are NOT included.
     * @param {string} id
     * @returns {string|null}
     */
    export(id) {
        const preset = this.get(id);
        if (!preset) return null;

        const exportData = {
            name: preset.name,
            description: preset.description,
            config: JSON.parse(JSON.stringify(preset.config)),
            exportedFrom: 'Scene2Prompt v2.0',
            exportedAt: new Date().toISOString(),
        };

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Import a preset from a JSON string.
     * @param {string} json
     * @returns {string} The imported preset's ID
     * @throws {Error} If JSON is invalid or required fields are missing
     */
    import(json) {
        let data;
        try {
            data = JSON.parse(json);
        } catch (e) {
            throw new Error('JSON 解析失败: ' + e.message);
        }

        if (!data.name || !data.config) {
            throw new Error('预设格式无效：缺少 name 或 config 字段');
        }

        const s = this._settings();
        const id = 'imported_' + Date.now();

        const preset = {
            id,
            name: data.name,
            description: data.description || '导入的预设',
            builtIn: false,
            config: {
                provider: data.config.provider || 'deepseek',
                secondaryProvider: data.config.secondaryProvider || '',
                style: data.config.style || 'WAI',
                intensity: data.config.intensity || '自动',
                contextMessages: data.config.contextMessages || 12,
                pov: data.config.pov || false,
                preprocess: data.config.preprocess !== false,
                prompt_template: data.config.prompt_template || null,
                providerConfig: data.config.providerConfig || {},
            },
        };

        // Avoid duplicate IDs
        const existing = this.get(id);
        if (existing) {
            preset.id = 'imported_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        }

        s.presets.custom.push(preset);
        saveSettingsDebounced();
        return preset.id;
    }

    /**
     * Restore all built-in presets to their original state.
     * Does NOT delete custom presets.
     */
    restoreBuiltIns() {
        // Built-in presets are always defined in code, so "restoring" just means
        // clearing any cached overrides. Future: if we allow editing built-ins,
        // this would reset them.
        const s = this._settings();
        if (s.presets.activePresetId) {
            const isBuiltIn = BUILT_IN_PRESETS.some(p => p.id === s.presets.activePresetId);
            if (!isBuiltIn) {
                s.presets.activePresetId = BUILT_IN_PRESETS[0].id;
                this.apply(BUILT_IN_PRESETS[0].id);
            }
        }
        saveSettingsDebounced();
    }

    /**
     * Try to refresh the settings UI after preset changes.
     * Calls the global updateSettingsUI if available.
     */
    _updateUI() {
        // The UI update functions are defined in index.js.
        // We use setTimeout to ensure the settings are saved first,
        // then let the caller trigger UI refresh.
        setTimeout(() => {
            // Trigger a custom event that index.js can listen to
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('s2p_preset_changed'));
            }
        }, 100);
    }
}

// ═══════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════

export { PresetManager, BUILT_IN_PRESETS };
