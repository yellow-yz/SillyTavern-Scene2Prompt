/**
 * Scene2Prompt v1.2 — Model Profiles (Civitai-Verified)
 *
 * 基于 Civitai 官方推荐参数，每个模型配置自包含：
 * 提示词格式、品质标签、推荐参数、特殊规则、注意事项。
 */

import { extension_settings } from '../../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';

// ═══════════════════════════════════════════════════════════
// Built-in Model Profiles (8, verified against Civitai)
// ═══════════════════════════════════════════════════════════

const BUILT_IN_PROFILES = [
    {
        id: 'wai_illustrious_v140',
        name: 'WAI Illustrious v1.4',
        baseModel: 'SDXL',
        description: '韩漫半写实，精致人体',
        builtIn: true,
        promptFormat: 'danbooru',
        qualityPrefix: '(masterpiece:1.3), (best quality:1.3), (amazing quality:1.2), (very aesthetic:1.2), absurdres, (detailed:1.2), (highres:1.2), (natural skin:1.2), (skin texture:1.1)',
        negativePrefix: 'lowres, (bad quality:1.2), (worst quality:1.2), bad anatomy, sketch, jpeg artifacts, ugly, poorly drawn, (censored:1.8), (mosaic:1.8), blurry, watermark, extra digits, anime style, anime coloring, cel shading, 3d render, photorealistic, raw photo, cartoon, plastic skin, airbrushed, doll-like, signature, text',
        styleNotes: '2.5D 半写实韩漫风格。禁止: anime style, anime coloring, cel shading, cartoon, photorealistic, raw photo, 3d render',
        recommendedSteps: 30, recommendedCfg: 5, recommendedSampler: 'euler_ancestral', recommendedScheduler: 'normal',
        recommendedSize: { width: 896, height: 1152 }, clipSkip: 2,
        vPred: false, tagLimit: 120,
        warning: null,
        specialTagSystem: null,
    },
    {
        id: 'noobai_xl_v10',
        name: 'NoobAI-XL v1.0',
        baseModel: 'SDXL',
        description: '通用动漫，全场景兼容',
        builtIn: true,
        promptFormat: 'danbooru',
        qualityPrefix: 'masterpiece, best quality, newest, absurdres, highres',
        negativePrefix: 'nsfw, worst quality, old, early, low quality, lowres, signature, username, logo, bad hands, mutated hands, sketch, jpeg artifacts, scan artifacts',
        styleNotes: '日系动画风格。提示词简短即可，让模型主导生成。禁止: photorealistic, raw photo, 3d render, realistic skin',
        recommendedSteps: 28, recommendedCfg: 4.5, recommendedSampler: 'euler', recommendedScheduler: 'normal',
        recommendedSize: { width: 1024, height: 1024 }, clipSkip: 2,
        vPred: true, tagLimit: 100,
        warning: 'NoobAI 是 v-prediction 模型！禁用 Karras 系列采样器（DPM++ 2M Karras 等），CFG 控制在 4-5，超过 6 会炸图。',
        specialTagSystem: null,
    },
    {
        id: 'animagine_xl_v31',
        name: 'Animagine XL v3.1',
        baseModel: 'SDXL',
        description: '精细动漫，SFW 角色立绘',
        builtIn: true,
        promptFormat: 'danbooru',
        qualityPrefix: 'masterpiece, best quality, very aesthetic, absurdres, newest',
        negativePrefix: 'nsfw, lowres, (bad), text, error, worst quality, jpeg artifacts, low quality, watermark, unfinished, displeasing, oldest, early, chromatic aberration, signature, extra digits, artistic error, username, scan',
        styleNotes: '精细日系动漫，Danbooru 标签格式。可叠加 quality/year/rating 标签控制画风和年代感。禁止: photorealistic, raw photo, 3d render, realistic skin',
        recommendedSteps: 28, recommendedCfg: 6, recommendedSampler: 'euler_ancestral', recommendedScheduler: 'normal',
        recommendedSize: { width: 1024, height: 1024 }, clipSkip: 2,
        vPred: false, tagLimit: 100,
        warning: null,
        specialTagSystem: null,
    },
    {
        id: 'hassaku_xl_v10',
        name: 'Hassaku XL v1.0',
        baseModel: 'SDXL',
        description: '鲜艳明亮动漫，风景/多人',
        builtIn: true,
        promptFormat: 'danbooru',
        qualityPrefix: 'masterpiece, best quality, newest, absurdres, highres, detailed',
        negativePrefix: 'worst quality, bad quality, low quality, normal quality, signature, blurry, bad anatomy, bad hands, missing limb, cropped, jpeg artifacts, monochrome, text, watermark, logo, mutated, disfigured, bad feet, ugly',
        styleNotes: '鲜艳明亮的动漫风格。标签顺序: 角色人数 → 角色名 → 姿势/构图 → 其他。提示词精简，不要堆砌。禁止: photorealistic, 3d render, realistic skin',
        recommendedSteps: 28, recommendedCfg: 6, recommendedSampler: 'euler_ancestral', recommendedScheduler: 'normal',
        recommendedSize: { width: 832, height: 1216 }, clipSkip: 2,
        vPred: false, tagLimit: 100,
        warning: null,
        specialTagSystem: null,
    },
    {
        id: 'pony_diffusion_v6',
        name: 'Pony Diffusion v6',
        baseModel: 'SDXL',
        description: '欧美动漫，score 标签体系',
        builtIn: true,
        promptFormat: 'danbooru',
        qualityPrefix: 'score_9, score_8_up, score_7_up, score_6_up, score_5_up, score_4_up',
        negativePrefix: 'score_6, score_5, score_4, score_3, ugly, 3d, monochrome, greyscale, watermark, artist name, signature, text, mutated hands, bad anatomy, blurry face',
        styleNotes: '欧美动漫风格。Pony 支持自然语言 + Danbooru 标签混用。tag 出现越早权重越高。不能写实。禁止: 3d, realistic, photorealistic',
        recommendedSteps: 25, recommendedCfg: 7, recommendedSampler: 'euler_ancestral', recommendedScheduler: 'normal',
        recommendedSize: { width: 1024, height: 1024 }, clipSkip: 2,
        vPred: false, tagLimit: 100,
        warning: 'Pony 必须用 score_9, score_8_up... 评分链代替普通 quality 标签！Clip Skip 必须设为 2，否则画面模糊。',
        specialTagSystem: 'score',
    },
    {
        id: 'sdxl_base_10',
        name: 'SDXL Base 1.0',
        baseModel: 'SDXL',
        description: '真实照片风，写实肖像/风景',
        builtIn: true,
        promptFormat: 'natural',
        qualityPrefix: '(masterpiece:1.4), (best quality:1.4), (photorealistic:1.3), (realistic:1.3), (raw photo:1.2), (8k:1.2), (high detail:1.2), (sharp focus:1.2)',
        negativePrefix: 'lowres, (bad quality:1.2), (worst quality:1.2), bad anatomy, sketch, jpeg artifacts, ugly, poorly drawn, blurry, watermark, extra digits, anime, cartoon, 3d render, cgi, doll, plastic, airbrushed, signature, text',
        styleNotes: '真实照片风格。自然光线、皮肤纹理、景深效果。禁止: anime, cartoon, 3d render, illustration, painting, drawing',
        recommendedSteps: 25, recommendedCfg: 7, recommendedSampler: 'dpmpp_2m', recommendedScheduler: 'karras',
        recommendedSize: { width: 1024, height: 1024 }, clipSkip: 1,
        vPred: false, tagLimit: 0,
        warning: null,
        specialTagSystem: null,
    },
    {
        id: 'illustrious_xl_v10',
        name: 'Illustrious-XL v1.0',
        baseModel: 'SDXL',
        description: '日系插画，透明感清新',
        builtIn: true,
        promptFormat: 'danbooru',
        qualityPrefix: 'masterpiece, best quality, amazing quality, very aesthetic, absurdres, (soft lighting:1.2), (delicate:1.2)',
        negativePrefix: 'lowres, (bad quality:1.2), (worst quality:1.2), bad anatomy, sketch, jpeg artifacts, ugly, poorly drawn, blurry, watermark, extra digits, photorealistic, 3d render, signature, text',
        styleNotes: '日系透明感插画，柔光、淡色系、细腻笔触。禁止: photorealistic, raw photo, 3d render, realistic skin, heavy shadows, dark theme',
        recommendedSteps: 28, recommendedCfg: 6, recommendedSampler: 'euler_ancestral', recommendedScheduler: 'normal',
        recommendedSize: { width: 1024, height: 1024 }, clipSkip: 2,
        vPred: false, tagLimit: 100,
        warning: null,
        specialTagSystem: null,
    },
    {
        id: 'custom',
        name: '自定义模型',
        baseModel: '通用',
        description: '自行配置所有参数',
        builtIn: true,
        promptFormat: 'danbooru',
        qualityPrefix: 'masterpiece, best quality, amazing quality, very aesthetic, absurdres',
        negativePrefix: 'lowres, (bad quality:1.2), (worst quality:1.2), bad anatomy, sketch, blurry, watermark, signature, text',
        styleNotes: '',
        recommendedSteps: 20, recommendedCfg: 7, recommendedSampler: 'euler', recommendedScheduler: 'normal',
        recommendedSize: { width: 1024, height: 1024 }, clipSkip: 1,
        vPred: false, tagLimit: 80,
        warning: null,
        specialTagSystem: null,
    },
];

