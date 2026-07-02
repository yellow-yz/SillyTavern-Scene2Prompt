/**
 * Scene2Prompt v1.2 — Model Profiles
 *
 * 模型配置文件：定义每个生图模型的提示词格式、推荐参数、风格描述。
 * 支持 danbooru / natural / mixed 三种提示词格式。
 */

import { extension_settings } from '../../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';

// ═══════════════════════════════════════════════════════════
// Built-in Model Profiles (8)
// ═══════════════════════════════════════════════════════════

const BUILT_IN_PROFILES = [
    {
        id: 'wai_illustrious_v140',
        name: 'WAI Illustrious v1.4',
        baseModel: 'SDXL',
        description: '韩漫半写实，精致人体，NSFW 出色',
        builtIn: true, promptFormat: 'danbooru',
        qualityPrefix: '(masterpiece:1.3), (best quality:1.3), (amazing quality:1.2), (very aesthetic:1.2), absurdres, (uncensored:1.4), (no censor:1.3), (semi-realistic:1.2), (detailed:1.2), (highres:1.2), (natural skin:1.2), (skin texture:1.1)',
        negativePrefix: 'lowres, (bad quality:1.2), (worst quality:1.2), bad anatomy, sketch, jpeg artifacts, ugly, poorly drawn, (censored:1.8), (mosaic:1.8), blurry, watermark, extra digits, anime style, anime coloring, cel shading, 3d render, photorealistic, raw photo, cartoon, plastic skin, airbrushed, doll-like, signature, text',
        styleNotes: '2.5D 半写实韩漫风格。禁止: anime style, anime coloring, cel shading, cartoon, sharp anime eyes, photorealistic, raw photo, 3d render',
        recommendedSize: { width: 896, height: 1152 },
        recommendedSteps: 30, recommendedCfg: 5, recommendedSampler: 'euler_ancestral', recommendedScheduler: 'normal',
        tagLimit: 120,
    },
    {
        id: 'noobai_xl_v10',
        name: 'NoobAI-XL v1.0',
        baseModel: 'SDXL',
        description: '通用动漫，全场景兼容',
        builtIn: true, promptFormat: 'danbooru',
        qualityPrefix: 'masterpiece, best quality, amazing quality, very aesthetic, absurdres, (detailed:1.2), (highres:1.2)',
        negativePrefix: 'lowres, (bad quality:1.2), (worst quality:1.2), bad anatomy, sketch, jpeg artifacts, ugly, poorly drawn, blurry, watermark, extra digits, signature, text',
        styleNotes: '日系动画风格，色彩鲜艳，线条干净。禁止: photorealistic, raw photo, 3d render, realistic skin',
        recommendedSize: { width: 1024, height: 1024 },
        recommendedSteps: 28, recommendedCfg: 7, recommendedSampler: 'euler_ancestral', recommendedScheduler: 'normal',
        tagLimit: 100,
    },
    {
        id: 'animagine_xl_v31',
        name: 'Animagine XL v3.1',
        baseModel: 'SDXL',
        description: '精细动漫，SFW 角色立绘和日常',
        builtIn: true, promptFormat: 'danbooru',
        qualityPrefix: 'masterpiece, best quality, great quality, very aesthetic, absurdres, newest, (soft lighting:1.2), (detailed:1.1)',
        negativePrefix: 'lowres, (bad quality:1.2), (worst quality:1.2), bad anatomy, sketch, jpeg artifacts, ugly, poorly drawn, blurry, watermark, extra digits, signature, text, nsfw, nude',
        styleNotes: '精细日系动漫，柔和色彩和光影，人物比例自然。禁止: photorealistic, raw photo, 3d render, semi-realistic, realistic skin',
        recommendedSize: { width: 1024, height: 1024 },
        recommendedSteps: 30, recommendedCfg: 7, recommendedSampler: 'euler_ancestral', recommendedScheduler: 'normal',
        tagLimit: 100,
    },
    {
        id: 'hassaku_xl_v10',
        name: 'Hassaku XL v1.0',
        baseModel: 'SDXL',
        description: '半写实，日常/风景/多人',
        builtIn: true, promptFormat: 'natural',
        qualityPrefix: '(masterpiece:1.3), (best quality:1.3), (highly detailed:1.2), (sharp focus:1.2), 8k',
        negativePrefix: 'lowres, (bad quality:1.2), (worst quality:1.2), bad anatomy, sketch, jpeg artifacts, ugly, poorly drawn, blurry, watermark, extra digits, anime style, cartoon, signature, text',
        styleNotes: '半写实风格，自然光影，柔和肤色纹理。禁止: anime style, anime coloring, cel shading, cartoon',
        recommendedSize: { width: 1024, height: 1024 },
        recommendedSteps: 25, recommendedCfg: 6, recommendedSampler: 'dpmpp_2m', recommendedScheduler: 'karras',
        tagLimit: 0,
    },
    {
        id: 'pony_diffusion_v6',
        name: 'Pony Diffusion v6',
        baseModel: 'SDXL',
        description: '欧美动漫，score 标签体系',
        builtIn: true, promptFormat: 'danbooru',
        qualityPrefix: 'score_9, score_8_up, score_7_up, score_6_up, source_anime, rating_safe, best quality, highly detailed, absurdres',
        negativePrefix: 'score_4, score_3, score_2, score_1, (bad quality:1.2), (worst quality:1.2), bad anatomy, sketch, blurry, watermark, signature, text, 3d, realistic',
        styleNotes: '欧美动漫风格。使用 Pony score 标签体系（score_9 最高）。禁止: 3d, realistic, photorealistic',
        recommendedSize: { width: 1024, height: 1024 },
        recommendedSteps: 30, recommendedCfg: 7, recommendedSampler: 'euler_ancestral', recommendedScheduler: 'normal',
        tagLimit: 100,
    },
    {
        id: 'sdxl_base_10',
        name: 'SDXL Base 1.0',
        baseModel: 'SDXL',
        description: '真实照片风，写实肖像/风景',
        builtIn: true, promptFormat: 'natural',
        qualityPrefix: '(masterpiece:1.4), (best quality:1.4), (photorealistic:1.3), (realistic:1.3), (raw photo:1.2), (8k:1.2), (high detail:1.2), (sharp focus:1.2)',
        negativePrefix: 'lowres, (bad quality:1.2), (worst quality:1.2), bad anatomy, sketch, jpeg artifacts, ugly, poorly drawn, blurry, watermark, extra digits, anime, cartoon, 3d render, cgi, doll, plastic, airbrushed, signature, text',
        styleNotes: '真实照片风格，自然光线、皮肤纹理、景深效果。禁止: anime, cartoon, 3d render, illustration, painting, drawing',
        recommendedSize: { width: 1024, height: 1024 },
        recommendedSteps: 25, recommendedCfg: 7, recommendedSampler: 'dpmpp_2m', recommendedScheduler: 'karras',
        tagLimit: 0,
    },
    {
        id: 'illustrious_xl_v10',
        name: 'Illustrious-XL v1.0',
        baseModel: 'SDXL',
        description: '日系插画，透明感，清新画面',
        builtIn: true, promptFormat: 'danbooru',
        qualityPrefix: 'masterpiece, best quality, amazing quality, very aesthetic, absurdres, (soft lighting:1.2), (pastel colors:1.2), (delicate:1.2)',
        negativePrefix: 'lowres, (bad quality:1.2), (worst quality:1.2), bad anatomy, sketch, jpeg artifacts, ugly, poorly drawn, blurry, watermark, extra digits, photorealistic, 3d render, signature, text',
        styleNotes: '日系透明感插画，柔光、淡色系、细腻笔触。禁止: photorealistic, raw photo, 3d render, realistic skin, heavy shadows, dark theme',
        recommendedSize: { width: 1024, height: 1024 },
        recommendedSteps: 28, recommendedCfg: 7, recommendedSampler: 'euler_ancestral', recommendedScheduler: 'normal',
        tagLimit: 100,
    },
    {
        id: 'custom',
        name: '自定义模型',
        baseModel: '通用',
        description: '自行配置所有参数',
        builtIn: true, promptFormat: 'danbooru',
        qualityPrefix: 'masterpiece, best quality, amazing quality, very aesthetic, absurdres',
        negativePrefix: 'lowres, (bad quality:1.2), (worst quality:1.2), bad anatomy, sketch, blurry, watermark, signature, text',
        styleNotes: '',
        recommendedSize: { width: 1024, height: 1024 },
        recommendedSteps: 20, recommendedCfg: 7, recommendedSampler: 'euler', recommendedScheduler: 'normal',
        tagLimit: 80,
    },
];

