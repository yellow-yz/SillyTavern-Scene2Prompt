/**
 * Scene2Prompt v2.0 — Core Engine
 *
 * 7-step pipeline: context collection → LLM call → parse → appearance inject
 * → clean conflicts → content gate → negative prompt
 *
 * Ported and refactored from v4 single-file index.js (911 lines).
 */

import { getContext, extension_settings } from '../../../extensions.js';
import { saveSettingsDebounced, eventSource, event_types } from '../../../../script.js';

// ═══════════════════════════════════════════════════════════
// System Prompt (default, overridable per-preset)
// ═══════════════════════════════════════════════════════════

const DEFAULT_SYSTEM_PROMPT = `你是SD提示词专家。根据风格参数使用不同底座模型。先分析场景，再输出标签。

## 输出格式
[ANALYSIS]
用一句中文简述当前场景（人物在做什么、情绪氛围、为什么这样判断）

[POSITIVE]
6行Danbooru标签

[NEGATIVE]
反向提示词

## 内容级别（最先判断）
根据参数「内容」: 无=完全SFW，禁止任何性标签，跳过下文NSFW速查 / 软色情=可裸露无性行为 / 显式=全部可含 / 自动=自行判断

## 6行格式
第1行 — 品质+风格:
  (masterpiece:1.3), (best quality:1.3), (amazing quality:1.2), (very aesthetic:1.2), absurdres, (semi-realistic:1.2), (detailed:1.2), (highres:1.2), (natural skin:1.2), (skin texture:1.1)
  暗调加: dark theme, (dramatic shadows:1.2)

第2行 — 主体: 输出正确的人数标签。单人: 1girl+female 或 solo focus+POV; 多人: 2girls/3girls/1boy2girls等标准标签，多人POV加POV+first person view——不要solo focus。(禁止不在场角色)

第3行: 姿势+表情(<=25标签)。多人时每人写不同的姿势来天然分离——一人跪着一人站着、一人低头一人仰头等。格式: (name1: distinct_pose1, expr:1.1), (name2: distinct_pose2, expr:1.1)。内容≠无且涉及性时才加性标签
第4行: 服装(以聊天记录为准，多人时按角色分写: name1: clothing1; name2: clothing2)
第5行: 身体+发型(<=30标签，多人时按角色分写: name1: hair/eyes/skin/build; name2: hair/eyes/skin/build。禁止性器官/液体)
第6行: 场景+光线+视角+构图(<=8标签)。根据场景自己选最佳构图——from front/from above/from side/wide shot/POV/close-up等。多人与POV是否冲突由你根据上文POV判断标准决定

## 规则
- 画面唯一依据=聊天记录当前发生的事。角色外貌是参考，不是场景指令。比喻/拟人忽略，只提取字面物理动作
- 2.5D半写实，禁止: anime style/anime coloring/cel shading/cartoon/sharp anime eyes/photorealistic/raw photo/3d render
- 单画面一个核心动作，禁止矛盾组合。不编造文本中没有的特征。close-up时不写全身姿势标签
- SFW场景（吃饭/写作业/运动等）即使角色设定有性器官描写也绝对不加NSFW标签

## 反向提示词
lowres, (bad quality:1.2), (worst quality:1.2), bad anatomy, sketch, jpeg artifacts, ugly, poorly drawn, blurry, watermark, extra digits, anime style, anime coloring, cel shading, 3d render, photorealistic, raw photo, cartoon, plastic skin, airbrushed, doll-like, signature, text

## NSFW速查（仅内容≠无时参考）
体位: 传教士(missionary)/后入(doggystyle)/骑乘(cowgirl)/口交(fellatio+blowjob)/舔阴(cunnilingus)/侧入(spoon)/自慰(masturbation+fingering)/中出(creampie)。权重1.3。一个场景一个体位。
器官(pussy/labia/clitoris/nipples/penis/glans)权重1.3，体液(pussy juice/semen/cum/saliva)权重1.2。
## POV模式(当参数POV=自行判断时，你根据场景自己决定)
- 用POV: 镜头是观看者的眼睛，对方的动作对着你做(口交/舔阴/对面说话)、观看者的手/腿/阴茎自然入镜
- 不用POV: 观看者也该被画面看到(围桌吃饭/三人合照/并肩躺着)，用客观视角(wide shot/from side)
- 人数不是判断标准——两人跪你面前口交用POV合理，三人围桌吃饭用客观合理
- POV时禁止1boy/male/couple标签

输出: [POSITIVE]...[NEGATIVE]...
`;

// Anti-censor tags (only applied when content level = 显式 or 软色情)
const ANTI_CENSOR_TAGS = '(censored:1.9), (mosaic:1.9), (white censor bar:1.9), white bar, (white line:1.8), (white glow:1.8), (light beam:1.8), (light bar:1.8), (nipple censor:1.7), (genital mosaic:1.9), (steam censor:1.6), (pixelation:1.9), (censor bar:1.9), censored';

// ═══════════════════════════════════════════════════════════
// S2P Engine
// ═══════════════════════════════════════════════════════════

class S2PEngine {
    /**
     * @param {import('./providers.js').ProviderRegistry} providerRegistry
     * @param {import('./presets.js').PresetManager} presetManager
     * @param {Function} logFn
     * @param {Function} getSettingsFn
     */
    constructor(providerRegistry, presetManager, modelProfileManager, logFn, getSettingsFn) {
        this.providers = providerRegistry;
        this.presets = presetManager;
        this.modelProfiles = modelProfileManager;
        this.log = logFn || (() => {});
        this.getSettings = getSettingsFn || (() => extension_settings?.scene2prompt || {});

        // State for auto-extract throttle
        this._lastCharId = null;
        this._lastExtractTime = 0;

        // Register CHAT_CHANGED handler for auto-extract
        this._setupAutoExtract();
    }

    // ═══════════════════════════════════════════════
    // Main Pipeline
    // ═══════════════════════════════════════════════