// ═══════════════════════════════════════════════════════════
// Prompt builders per format
// ═══════════════════════════════════════════════════════════

function buildDanbooruPrompt(profile) {
    let qualityLine = profile.qualityPrefix;
    const notes = profile.styleNotes ? '\n## 风格要求\n' + profile.styleNotes : '';
    let extraRules = '';

    if (profile.specialTagSystem === 'score') {
        extraRules = '\n## Pony 标签体系\n必须使用 score_9, score_8_up... 评分链作为品质标签。支持 source_anime/source_furry/source_pony 选择风格和 rating_safe/rating_explicit 控制分级。';
    }

    if (profile.vPred) {
        extraRules += '\n## v-prediction 注意事项\n此模型为 v-prediction，不适用常规 Karras 风格提示。标签保持简洁，让模型自身风格主导。';
    }

    return `你是 SD 提示词专家。根据风格参数输出正确的 Danbooru 标签格式。

## 输出格式
[ANALYSIS]
用一句中文简述当前场景

[POSITIVE]
6行Danbooru标签

第1行 — 品质+风格(<=8): ${qualityLine}
第2行 — 主体(<=4): 正确人数标签（1girl+female / 2girls / solo focus+POV）
第3行 — 姿势+表情(<=25): 多人时每人写不同姿势天然分离
第4行 — 服装(<=10): 以聊天记录为准
第5行 — 身体+发型(<=30): 多人按角色分写。禁止性器官/液体
第6行 — 场景+光线+视角+构图(<=8)
${notes}${extraRules}
## 规则
- 画面唯一依据=聊天记录。比喻/拟人忽略，只提取字面物理动作
- 单画面一个核心动作，禁止矛盾组合。不编造特征
- SFW 场景即使角色有性器官描写也绝对不加 NSFW 标签

## 反向提示词
${profile.negativePrefix}

输出: [POSITIVE]...[NEGATIVE]...`;
}