// ═══════════════════════════════════════════════════════════
// Prompt builders per format
// ═══════════════════════════════════════════════════════════

function buildDanbooruPrompt(profile) {
    return `## 输出格式
[ANALYSIS]
用一句中文简述当前场景（人物在做什么、情绪氛围、为什么这样判断）

[POSITIVE]
6行Danbooru标签

第1行 — 品质+风格(<=8标签): 使用品质标签: ${profile.qualityPrefix}
第2行 — 主体(<=4标签): 正确的人数标签。单人: 1girl+female 或 solo focus+POV; 多人: 2girls/3girls/1boy2girls等标准标签
第3行 — 姿势+表情(<=25标签): 多人时每人写不同的姿势天然分离
第4行 — 服装(<=10标签): 以聊天记录为准
第5行 — 身体+发型(<=30标签): 多人时按角色分写。禁止性器官/液体
第6行 — 场景+光线+视角+构图(<=8标签)

${profile.styleNotes ? '## 风格要求\n' + profile.styleNotes + '\n' : ''}
## 规则
- 画面唯一依据=聊天记录当前发生的事。角色外貌是参考不是指令。比喻/拟人忽略，只提取字面物理动作
- 单画面一个核心动作，禁止矛盾组合。不编造特征。close-up时不写全身姿势
- SFW场景（吃饭/写作业/运动等）即使角色设定有性器官描写也绝对不加NSFW标签

## 反向提示词
${profile.negativePrefix}

输出: [POSITIVE]...[NEGATIVE]...`;
}