    /**
     * Full pipeline entry point. Called from SD_PROMPT_PROCESSING handler.
     * @param {object} eventData - The event data from ST
     * @param {object} [options] - { onProgress: (stage, detail) => void, diagnosticMode: 'always'|'off' }
     * @returns {Promise<{prompt: string, negative: string, analysis: string, method: string, diagnosis: object}|null>}
     */
    async process(eventData, options = {}) {
        const { onProgress = null, diagnosticMode = 'off' } = options;
        const t0 = performance.now();
        const diagnosis = {
            provider: '', model: '', method: '',
            llmRaw: '', llmTime: 0,
            parsedPrompt: '', parsedNegative: '',
            changes: [],
            tagCount: 0, tagCountAfter: 0,
            contentLevel: '', cacheHit: [],
        };

        // Stage 1: Context
        if (onProgress) onProgress('context');
        const t1 = performance.now();
        const ctx = this.collectContext();
        if (!ctx || ctx.length < 10) {
            this.log('聊天内容太短', 'debug');
            if (onProgress) onProgress('done', { skipped: true });
            return null;
        }
        this.log(`上下文: ${ctx.length} 字 (${Math.round(performance.now() - t1)}ms)`, 'debug');

        // Stage 2: LLM call with fallback chain
        const s = this.getSettings();
        const primaryProvider = this.providers.get(s.provider);
        diagnosis.provider = primaryProvider?.name || s.provider;
        diagnosis.model = s.providerConfigs?.[s.provider]?.model || '';

        if (onProgress) onProgress('llm', { provider: diagnosis.provider, model: diagnosis.model });
        const t2 = performance.now();
        let result = await this.callLLM(ctx);
        diagnosis.llmTime = Math.round(performance.now() - t2);
        let method = result.provider || 'Unknown';

        if (!result?.positive) {
            this.log('LLM 全部失败，改用关键词回退', 'info');
            result = this.fallbackTags(ctx);
            result.method = '关键词';
            method = '关键词';
        }

        if (!result?.positive) {
            this.log('提示词生成完全失败', 'error');
            if (onProgress) onProgress('done', { error: true });
            return null;
        }

        diagnosis.method = result.method || method;
        diagnosis.llmRaw = result._raw || '';
        diagnosis.parsedPrompt = result.positive;
        diagnosis.parsedNegative = result.negative || '';

        // Track cache hits
        const cache = s.appearanceCache || {};
        const cacheKeys = Object.keys(cache).filter(k => cache[k]?.length > 5);
        diagnosis.cacheHit = cacheKeys.filter(name => result.positive.includes(name));

        // Stage 3: Post-processing
        if (onProgress) onProgress('postprocess');
        const t3 = performance.now();

        // Inject appearance
        let finalPrompt = this.injectAppearance(result.positive);
        finalPrompt = this.injectUserAppearance(finalPrompt);

        // Count tags before
        diagnosis.tagCount = (finalPrompt.match(/,/g) || []).length + 1;

        // Clean conflicts
        const cleaned = this.cleanConflicts(finalPrompt);
        finalPrompt = cleaned.prompt;
        diagnosis.changes = cleaned.changes || [];

        // Content level gating
        finalPrompt = this.enforceContentLevel(finalPrompt, ctx);
        diagnosis.contentLevel = s.intensity || '自动';

        // Count tags after
        diagnosis.tagCountAfter = (finalPrompt.match(/,/g) || []).length + 1;

        const postTime = Math.round(performance.now() - t3);

        // Stage 4: Anti-censor negative
        const negative = this.buildNegative(result.negative || '', ctx);

        // Inject into ST pipeline
        eventData.prompt = finalPrompt;

        if (negative.length > 10) {
            extension_settings.sd.negative_prompt = negative;
            saveSettingsDebounced();
        }

        // Logging
        if (result.analysis) {
            this.log('分析: ' + result.analysis, 'info');
        }
        this.log(`增强完成 (${method}) LLM:${diagnosis.llmTime}ms 后处理:${postTime}ms`, 'info');
        this.log('--- 正向提示词前300字 ---');
        this.log(finalPrompt.substring(0, 300));
        this.log('--- 反向提示词前300字 ---');
        this.log(negative.substring(0, 300));

        const totalTime = Math.round(performance.now() - t0);
        if (onProgress) onProgress('done', { totalTime });

        return {
            prompt: finalPrompt,
            negative: negative,
            analysis: result.analysis || '',
            method: result.method || method,
            diagnosis,
        };
    }

    // ═══════════════════════════════════════════════
    // Text Preprocessing
    // ═══════════════════════════════════════════════

    preprocess(text) {
        const s = this.getSettings();
        if (!s.preprocess) return text;
        return text
            .replace(/["""][^""""]*["""]/g, ' ')
            .replace(/(?:心里|内心|脑海中|脑海里|记忆中|想起|回忆起|忽然想到|突然意识到|心底|脑子里|思绪|念头).*?(?:[。，；、\n]|$)/g, ' ')
            .replace(/(?:感到|觉得|心想|暗想|寻思|思量|心道|心说|默默想).*?(?:[。，；、\n]|$)/g, ' ')
            .replace(/(?:就像|就像是在|好像是|仿佛是|宛如|犹如|如同|似乎|仿佛就是|仿佛是那|好比|恰似|恍如).*?(?:[。，；、\n]|$)/g, ' ')
            .replace(/像.{1,15}(?:一样|似的|般|那样|那般|一样啊)/g, ' ')
            .replace(/跟.{1,10}(?:一样|似的)/g, ' ')
            .replace(/\S{1,6}(?:般的|一样的|似的|般)\S*/g, ' ')
            .replace(/(?:心里|胸口|心脏|脑中|全身|整个身体|整个人)(?:一紧|一震|一颤|发麻|发烫|燃烧|沸腾|融化|炸开|碎了)/g, ' ')
            .replace(/像.{0,5}(?:触电|火烧|刀割|针刺|雷击|电击)/g, ' ')
            .replace(/\s{2,}/g, ' ').trim() || text;
    }

    // ═══════════════════════════════════════════════
    // Context Collection
    // ═══════════════════════════════════════════════

