/**
 * Scene2Prompt v2.0 — Multi-LLM Provider Abstraction
 *
 * 统一的多 LLM 调用接口。所有 API 从浏览器直发，无需 ST 服务端代理。
 *
 * Supported providers:
 *   deepseek   — api.deepseek.com (OpenAI-compatible)
 *   openai     — api.openai.com (OpenAI-compatible)
 *   openrouter — openrouter.ai (OpenAI-compatible, routes to Claude/Gemini/etc.)
 *   ollama     — localhost (Ollama native API)
 *   custom     — user-defined URL (OpenAI-compatible assumed)
 */

// ═══════════════════════════════════════════════════════════
// Base Provider
// ═══════════════════════════════════════════════════════════

class BaseProvider {
    constructor({ id, name, description = '', needsCORS = false } = {}) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.needsCORS = needsCORS;
    }

    /**
     * Check if this provider has the required credentials configured.
     * @param {object} settings - extension_settings.scene2prompt
     * @returns {boolean}
     */
    isConfigured(settings) {
        return true; // Override in subclass
    }

    /**
     * Call the LLM and return raw response text.
     * @param {string} systemPrompt
     * @param {string} userMessage
     * @param {object} settings - extension_settings.scene2prompt
     * @param {object} [options] - { temperature, maxTokens, timeout, retries }
     * @returns {Promise<string>}
     */
    async call(systemPrompt, userMessage, settings, options = {}) {
        const config = settings.providerConfigs?.[this.id] || {};
        const timeout = (options.timeout ?? settings.providerTimeout ?? 60) * 1000;
        const maxRetries = options.retries ?? settings.maxRetries ?? 3;

        const body = this.buildBody(systemPrompt, userMessage, config, options);
        const url = this.buildUrl(config);
        const headers = this.buildHeaders(config);

        let lastError = null;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    const delay = Math.min(2000 * Math.pow(2, attempt - 1), 16000);
                    await new Promise(r => setTimeout(r, delay));
                }

                const resp = await fetch(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                    signal: AbortSignal.timeout(timeout),
                });

                if (!resp.ok) {
                    const errText = await resp.text().catch(() => '');
                    throw new Error(`HTTP ${resp.status}${errText ? ': ' + errText.substring(0, 200) : ''}`);
                }

                const data = await resp.json();
                const raw = this.extractContent(data);
                if (!raw || raw.length === 0) {
                    throw new Error('LLM 返回空内容');
                }
                return raw;

            } catch (e) {
                lastError = e;
                if (e.name === 'AbortError' || e.name === 'TimeoutError') {
                    lastError = new Error(`请求超时 (${timeout / 1000}s)`);
                }
            }
        }

        throw lastError || new Error(`${this.name} 调用失败（已重试 ${maxRetries} 次）`);
    }

    /** Override in subclass */
    buildUrl(config) {
        return '';
    }

    /** Override in subclass */
    buildHeaders(config) {
        return { 'Content-Type': 'application/json' };
    }

    /** Override in subclass */
    buildBody(systemPrompt, userMessage, config, options) {
        return {};
    }

    /** Override in subclass */
    extractContent(data) {
        return '';
    }
}

// ═══════════════════════════════════════════════════════════
// OpenAI-compatible base (shared by deepseek, openai, openrouter, custom)
// ═══════════════════════════════════════════════════════════

class OpenAICompatibleProvider extends BaseProvider {
    buildBody(systemPrompt, userMessage, config, options) {
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: userMessage });

        return {
            model: config.model || '',
            messages,
            temperature: options.temperature ?? config.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? config.maxTokens ?? 2048,
        };
    }

    extractContent(data) {
        return data?.choices?.[0]?.message?.content || '';
    }
}

// ═══════════════════════════════════════════════════════════
// DeepSeek Provider
// ═══════════════════════════════════════════════════════════

class DeepSeekProvider extends OpenAICompatibleProvider {
    constructor() {
        super({
            id: 'deepseek',
            name: 'DeepSeek',
            description: 'api.deepseek.com — 性价比高，中文理解好',
        });
    }

    isConfigured(settings) {
        const config = settings.providerConfigs?.deepseek;
        return !!(config?.apiKey);
    }

    buildUrl() {
        return 'https://api.deepseek.com/chat/completions';
    }

    buildHeaders(config) {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey || ''}`,
        };
    }
}

// ═══════════════════════════════════════════════════════════
// OpenAI Provider
// ═══════════════════════════════════════════════════════════

class OpenAIProvider extends OpenAICompatibleProvider {
    constructor() {
        super({
            id: 'openai',
            name: 'OpenAI',
            description: 'api.openai.com — GPT-4o / GPT-4o-mini',
        });
    }

    isConfigured(settings) {
        const config = settings.providerConfigs?.openai;
        return !!(config?.apiKey);
    }

    buildUrl() {
        return 'https://api.openai.com/v1/chat/completions';
    }

    buildHeaders(config) {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey || ''}`,
        };
    }
}

// ═══════════════════════════════════════════════════════════
// OpenRouter Provider (Claude/Gemini/etc. bridge)
// ═══════════════════════════════════════════════════════════

class OpenRouterProvider extends OpenAICompatibleProvider {
    constructor() {
        super({
            id: 'openrouter',
            name: 'OpenRouter',
            description: 'openrouter.ai — 统一 API 访问 Claude/Gemini/GPT 等',
        });
    }