function buildNaturalPrompt(profile) {
    return `你是 SD 提示词专家。用一段流畅的英文描述当前画面。

## 输出格式
[ANALYSIS]
用一句中文简述当前场景

[POSITIVE]
一段 100-250 字的英文画面描述，自然段落格式，包含：构图和视角（wide shot / close-up / POV 等）、人物外貌姿势表情、服装细节（以聊天记录为准）、场景环境物品、光照氛围
品质词前缀: ${profile.qualityPrefix}

${profile.styleNotes ? '## 风格要求\n' + profile.styleNotes + '\n' : ''}
## 规则
- 画面唯一依据=聊天记录。比喻/拟人忽略，只提取字面物理动作
- 不编造文本中没有的特征。描述具体可视化，避免抽象形容词

## 反向提示词
${profile.negativePrefix}

输出: [POSITIVE]...[NEGATIVE]...`;
}

function buildMixedPrompt(profile) {
    return `你是 SD 提示词专家。用品质标签 + 英文描述输出画面。

## 输出格式
[ANALYSIS]
用一句中文简述当前场景

[POSITIVE]
第1行: ${profile.qualityPrefix}
第2行及以后: 自然英文描述，100-200 字，段落格式，包含构图、人物、服装、场景、光照

${profile.styleNotes ? '## 风格要求\n' + profile.styleNotes + '\n' : ''}
## 规则
- 画面唯一依据=聊天记录。比喻/拟人忽略。不编造特征

## 反向提示词
${profile.negativePrefix}

输出: [POSITIVE]...[NEGATIVE]...`;
}

// ═══════════════════════════════════════════════════════════
// Content block builder
// ═══════════════════════════════════════════════════════════

function buildContentBlock(intensity) {
    switch (intensity) {
        case '无':
            return '## 内容级别: SFW\n当前场景为全年龄向。禁止任何性相关标签。人物保持着装完整。';
        case '软色情':
            return '## 内容级别: 软色情\n允许裸露（nude, naked, bare shoulders 等）和内衣/泳装，但禁止任何性行为标签。';
        case '显式':
            return `## 内容级别: 显式\n允许全部标签包括性行为。参考: 体位=missionary/doggystyle/cowgirl/fellatio/blowjob/cunnilingus/spoon/masturbation/creampie(权重1.3)。器官=pussy/labia/clitoris/nipples/penis/glans(权重1.3)。体液=pussy juice/semen/cum/saliva(权重1.2)。一个场景一个体位。POV模式由你根据场景判断。`;
        case '自动':
        default:
            return '## 内容级别: 自动判断\n根据聊天内容自行判断是否为NSFW。SFW场景（吃饭/写作业/运动等）即使角色设定有性器官描写也绝对不加NSFW标签。';
    }
}

// ═══════════════════════════════════════════════════════════
// Model Profile Manager
// ═══════════════════════════════════════════════════════════