function buildNaturalPrompt(profile) {
    const notes = profile.styleNotes ? '\n## 风格要求\n' + profile.styleNotes : '';
    return `你是 SD 提示词专家。用一段流畅的英文描述当前画面。

## 输出格式
[ANALYSIS]
用一句中文简述当前场景

[POSITIVE]
一段 100-250 字英文画面描述，自然段落格式：构图和视角、人物外貌姿势表情、服装细节（以聊天记录为准）、场景环境物品、光照氛围
品质词前缀: ${profile.qualityPrefix}
${notes}
## 规则
- 画面唯一依据=聊天记录。比喻/拟人忽略
- 不编造特征。描述具体可视化

## 反向提示词
${profile.negativePrefix}

输出: [POSITIVE]...[NEGATIVE]...`;
}

function buildMixedPrompt(profile) {
    const notes = profile.styleNotes ? '\n## 风格要求\n' + profile.styleNotes : '';
    return `你是 SD 提示词专家。

## 输出格式
[ANALYSIS] 中文简述场景
[POSITIVE]
第1行: ${profile.qualityPrefix}
第2行+: 自然英文描述 100-200 字，段落格式
${notes}
## 规则
- 画面唯一依据=聊天记录。比喻/拟人忽略。不编造特征

## 反向提示词
${profile.negativePrefix}

输出: [POSITIVE]...[NEGATIVE]...`;
}

// ═══════════════════════════════════════════════════════════
// Content block
// ═══════════════════════════════════════════════════════════

function buildContentBlock(intensity) {
    switch (intensity) {
        case '无':   return '## 内容级别: SFW\n全年龄向。禁止任何性相关标签。人物保持着装完整。';
        case '软色情': return '## 内容级别: 软色情\n允许裸露（nude, naked, bare shoulders 等）和内衣，但禁止性行为标签。';
        case '显式':  return '## 内容级别: 显式\n允许全部标签。体位=missionary/doggystyle/cowgirl/fellatio/blowjob/cunnilingus/spoon/masturbation/creampie(权重1.3)。器官=pussy/labia/clitoris/nipples/penis/glans(权重1.3)。体液=pussy juice/semen/cum/saliva(权重1.2)。一个场景一个体位。POV由你判断。';
        default:     return '## 内容级别: 自动判断\n自行判断。SFW 场景绝对不加 NSFW 标签。';
    }
}