    isConfigured(settings) {
        const config = settings.providerConfigs?.openrouter;
        return !!(config?.apiKey);
    }

    buildUrl() {
        return 'https://openrouter.ai/api/v1/chat/completions';
    }

    buildHeaders(config) {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey || ''}`,
            'HTTP-Referer': 'https://github.com/scene2prompt',
            'X-Title': 'Scene2Prompt',
        };
    }

    /** OpenRouter also uses OpenAI-compatible response format */
}

// ═══════════════════════════════════════════════════════════
// Ollama Provider (local)
// ═══════════════════════════════════════════════════════════

class OllamaProvider extends BaseProvider {
    constructor() {
        super({
            id: 'ollama',
            name: 'Ollama',
            description: '本地 LLM 服务 — 免费、离线、隐私',
            needsCORS: true,
        });
    }

    isConfigured(settings) {
        const config = settings.providerConfigs?.ollama;
        return !!(config?.baseUrl && config?.model);
    }

    buildUrl(config) {
        const base = (config.baseUrl || 'http://127.0.0.1:11434').replace(/\/+$/, '');
        return `${base}/api/chat`;
    }

    buildHeaders() {
        return { 'Content-Type': 'application/json' };
    }

    buildBody(systemPrompt, userMessage, config, options) {
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: userMessage });

        return {
            model: config.model || '',
            messages,
            stream: false,
            options: {
                temperature: options.temperature ?? config.temperature ?? 0.7,
                num_predict: options.maxTokens ?? config.maxTokens ?? 2048,
            },
        };
    }

    extractContent(data) {
        return data?.message?.content || '';
    }
}

// ═══════════════════════════════════════════════════════════
// Custom Provider (user-defined OpenAI-compatible endpoint)
// ═══════════════════════════════════════════════════════════

class CustomProvider extends OpenAICompatibleProvider {
    constructor() {
        super({
            id: 'custom',
            name: '自定义',
            description: '任意 OpenAI 兼容 API（vLLM / LiteLLM / 本地代理 等）',
        });
    }

    isConfigured(settings) {
        const config = settings.providerConfigs?.custom;
        return !!(config?.url && config?.model);
    }

    buildUrl(config) {
        return (config.url || '').replace(/\/+$/, '');
    }

    buildHeaders(config) {
        const headers = { 'Content-Type': 'application/json' };
        if (config.apiKey) {
            headers['Authorization'] = `Bearer ${config.apiKey}`;
        }
        return headers;
    }
}

// ═══════════════════════════════════════════════════════════
// Provider Registry
// ═══════════════════════════════════════════════════════════

class ProviderRegistry {
    constructor(logFn = () => {}) {
        this._providers = new Map();
        this._log = logFn;
        this._registerBuiltIns();
    }

    _registerBuiltIns() {
        this.register(new DeepSeekProvider());
        this.register(new OpenAIProvider());
        this.register(new OpenRouterProvider());
        this.register(new OllamaProvider());
        this.register(new CustomProvider());
    }

    /**
     * Register a provider implementation.
     * @param {BaseProvider} provider
     */
    register(provider) {
        this._providers.set(provider.id, provider);
    }

    /**
     * Get a provider by ID.
     * @param {string} id
     * @returns {BaseProvider|undefined}
     */
    get(id) {
        return this._providers.get(id);
    }

    /**
     * List all registered providers.
     * @returns {BaseProvider[]}
     */
    list() {
        return [...this._providers.values()];
    }

    /**
     * Execute the fallback chain:
     *   1. Try primary provider (with retries)
     *   2. On failure, try secondary provider (with retries)
     *   3. On failure, return null (caller should use keyword fallback)
     *
     * @param {string} systemPrompt
     * @param {string} userMessage
     * @param {object} settings - extension_settings.scene2prompt
     * @param {object} [options]
     * @returns {Promise<{raw: string, provider: string}|null>}
     */
    async execute(systemPrompt, userMessage, settings, options = {}) {
        const primaryId = options.primaryId || settings.provider;
        const secondaryId = options.secondaryId || settings.secondaryProvider;

        // Try primary
        const primary = this.get(primaryId);
        if (primary && primary.isConfigured(settings)) {
            try {
                this._log(`调用主 Provider: ${primary.name}`);
                const raw = await primary.call(systemPrompt, userMessage, settings, options);
                return { raw, provider: primaryId };
            } catch (e) {
                this._log(`${primary.name} 失败: ${e.message}，尝试备用...`, 'error');
            }
        } else if (primary) {
            this._log(`主 Provider (${primary.name}) 未配置，跳过`, 'debug');
        }

        // Try secondary (fallback)
        if (secondaryId) {
            const secondary = this.get(secondaryId);
            if (secondary && secondary.isConfigured(settings)) {
                try {
                    this._log(`调用备用 Provider: ${secondary.name}`);
                    const raw = await secondary.call(systemPrompt, userMessage, settings, options);
                    return { raw, provider: secondaryId };
                } catch (e) {
                    this._log(`${secondary.name} 也失败了: ${e.message}`, 'error');
                }
            } else if (secondary) {
                this._log(`备用 Provider (${secondary.name}) 未配置，跳过`, 'debug');
            }
        }

        // All providers failed
        return null;
    }
}

// ═══════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════

export {
    BaseProvider,
    OpenAICompatibleProvider,
    DeepSeekProvider,
    OpenAIProvider,
    OpenRouterProvider,
    OllamaProvider,
    CustomProvider,
    ProviderRegistry,
};