class ModelProfileManager {
    constructor(moduleName = 'scene2prompt') {
        this.moduleName = moduleName;
    }

    _settings() {
        if (!extension_settings[this.moduleName]) {
            extension_settings[this.moduleName] = {};
        }
        const s = extension_settings[this.moduleName];
        if (!s.modelProfiles) {
            s.modelProfiles = { custom: [], activeProfileId: BUILT_IN_PROFILES[0].id };
        }
        return s;
    }

    getAll() {
        const s = this._settings();
        return [...BUILT_IN_PROFILES, ...(s.modelProfiles.custom || [])];
    }

    get(id) {
        const builtIn = BUILT_IN_PROFILES.find(p => p.id === id);
        if (builtIn) return builtIn;
        const s = this._settings();
        return (s.modelProfiles.custom || []).find(p => p.id === id);
    }

    getActive() {
        const s = this._settings();
        return this.get(s.modelProfiles.activeProfileId) || BUILT_IN_PROFILES[0];
    }

    /** Build full system prompt for a profile + content level */
    buildSystemPrompt(profileId, contentLevel = '自动') {
        const profile = this.get(profileId) || BUILT_IN_PROFILES[0];
        let prompt;
        switch (profile.promptFormat) {
            case 'natural': prompt = buildNaturalPrompt(profile); break;
            case 'mixed':   prompt = buildMixedPrompt(profile); break;
            default:        prompt = buildDanbooruPrompt(profile); break;
        }
        const contentBlock = buildContentBlock(contentLevel);
        if (contentBlock) prompt += '\n\n' + contentBlock;
        return prompt;
    }

    /** Save current profile as custom */
    save(name) {
        const s = this._settings();
        const active = this.getActive();
        if (!active) return null;
        const id = 'custom_profile_' + Date.now();
        const profile = JSON.parse(JSON.stringify(active));
        profile.id = id; profile.name = name; profile.builtIn = false;
        profile.description = '自定义模型配置';
        s.modelProfiles.custom.push(profile);
        s.modelProfiles.activeProfileId = id;
        saveSettingsDebounced();
        return id;
    }

    delete(id) {
        const s = this._settings();
        s.modelProfiles.custom = (s.modelProfiles.custom || []).filter(p => p.id !== id);
        if (s.modelProfiles.activeProfileId === id) s.modelProfiles.activeProfileId = BUILT_IN_PROFILES[0].id;
        saveSettingsDebounced();
    }

    export(id) {
        const p = this.get(id);
        if (!p) return null;
        return JSON.stringify({
            name: p.name, description: p.description, baseModel: p.baseModel,
            promptFormat: p.promptFormat, qualityPrefix: p.qualityPrefix,
            negativePrefix: p.negativePrefix, styleNotes: p.styleNotes,
            recommendedSize: p.recommendedSize, recommendedSteps: p.recommendedSteps,
            recommendedCfg: p.recommendedCfg, recommendedSampler: p.recommendedSampler,
            recommendedScheduler: p.recommendedScheduler, tagLimit: p.tagLimit,
            exportedFrom: 'Scene2Prompt v1.2', exportedAt: new Date().toISOString(),
        }, null, 2);
    }

    import(json) {
        let data;
        try { data = JSON.parse(json); } catch (e) { throw new Error('JSON 解析失败'); }
        if (!data.name) throw new Error('缺少 name 字段');
        const s = this._settings();
        const id = 'imported_profile_' + Date.now();
        s.modelProfiles.custom.push({
            id, builtIn: false, name: data.name,
            description: data.description || '导入的模型配置',
            baseModel: data.baseModel || '通用',
            promptFormat: data.promptFormat || 'danbooru',
            qualityPrefix: data.qualityPrefix || 'masterpiece, best quality',
            negativePrefix: data.negativePrefix || '',
            styleNotes: data.styleNotes || '',
            recommendedSize: data.recommendedSize || { width: 1024, height: 1024 },
            recommendedSteps: data.recommendedSteps || 20,
            recommendedCfg: data.recommendedCfg || 7,
            recommendedSampler: data.recommendedSampler || 'euler',
            recommendedScheduler: data.recommendedScheduler || 'normal',
            tagLimit: data.tagLimit ?? 80,
        });
        saveSettingsDebounced();
        return id;
    }
}

export { ModelProfileManager, BUILT_IN_PROFILES };