// ═══════════════════════════════════════════════════════════
// Manager
// ═══════════════════════════════════════════════════════════

class ModelProfileManager {
    constructor(moduleName = 'scene2prompt') { this.moduleName = moduleName; }

    _settings() {
        if (!extension_settings[this.moduleName]) extension_settings[this.moduleName] = {};
        const s = extension_settings[this.moduleName];
        if (!s.modelProfiles) s.modelProfiles = { custom: [], activeProfileId: BUILT_IN_PROFILES[0].id };
        return s;
    }

    getAll() {
        const s = this._settings();
        return [...BUILT_IN_PROFILES, ...(s.modelProfiles.custom || [])];
    }

    get(id) {
        return BUILT_IN_PROFILES.find(p => p.id === id)
            || (this._settings().modelProfiles.custom || []).find(p => p.id === id);
    }

    getActive() {
        const s = this._settings();
        return this.get(s.modelProfiles.activeProfileId) || BUILT_IN_PROFILES[0];
    }

    buildSystemPrompt(profileId, contentLevel = '自动') {
        const p = this.get(profileId) || BUILT_IN_PROFILES[0];
        let prompt;
        switch (p.promptFormat) {
            case 'natural': prompt = buildNaturalPrompt(p); break;
            case 'mixed':   prompt = buildMixedPrompt(p); break;
            default:        prompt = buildDanbooruPrompt(p); break;
        }
        const block = buildContentBlock(contentLevel);
        if (block) prompt += '\n\n' + block;
        return prompt;
    }

    save(name) {
        const s = this._settings(); const active = this.getActive(); if (!active) return null;
        const id = 'custom_profile_' + Date.now();
        const p = JSON.parse(JSON.stringify(active));
        p.id = id; p.name = name; p.builtIn = false; p.description = '自定义';
        s.modelProfiles.custom.push(p);
        s.modelProfiles.activeProfileId = id;
        saveSettingsDebounced(); return id;
    }

    delete(id) {
        const s = this._settings();
        s.modelProfiles.custom = (s.modelProfiles.custom || []).filter(p => p.id !== id);
        if (s.modelProfiles.activeProfileId === id) s.modelProfiles.activeProfileId = BUILT_IN_PROFILES[0].id;
        saveSettingsDebounced();
    }

    export(id) {
        const p = this.get(id); if (!p) return null;
        return JSON.stringify({
            name: p.name, description: p.description, baseModel: p.baseModel,
            promptFormat: p.promptFormat, qualityPrefix: p.qualityPrefix,
            negativePrefix: p.negativePrefix, styleNotes: p.styleNotes,
            recommendedSteps: p.recommendedSteps, recommendedCfg: p.recommendedCfg,
            recommendedSampler: p.recommendedSampler, recommendedScheduler: p.recommendedScheduler,
            recommendedSize: p.recommendedSize, clipSkip: p.clipSkip,
            vPred: p.vPred, tagLimit: p.tagLimit, warning: p.warning,
            specialTagSystem: p.specialTagSystem,
            exportedFrom: 'Scene2Prompt v1.2', exportedAt: new Date().toISOString(),
        }, null, 2);
    }

    import(json) {
        let d; try { d = JSON.parse(json); } catch (e) { throw new Error('JSON 解析失败'); }
        if (!d.name) throw new Error('缺少 name');
        const s = this._settings(); const id = 'imported_' + Date.now();
        s.modelProfiles.custom.push({
            id, builtIn: false, name: d.name, description: d.description || '导入', baseModel: d.baseModel || '通用',
            promptFormat: d.promptFormat || 'danbooru', qualityPrefix: d.qualityPrefix || 'masterpiece, best quality',
            negativePrefix: d.negativePrefix || '', styleNotes: d.styleNotes || '',
            recommendedSteps: d.recommendedSteps || 20, recommendedCfg: d.recommendedCfg || 7,
            recommendedSampler: d.recommendedSampler || 'euler', recommendedScheduler: d.recommendedScheduler || 'normal',
            recommendedSize: d.recommendedSize || { width: 1024, height: 1024 }, clipSkip: d.clipSkip || 1,
            vPred: d.vPred || false, tagLimit: d.tagLimit ?? 80,
            warning: d.warning || null, specialTagSystem: d.specialTagSystem || null,
        });
        saveSettingsDebounced(); return id;
    }
}

export { ModelProfileManager, BUILT_IN_PROFILES };