    collectContext() {
        const ctx = getContext();
        const s = this.getSettings();
        const parts = [];

        const chat = ctx.chat;
        const n = s.contextMessages || 12;
        const msgs = chat?.length ? chat.slice(-n) : [];
        const activeCharacters = new Map();
        const charNames = new Set();

        for (const msg of msgs) {
            if (msg.is_user) continue;
            const name = msg.name || ctx.name2 || '角色';
            if (charNames.has(name)) continue;
            charNames.add(name);

            let desc = s.appearanceCache[name];
            if (!desc || desc.length < 5) {
                const chars = ctx.characters || {};
                for (const [id, char] of Object.entries(chars)) {
                    if (char.name === name && char.description) {
                        desc = String(char.description)
                            .replace(/\{\{char\}\}/gi, name)
                            .replace(/\{\{user\}\}/gi, ctx.name1 || '用户')
                            .replace(/\[.*?\]/g, '')
                            .substring(0, 500);
                        desc = desc.split(/[。；\n]/).filter(line => !/[穿着披裹套穿].*[衣服装裙裤衫袍袄褂衩]/.test(line)).join('；');
                        break;
                    }
                }
            }
            if (desc && desc.length > 5) activeCharacters.set(name, desc);
        }

        if (activeCharacters.size === 0 && ctx.name2) {
            const char = ctx.characters?.[ctx.characterId];
            if (char?.description) {
                let desc = String(char.description)
                    .replace(/\{\{char\}\}/gi, ctx.name2)
                    .replace(/\{\{user\}\}/gi, ctx.name1 || '用户')
                    .replace(/\[.*?\]/g, '')
                    .substring(0, 500);
                desc = desc.split(/[。；\n]/).filter(line => !/[穿着披裹套穿].*[衣服装裙裤衫袍袄褂衩]/.test(line)).join('；');
                activeCharacters.set(ctx.name2, desc);
            }
        }

        if (activeCharacters.size > 0) {
            this._charCount = activeCharacters.size; // Store for post-processing
            const charList = [...activeCharacters.entries()].map(([n, d]) => `${n}: ${d}`).join('\n---\n');
            parts.push(`=== 以下角色外貌参考资料（共${activeCharacters.size}人——仅当聊天涉及性内容时才使用性器官描述，否则只用脸/发型/体型） ===`);
            parts.push(charList);
            parts.push('服装必须从聊天记录中提取，忽略角色设定中的默认服装');
            parts.push('=== 外貌参考结束 ===');
            parts.push(`★★★ 当前场景共有 ${activeCharacters.size} 个角色在画面中 ★★★
如果人数≥2，第2行必须使用对应的复数标签（2girls/3girls/1boy1girl/couple等），禁止使用1girl/solo focus`);
        }

        if (chat?.length) {
            parts.push('');
            parts.push('=== 聊天记录 ===');
            parts.push('时间顺序：越早越旧。只有最后2条是当前正在发生的动作。前面的只是环境背景——人物在哪里、穿着什么、有什么物品。不要把旧动作带入当前画面。');
            for (let i = 0; i < msgs.length; i++) {
                const msg = msgs[i];
                const isRecent = i >= msgs.length - 2;
                const sender = msg.is_user ? (ctx.name1 || '用户') : (msg.name || ctx.name2 || '角色');
                let text = String(msg.mes || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().substring(0, 600);
                if (s.preprocess) text = this.preprocess(text);
                const isGenPrompt = /\(masterpiece|\(best quality|\(semi-realistic|1girl|solo focus|\(POV/.test(text) && /nsfw|pussy|labia|nipples|penis/.test(text);
                if (text && text.length > 5 && !isGenPrompt) {
                    const marker = isRecent ? '当前' : '背景';
                    parts.push(`[${marker}] ${sender}: ${text}`);
                }
            }
            parts.push('=== 当前=当前动作(优先) 背景=历史(只取地点/服装/物品，忽略已结束的动作) ===');
            parts.push('警告：角色说的话里可能有大量比喻/拟人/夸张修辞（如"像小猫一样""如春风般""仿佛融化"），这些都是修辞手法，不是真实的画面内容。只提取字面意义上的物理动作和可见元素，忽略所有文学修辞。');
        }
        return parts.join('\n');
    }

    // ═══════════════════════════════════════════════
    // POV Detection
    // ═══════════════════════════════════════════════

    detectPOV() {
        const s = this.getSettings();
        if (s.pov) return true;
        return null; // Let LLM decide
    }

    // ═══════════════════════════════════════════════
    // Build System Prompt
    // ═══════════════════════════════════════════════

    buildSystemPrompt() {
        const s = this.getSettings();
        if (s.systemPromptOverride && s.systemPromptOverride.length > 20) {
            return s.systemPromptOverride;
        }
        // Use model profile's prompt builder
        if (this.modelProfiles) {
            const profileId = s.modelProfiles?.activeProfileId || 'noobai_xl_v10';
            return this.modelProfiles.buildSystemPrompt(profileId, s.intensity || '自动');
        }
        // Fallback to legacy hardcoded prompt
        return DEFAULT_SYSTEM_PROMPT;
    }

    // ═══════════════════════════════════════════════
    // LLM Call (delegates to ProviderRegistry)
    // ═══════════════════════════════════════════════

    async callLLM(sceneText) {
        const s = this.getSettings();
        const intensityStr = s.intensity || '自动';
        const autoPov = this.detectPOV();
        const povStr = autoPov === true ? '是' : autoPov === false ? '否' : '自行判断';

        const userMsg = `当前=当前画面(优先) 背景=历史(只取地点/服装/物品，忽略已结束的动作)

${sceneText}

参数: 风格=${s.style || 'WAI'}, 内容=${intensityStr}, POV=${povStr}`;

        const systemPrompt = this.buildSystemPrompt();

        // Use provider registry's fallback chain
        const result = await this.providers.execute(systemPrompt, userMsg, s);

        if (!result) {
            return { analysis: '', positive: '', negative: '', method: '无' };
        }

        // Log raw output
        this.log('--- LLM 原始输出 ---');
        this.log(result.raw.substring(0, 500));
        this.log('--- 输出结束 ---');

        const parsed = this.parseResponse(result.raw);
        parsed.provider = result.provider;
        parsed._raw = result.raw; // Preserve raw output for diagnosis
        return parsed;
    }

    // ═══════════════════════════════════════════════
    // Parse LLM Response
    // ═══════════════════════════════════════════════

    parseResponse(raw) {
        let analysis = '', pos = '', neg = '';

        if (raw.includes('[ANALYSIS]')) {
            const aParts = raw.split('[ANALYSIS]');
            if (aParts[1]) {
                analysis = aParts[1].split('[')[0].trim();
                if (analysis.length > 200) analysis = analysis.substring(0, 200);
            }
        }

        if (raw.includes('[POSITIVE]') && raw.includes('[NEGATIVE]')) {
            const parts = raw.split('[NEGATIVE]');
            pos = parts[0].replace('[POSITIVE]', '').replace(/\[ANALYSIS\][\s\S]*?\[POSITIVE\]/g, '').replace(/\[ANALYSIS\][\s\S]*/, '').trim();
            if (!pos && parts[0].includes('[POSITIVE]')) {
                pos = parts[0].split('[POSITIVE]')[1]?.trim() || '';
            }
            neg = parts[1]?.trim() || '';
        } else if (raw.includes('[NEGATIVE]')) {
            const parts = raw.split('[NEGATIVE]');
            pos = parts[0]?.replace(/\[ANALYSIS\][\s\S]*/, '').trim() || '';
            neg = parts[1]?.trim() || '';
        } else {
            pos = raw.replace(/\[ANALYSIS\][\s\S]*/, '').trim();
        }

        return { analysis, positive: pos, negative: neg };
    }

    // ═══════════════════════════════════════════════
    // Keyword Fallback
    // ═══════════════════════════════════════════════

    fallbackTags(sceneText) {
        const QUALITY_FALLBACK = {
            '写实': '(photorealistic:1.3), (realistic:1.3), (raw photo:1.2), (8k:1.2), (high detail:1.2), (sharp focus:1.2)',
            'Animagine': 'masterpiece, best quality, very aesthetic, absurdres, (soft colors:1.2), (natural colors:1.2)',
            'WAI': '(masterpiece:1.3), (best quality:1.3), (amazing quality:1.2), (very aesthetic:1.2), absurdres, (semi-realistic:1.2), (detailed:1.2), (highres:1.2), (natural skin:1.2), (skin texture:1.1)',
        };

        const s = this.getSettings();
        const tags = [QUALITY_FALLBACK[s.style] || QUALITY_FALLBACK['WAI']];

        if (this.detectPOV()) {
            tags.push('solo focus, (looking at viewer:1.5), (POV:1.4), POV, first person view');
        } else {
            tags.push('(1girl:1.4), female');
        }

        const sfwMap = {
            '长发': 'long hair', '短发': 'short hair', '双马尾': 'twintails', '马尾': 'ponytail',
            '盘发': 'hair bun', '卷发': 'wavy hair', '刘海': 'bangs', '白发': 'white hair', '金发': 'blonde hair',
            '蓝眼': 'blue eyes', '绿眼': 'green eyes', '红眼': 'red eyes', '雀斑': 'freckles', '眼镜': 'glasses',
            '苗条': 'slim', '纤细': 'slender', '丰满': 'curvy', '白皙': 'pale skin',
            '大胸': 'large breasts', '平胸': 'flat chest', '细腰': 'narrow waist', '宽臀': 'wide hips', '长腿': 'long legs',
            '校服': 'school uniform', '衬衫': 'white blouse', '毛衣': 'sweater', '裙子': 'skirt',
            '丝袜': 'pantyhose', '黑丝': 'black stockings', '过膝袜': 'thighhighs', '高跟鞋': 'high heels',
            '睡衣': 'sleepwear', '浴巾': 'towel',
            '脸红': 'blush', '微笑': 'smile', '害羞': 'embarrassed', '哭泣': 'tears', '闭眼': 'closed eyes',
            '躺着': 'lying on back', '坐着': 'sitting', '站着': 'standing', '跪着': 'kneeling', '趴着': 'on all fours',
            '教室': 'classroom', '卧室': 'bedroom', '浴室': 'bathroom', '客厅': 'living room', '厨房': 'kitchen',
            '办公室': 'office', '走廊': 'hallway', '户外': 'outdoors', '床上': 'on bed', '桌上': 'on desk',
            '白天': 'daylight', '夜晚': 'night', '黄昏': 'sunset', '月光': 'moonlight', '烛光': 'candlelight', '昏暗': 'dim lighting',
        };

        const nsfwMap = {
            '巨乳': '(huge breasts:1.3)', '内衣': 'lingerie', '裸体': 'completely nude, naked',
            '张开腿': 'spread legs', '口交': '(fellatio:1.3)', '后入': '(doggystyle:1.3)', '骑乘': '(cowgirl:1.3)',
            '自慰': '(masturbation:1.3)', '内射': '(creampie:1.3)', '阴唇': 'labia', '阴蒂': 'clitoris',
            '乳头': 'nipples', '精液': 'semen', '湿润': 'wet pussy', '爱液': 'pussy juice',
        };

        for (const [kw, tag] of Object.entries(sfwMap)) {
            if (sceneText.includes(kw)) tags.push(tag);
        }

        const hasSexInChat = /操|干|插|进入|抽送|高潮|射|口交|后入|骑乘|阴道|阴茎|阴唇|阴蒂|淫水|精液|中出|内射|做爱|性交|自慰|手淫|裸体|张开腿|阴蒂|阴唇/.test(sceneText);
        if (hasSexInChat) {
            for (const [kw, tag] of Object.entries(nsfwMap)) {
                if (sceneText.includes(kw)) tags.push(tag);
            }
            tags.push('nsfw');
        }

        return {
            positive: tags.join(', '),
            negative: 'lowres, (bad quality:1.2), (worst quality:1.2), bad anatomy, sketch, jpeg artifacts, ugly, poorly drawn, blurry, watermark, extra digits, anime style, anime coloring, cel shading, 3d render, photorealistic, raw photo, cartoon, plastic skin, airbrushed, doll-like, signature, text',
        };
    }

    // ═══════════════════════════════════════════════
    // Appearance Injection
    // ═══════════════════════════════════════════════

    injectAppearance(prompt) {
        const s = this.getSettings();
        const cache = s.appearanceCache;
        const cacheKeys = Object.keys(cache).filter(k => cache[k] && cache[k].length > 5);
        if (cacheKeys.length === 0) return prompt;

        const lines = prompt.split('\n');
        const bodyLineIdx = lines.findIndex(l => /hair|eyes|skin|breasts|build|waist|slim|curvy|face|body/i.test(l));
        if (bodyLineIdx < 0) return prompt;

        const promptText = lines.join('\n');
        const matchedChars = cacheKeys.filter(name => promptText.includes(name));
        if (matchedChars.length === 0) return prompt;

        let bodyLine = lines[bodyLineIdx];
        for (const name of matchedChars) {
            const cachedTags = cache[name].split(',').map(t => t.trim()).filter(t => t);
            if (cachedTags.length < 2) continue;
            const existingTags = bodyLine.toLowerCase();
            const firstTag = cachedTags[0].toLowerCase();
            if (!existingTags.includes(firstTag)) {
                bodyLine += `, [${name}] ` + cachedTags.join(', ');
            }
        }
        lines[bodyLineIdx] = bodyLine;
        return lines.join('\n');
    }

    injectUserAppearance(prompt) {
        const isPOV = /solo focus|POV|first person/i.test(prompt);
        if (!isPOV) return prompt;

        const hasSexTags = /pussy|labia|clitoris|penis|fellatio|blowjob|cunnilingus|missionary|doggystyle|cowgirl|creampie|nsfw/i.test(prompt);
        if (!hasSexTags) return prompt;

        const s = this.getSettings();
        let ua = s.userAppearance || '';
        if (!ua || ua.length < 3) return prompt;

        ua = ua.replace(/阴茎[^，,。]*[,，]?\s*/g, '').replace(/包皮[^，,。]*[,，]?\s*/g, '')
               .replace(/割过[^，,。]*[,，]?\s*/g, '').replace(/阴囊[^，,。]*[,，]?\s*/g, '')
               .replace(/睾丸[^，,。]*[,，]?\s*/g, '').replace(/勃起[^，,。]*[,，]?\s*/g, '').trim();

        const lines = prompt.split('\n');
        if (lines[2]) {
            lines[2] = ua + ', ' + lines[2];
        }
        return lines.join('\n');
    }

    // ═══════════════════════════════════════════════
    // Post-Processing: cleanConflicts
    // (ported from v4, 150 lines of conflict resolution)
    // ═══════════════════════════════════════════════

    cleanConflicts(prompt) {
        const changes = [];
        const addChange = (msg) => changes.push(msg);

        const hasExplicit = /pussy|labia|clitoris|penis|penetration|fellatio|blowjob|cunnilingus|missionary|doggystyle|cowgirl|creampie/i.test(prompt);

        let lines = prompt.split('\n');
        if (lines.length < 3) return { prompt, changes };

        // 0. Quality line: use model profile prefix
        const activeProfile = this.modelProfiles?.getActive();
        const qualityPrefix = activeProfile?.qualityPrefix || '(masterpiece:1.3), (best quality:1.3), absurdres';
        if (lines[0]) {
            lines[0] = qualityPrefix;
            addChange('品质行已对齐至当前模型配置');
        }

        // 0.5. Banned words
        let bannedCount = 0;
        const stripWords = ['korean aesthetic', 'realistic skin', 'anime coloring', 'cel shading', 'cartoon', 'sharp anime eyes', 'photorealistic', 'raw photo'];
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i]) continue;
            for (const w of stripWords) {
                const before = lines[i];
                lines[i] = lines[i].replace(new RegExp(`\\(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^)]*\\)\\s*,?\\s*`, 'gi'), '');
                lines[i] = lines[i].replace(new RegExp(`,\\s*${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), '');
                lines[i] = lines[i].replace(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*,?\\s*`, 'gi'), '');
                if (lines[i] !== before) bannedCount++;
            }
        }
        if (bannedCount > 0) addChange(`违禁词清理: ${bannedCount} 处`);

        // 0.6. Tag cap <= 120
        let totalTags = 0;
        for (let i = 0; i < lines.length; i++) { totalTags += (lines[i].match(/,/g) || []).length + 1; }
        if (totalTags > 120) {
            const beforeCap = totalTags;
            const trimOrder = [5, 4, 3, 0, 2, 1];
            for (const idx of trimOrder) {
                if (totalTags <= 120) break;
                if (!lines[idx]) continue;
                let tags = lines[idx].split(',').map(t => t.trim()).filter(Boolean);
                const target = Math.max(3, tags.length - (totalTags - 120));
                tags = tags.slice(0, target);
                lines[idx] = tags.join(', ');
                totalTags = 0;
                for (let j = 0; j < lines.length; j++) { totalTags += (lines[j].match(/,/g) || []).length + 1; }
            }
            addChange(`标签上限: ${beforeCap} → ${totalTags} (限制 120)`);
        }

        // Track index shift from potential subject line insertion
        let indexShift = 0;

        // 1-5: NSFW-specific conflict resolution
        if (hasExplicit) {
            // 1. Contradictory action detection
            const actionLine = lines[2] || '';
            if (/fellatio|blowjob|oral/i.test(actionLine) && /pussy|labia|clitoris|spread pussy|legs spread|spread legs/i.test(actionLine)) {
                lines[2] = actionLine.replace(/\(legs spread[^)]*\)/gi, '').replace(/\(spread legs[^)]*\)/gi, '')
                    .replace(/\(pussy[^)]*\)/gi, '').replace(/\(labia[^)]*\)/gi, '').replace(/\(clitoris[^)]*\)/gi, '')
                    .replace(/\(spread pussy[^)]*\)/gi, '').replace(/\(wet pussy[^)]*\)/gi, '').replace(/\(pussy juice[^)]*\)/gi, '');
                addChange('冲突解决: 口交 + 张开腿 → 移除性器官标签');
            }
            if (/on back/i.test(actionLine) && /kneeling/i.test(actionLine)) {
                lines[2] = actionLine.replace(/\(on back[^)]*\)/gi, '').replace(/\bon back\b/gi, '');
                addChange('冲突解决: 仰卧 + 跪姿 → 移除仰卧');
            }

            // 2. close-up / cowboy shot conflicts
            if (/close-up/i.test(prompt) && /(?:legs|spread|kneeling|lying|cowgirl|missionary|doggystyle|full body)/i.test(prompt)) {
                for (let i = 0; i < lines.length; i++) { lines[i] = lines[i].replace(/\(close-up[^)]*\)/gi, '').replace(/\bclose-up\b/gi, ''); }
                addChange('冲突解决: close-up + 全身动作 → 移除 close-up');
            }
            if (/(?:from above|from below|POV|spread|lying)/i.test(prompt)) {
                for (let i = 0; i < lines.length; i++) { lines[i] = lines[i].replace(/\(cowboy shot[^)]*\)/gi, '').replace(/\bcowboy shot\b/gi, ''); }
            }

            // 3. Auto-fill subject line
            const wholePrompt = lines.join('\n');
            if (!/(?:\dgirl|\dboy|1girl|1boy|solo focus|1other|multiple|group)/i.test(wholePrompt)) {
                const povMode = /solo focus|POV|first person/i.test(prompt);
                lines.splice(1, 0, povMode ? 'solo focus, (looking at viewer:1.5), (POV:1.4), POV, first person view' : '(1girl:1.4), female');
                indexShift = 1;
                addChange(povMode ? '自动补全: POV 主体行' : '自动补全: 1girl 主体行');
            }

            // 3b. Multi-character detection: count named characters in prompt
            const subjLine = lines[1] || '';
            const namePattern = /([一-鿿]{1,5}|[A-Z][a-zA-Z]{1,15})\s*:/g;
            const namedChars = new Set();
            let m;
            while ((m = namePattern.exec(wholePrompt)) !== null) {
                namedChars.add(m[1]); // Collect unique character names
            }
            const detectedCount = namedChars.size;

            // Belt-and-suspenders: also check engine's stored char count from collectContext
            const storedCount = this._charCount || 0;
            const effectiveCount = Math.max(detectedCount, storedCount);

            if (effectiveCount >= 2) {
                // Detect gender: look for male markers in body/action lines
                const hasMale = /penis|\b1boy\b|\bboy\b|male/i.test(wholePrompt);
                const hasFemale = /pussy|breasts|\b1girl\b|\bgirl\b|female/i.test(wholePrompt);
                const isMixed = hasMale && hasFemale;

                let expectedSubject;
                if (isMixed) {
                    const girlCount = effectiveCount - 1;
                    expectedSubject = 'couple, 1boy' + (girlCount === 1 ? '1girl' : girlCount + 'girls');
                } else if (hasMale) {
                    expectedSubject = effectiveCount + 'boys';
                } else {
                    expectedSubject = effectiveCount + 'girls';
                }

                // Remove all existing count tags, then insert correct one
                lines[1] = subjLine.replace(/\b\d+(?:girls?|boys?)\b\s*,?\s*/gi, '');
                lines[1] = expectedSubject + ', ' + lines[1];

                // Multi-character POV: keep POV, remove solo focus
                if (/solo focus/i.test(lines[1])) {
                    lines[1] = lines[1].replace(/solo focus\s*,?\s*/gi, '');
                    addChange('多人检测: 移除 solo focus（多人POV场景）');
                }
                addChange(`多人检测: ${effectiveCount}个角色 → ${expectedSubject}${isMixed ? ' (混合性别)' : ''}`);
                this.log(`多人检测: named=${namedChars.size} stored=${storedCount} → ${expectedSubject}`, 'info');
            }

            // 4. Body line cleanup (index may have shifted from subject line insertion)
            const bodyIdx = 4 + indexShift;
            const sexBodyTags = /\b(?:dark nipples|pink nipples|erect nipples|nipples|areola|labia|clitoris|pussy|penis|glans|pubic hair|wet pussy|pussy juice|grool|semen|cum|wet)(?::\d+\.\d+)?\b/gi;
            const conflicts = /\b(?:mother|motherly|maternal|warm smile|gentle eyes|gentle expression|soft eyes|soft expression|soft features|wholesome|innocent|pure|modest|proper|pregnant|pregnancy|pregnant scar|pregnant belly|pregnancy stretch marks|from behind|cowboy shot)(?::\d+\.\d+)?\b/gi;
            if (lines[bodyIdx]) {
                lines[bodyIdx] = lines[bodyIdx].replace(sexBodyTags, '').replace(conflicts, '');
                let bodyTags = lines[bodyIdx].split(',').map(t => t.trim()).filter(Boolean);
                bodyTags = [...new Set(bodyTags)].slice(0, 18);
                lines[bodyIdx] = bodyTags.join(', ');
            }

            // 5. Action line cleanup
            if (lines[2]) lines[2] = lines[2].replace(conflicts, '');
        }

        // 5c. Remove duplicate/conflicting count tags in subject line
        const subjLineClean = lines[1] || '';
        const countTags = subjLineClean.match(/\b\d+(?:girls?|boys?)\b/gi);
        if (countTags && countTags.length > 1) {
            const tagsWithNum = countTags.map(t => ({ raw: t, num: parseInt(t.match(/\d+/)[0]) || 1 }));
            const maxCount = Math.max(...tagsWithNum.map(t => t.num));
            let cleaned = subjLineClean;
            tagsWithNum.forEach(t => {
                if (t.num !== maxCount) cleaned = cleaned.replace(new RegExp('\\b' + t.raw + '\\b\\s*,?\\s*', 'gi'), '');
            });
            lines[1] = cleaned;
            addChange(`重复人数标签: 保留最高 ${maxCount}`);
        }
        // Also remove solo focus when multi-character
        if (lines[1] && /2girls|3girls|2boys|\d+boys|1boy\ds|1boy\dgirl|multiple|couple/.test(lines[1])) {
            lines[1] = lines[1].replace(/solo focus\s*,?\s*/gi, '');
        }
        const subjRegex = /\(1girl|\(1boy|solo focus/;
        let firstSubj = -1;
        for (let i = 0; i < lines.length; i++) {
            if (subjRegex.test(lines[i])) { firstSubj = i; break; }
        }
        if (firstSubj >= 0) {
            let dupCount = 0;
            for (let i = firstSubj + 1; i < lines.length; i++) {
                if (subjRegex.test(lines[i])) { lines[i] = ''; dupCount++; }
            }
            if (dupCount > 0) {
                lines = lines.filter(l => l.trim() !== '');
                addChange(`重复主体行: 移除 ${dupCount} 行`);
            }
        }

        // 6. Auto-add "on back" for spread legs
        if (/(?:spread legs|legs spread)/i.test(lines[2] || '') && !/(?:on back|lying|on bed|reclining)/i.test(lines[2] || '')) {
            lines[2] = '(on back:1.3), (lying:1.2), ' + lines[2];
            addChange('自动补全: spread legs → +on back+lying');
        }

        // 7. Scene keywords to action line
        const sceneIdx = 5 + indexShift;
        if (lines[sceneIdx]) {
            const sceneKeywords = lines[sceneIdx].match(/\b(?:desk|bed|chair|mirror|window|candle|lamp|sunlight|moonlight|night|table|wall|floor|shower|bathtub|sofa|couch|pillow|sheets)\b/gi);
            if (sceneKeywords && sceneKeywords.length > 0) {
                const unique = [...new Set(sceneKeywords)].slice(0, 3);
                if (!new RegExp(unique.join('|'), 'i').test(lines[2] || '')) {
                    lines[2] = (lines[2] || '') + ', ' + unique.join(', ');
                    addChange(`场景关键词前移: ${unique.join(', ')}`);
                }
            }
        }

        // 8. Global cleanup
        let result = lines.join('\n');
        result = result.replace(/\(\):\s*[\d.]+\)/g, '').replace(/\(:\s*[\d.]+\)/g, '');
        result = result.replace(/\(\s+in mouth[^)]*\)/gi, '');
        result = result.replace(/\(\s+[^)]*\)/g, '');
        result = result.replace(/\(\w+\s+\)/g, '');
        result = result.replace(/\(, /g, '(').replace(/, ,/g, ',').replace(/,\s*,/g, ',').replace(/^\s*,\s*/gm, '').replace(/,\s*$/gm, '');

        // POV hand tag cleanup
        if (/POV|first person view/i.test(result)) {
            result = result.replace(/\(gripping hands[^)]*\)/gi, '').replace(/\(holding wrist[^)]*\)/gi, '');
            result = result.replace(/\(holding hands[^)]*\)/gi, '').replace(/\(grabbing[^)]*\)/gi, '');
        }
        result = result.replace(/\(\s*\)\s*,?\s*/g, '').replace(/, ,/g, ',').replace(/,\s*,/g, ',').replace(/^\s*,\s*/gm, '').replace(/,\s*$/gm, '');

        // 9. Global tag dedup (cross-line)
        let dedupCount = 0;
        const dedupLines = result.split('\n');
        const seen = new Set();
        for (let i = 0; i < dedupLines.length; i++) {
            if (!dedupLines[i]) continue;
            let tags = dedupLines[i].split(',').map(t => t.trim()).filter(Boolean);
            const before = tags.length;
            tags = tags.filter(t => {
                const base = t.replace(/[()]/g, '').split(':')[0].trim().toLowerCase();
                if (!base || base.length < 2) return false;
                if (seen.has(base)) return false;
                seen.add(base);
                return true;
            });
            dedupCount += before - tags.length;
            dedupLines[i] = tags.join(', ');
        }
        if (dedupCount > 0) addChange(`标签去重: ${dedupCount} 个重复标签`);

        result = dedupLines.join('\n');
        return { prompt: result, changes };
    }

    // ═══════════════════════════════════════════════
    // Content Level Gate
    // ═══════════════════════════════════════════════

    enforceContentLevel(prompt, chatContext) {
        const s = this.getSettings();
        const level = s.intensity || '自动';

        if (level === '显式') return prompt;

        let effectiveLevel = level;
        if (level === '自动') {
            const hasSexInChat = /操|干|插|进入|抽送|高潮|射|舔阴|口交|乳交|后入|骑乘|传教士|阴道|阴茎|阴唇|阴蒂|淫水|精液|中出|内射|做爱|性交|交合|插入|进入她|进入你|插进去|干你|干我|操你|操我|肏|骚|浪|叫床|呻吟|扭腰|挺腰|抽插|顶|蹭下面|摸下面|摸那里|抠|塞进去|整根|龟头|包皮|勃起|硬了|湿了|流水|泄了/i.test(chatContext || '');
            if (hasSexInChat) return prompt;
            effectiveLevel = '无';
        }

        const lines = prompt.split('\n');
        const sexActs = /\b(?:fellatio|blowjob|cunnilingus|missionary|doggystyle|cowgirl|reverse cowgirl|standing doggystyle|prone bone|spoon position|facesitting|69 position|paizuri|titfuck|creampie|facial|cum on|penetration|penis in|penis entering|POV penis|own penis|erect penis)(?::\d+\.\d+)?\b/gi;
        const sexOrgans = /\b(?:pussy|labia|clitoris|penis|glans|nipples|areola)(?::\d+\.\d+)?\b/gi;
        const sexFluids = /\b(?:pussy juice|grool|semen|cum|precum)(?::\d+\.\d+)?\b/gi;
        const sexModifiers = /\b(?:spread pussy|wet pussy|tight pussy|pussy visible|cameltoe|crotch exposed|crotch|pubic area|pubic bone|groin|pelvis|no panties|braless|visible nipples|erect nipples|hard nipples|see.through|translucent clothing|sheer|upskirt|panty shot|panties visible)(?::\d+\.\d+)?\b/gi;

        if (effectiveLevel === '无') {
            for (let i = 0; i < lines.length; i++) {
                lines[i] = lines[i].replace(sexActs, '').replace(sexOrgans, '').replace(sexFluids, '').replace(sexModifiers, '');
            }
            if (lines[2]) lines[2] = '(fully clothed:1.4), (non-nude:1.4), (sfw:1.3), (clothes on:1.3), (modest:1.2), ' + lines[2];
            this.log('内容门控: 无/自动降级 → 强制SFW着装', 'info');
        } else {
            for (let i = 0; i < lines.length; i++) {
                lines[i] = lines[i].replace(sexActs, '');
            }
            this.log('内容门控: 软色情 → 去性行为，留裸露', 'info');
        }

        let result = lines.join('\n');
        result = result.replace(/,\s*,/g, ',').replace(/^\s*,\s*/, '').replace(/,\s*$/, '');
        return result;
    }

    // ═══════════════════════════════════════════════
    // Build Negative Prompt
    // ═══════════════════════════════════════════════

    buildNegative(llmNegative, chatContext = '') {
        const s = this.getSettings();
        const level = s.intensity || '自动';

        // Mirror enforceContentLevel's auto-detection to stay in sync
        let effectiveLevel = level;
        if (level === '自动') {
            const hasSex = /操|干|插|进入|抽送|高潮|射|舔阴|口交|乳交|后入|骑乘|阴道|阴茎|阴唇|阴蒂|淫水|精液|中出|内射|做爱|性交|交合|插入|进入她|进入你|插进去|干你|干我|操你|操我|肏|骚|浪|叫床|呻吟|扭腰|挺腰|抽插|顶|蹭下面|摸下面|摸那里|抠|塞进去|整根|龟头|包皮|勃起/i.test(chatContext || '');
            effectiveLevel = hasSex ? '显式' : '无';
        }
        const needsAntiCensor = (effectiveLevel === '显式' || effectiveLevel === '软色情');

        let base = '';
        if (llmNegative && llmNegative.length > 10) {
            base = llmNegative;
        } else {
            base = 'lowres, (bad quality:1.2), (worst quality:1.2), bad anatomy, ugly, blurry, watermark, extra digits, signature, text';
        }

        // Only prepend anti-censor for explicit/soft content
        if (needsAntiCensor) {
            // Clean any stray anti-nudity tags from LLM's negative output
            base = base.replace(/\bnsfw\b,?\s*/gi, '')
                       .replace(/\bnude\b,?\s*/gi, '')
                       .replace(/\bnaked\b,?\s*/gi, '')
                       .replace(/\b(fully\s*)?clothed\b,?\s*/gi, '')
                       .replace(/\bnon-nude\b,?\s*/gi, '')
                       .replace(/\bmodest\b,?\s*/gi, '')
                       .replace(/\bsfw\b,?\s*/gi, '');
            return ANTI_CENSOR_TAGS + ', ' + base;
        }
        // SFW scene: add anti-nudity protection (critical for uncensored models like WAI)
        return 'nsfw, nude, naked, nipples, ' + base;
    }

    // ═══════════════════════════════════════════════
    // Appearance Extraction
    // ═══════════════════════════════════════════════

    /**
     * Extract appearance tags from a character card.
     * @param {string} [charName] - Character name (auto-detected from context if omitted)
     * @param {string} [charDescription] - Character description (auto-detected if omitted)
     * @returns {Promise<boolean>} true if extraction succeeded
     */
    async extractAppearance(charName, charDescription) {
        let name = charName;
        let desc = charDescription;

        // Auto-detect from current context if not provided
        if (!name || !desc) {
            const ctx = getContext();
            name = name || ctx.name2 || '未知角色';
            const char = ctx.characters?.[ctx.characterId];
            desc = desc || char?.description || '';
        }

        if (!desc) { this.log('该角色无描述', 'error'); return false; }

        this.log('正在提取外貌: ' + name, 'info');

        const extractMsg = `从角色设定中提取永久外貌特征（这些特征在任何场景都不变）。只输出英文 Danbooru 标签，逗号分隔。

角色设定:
${desc.substring(0, 1500)}

要求:
- 只提取永久特征: 发色/发型/瞳色/肤色/脸型/体型/胸部大小/身高等
- 不要提取: 服装/饰品/妆容/表情（这些会随场景变化）
- 使用精确标签: black hair, long hair, brown eyes, pale skin, medium breasts, slim waist, oval face, sharp nose 等
- 关键特征加 (feature:1.2) 权重
- 输出 10-20 个标签即可，宁少勿多
- 不要 asian/chinese/east asian 标签
- 只输出标签，不要解释文字`;

        const s = this.getSettings();
        const primaryProvider = s.provider;
        const provider = this.providers.get(primaryProvider);

        if (!provider || !provider.isConfigured(s)) {
            this.log('无法提取外貌: Provider 未配置', 'error');
            return false;
        }

        try {
            const raw = await provider.call('You are a character appearance extractor. Output only Danbooru tags.', extractMsg, s);
            if (raw && raw.length > 5) {
                const clean = raw.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                s.appearanceCache[name] = clean;
                saveSettingsDebounced();
                this.log('外貌已缓存: ' + clean, 'info');
                const el = document.getElementById('s2p_cache');
                if (el) el.value = clean;
                return true;
            }
        } catch (e) {
            this.log('外貌提取失败 (' + name + '): ' + e.message, 'error');
        }
        return false;
    }

    // ═══════════════════════════════════════════════
    // Auto-extract on Character Switch
    // ═══════════════════════════════════════════════

    _setupAutoExtract() {
        eventSource.on(event_types.CHAT_CHANGED, () => {
            setTimeout(() => this.autoExtractOnSwitch(), 2000);
        });
    }

    async autoExtractOnSwitch() {
        const ctx = getContext();
        const charId = ctx.characterId;
        const charName = ctx.name2;
        if (!charId || !charName) return;
        if (charId === this._lastCharId) return;
        this._lastCharId = charId;

        const s = this.getSettings();
        if (s.appearanceCache[charName]?.length > 5) return;

        const now = Date.now();
        if (now - this._lastExtractTime < 10000) return;
        this._lastExtractTime = now;

        const char = ctx.characters?.[charId];
        if (char?.description) {
            this.log(`新角色「${charName}」无外貌缓存，自动提取...`, 'info');
            await this.extractAppearance();
        }
    }
}

// ═══════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════

export { S2PEngine, DEFAULT_SYSTEM_PROMPT, ANTI_CENSOR_TAGS };
