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
        negativePrefix: 'lowres, (bad quality:1.2), (worst quality:1.2), bad anatomy, sketch, jpeg artifacts, ugly, poorly drawn, blurry, watermark, extra digits, anime style, anime coloring, cel shading, 3d render, photorealistic, raw photo, cartoon, plastic skin, airbrushed, doll-like, signature, text',
        styleNotes: '2.5D 半写实韩漫风格。禁止: anime style, anime coloring, cel shading, cartoon, photorealistic, raw photo, 3d render',
        recommendedSteps: 30, recommendedCfg: 5, recommendedSampler: 'euler_ancestral', recommendedScheduler: 'normal',
        recommendedSize: { width: 896, height: 1152 }, clipSkip: 2,
        vPred: false, tagLimit: 120,
        workflowFile: 'S2P_SDXL_eps.json',
        warning: null, specialTagSystem: null,
    },
    {
        id: 'noobai_xl_v10',
        name: 'NoobAI-XL v1.0',
        baseModel: 'SDXL',
        description: '通用动漫，全场景兼容',
        builtIn: true,
        promptFormat: 'danbooru',
        qualityPrefix: 'masterpiece, best quality, very aesthetic, newest, absurdres, highres',
        negativePrefix: 'worst quality, low quality, normal quality, old, early, lowres, sketch, jpeg artifacts, text, signature, watermark, artist name, copyright name, bad hands, mutated hands, blurry, (censor:1.3)',
        styleNotes: '日系动漫风格。可使用风格触发器: illust style(数字插画) / anime style(赛璐珞动画) / manga style(黑白漫画) / simple illust style(扁平风格)。禁止: photorealistic, realistic, 3d render。',
        recommendedSteps: 28, recommendedCfg: 4, recommendedSampler: 'euler', recommendedScheduler: 'simple',
        recommendedSize: { width: 1024, height: 1024 }, clipSkip: 2,
        vPred: true, tagLimit: 100,
        workflowFile: 'S2P_SDXL_vpred.json',
        warning: 'NoobAI 是 v-prediction 模型！采样器必须用 Euler+Simple，CFG 3-5，禁用 Karras! 品质标签放在提示词末尾效果更好。',
        specialTagSystem: 'noobai',
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
        warning: null, specialTagSystem: null,
    },
    {
        id: 'nutella_pie',
        name: 'Nutella Pie',
        baseModel: 'SDXL',
        description: 'Sharp Anime — 干净线稿 + 平滑着色',
        builtIn: true,
        promptFormat: 'danbooru',
        qualityPrefix: 'masterpiece, newest, absurdres, incredibly absurdres, best quality, amazing quality, very aesthetic',
        negativePrefix: 'lowres, bad anatomy, worst quality, low quality, normal quality, bad hands, mutated, extra fingers, artifacts, disfigured',
        styleNotes: '干净清晰的动漫线稿风格，平滑着色。禁止: photorealistic, 3d render, realistic skin, rough sketch',
        recommendedSteps: 30, recommendedCfg: 5, recommendedSampler: 'dpmpp_2m', recommendedScheduler: 'karras',
        recommendedSize: { width: 1024, height: 1024 }, clipSkip: 1,
        vPred: false, tagLimit: 100,
        workflowFile: 'S2P_SDXL_eps.json',
        warning: null, specialTagSystem: null,
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

    if (profile.specialTagSystem === 'noobai') {
        extraRules = '\n## NoobAI v-pred 标签体系\n★★★ 品质标签必须放在第6行末尾（所有内容标签之后），格式: [内容标签], masterpiece, best quality, very aesthetic, newest, absurdres。第1行不要放品质标签，改为放风格触发器: illust style / anime style / manga style 等。';
    } else if (profile.vPred) {
        extraRules += '\n## v-prediction 注意事项\n此模型为 v-prediction，不适用常规 Karras 风格提示。标签保持简洁，让模型自身风格主导。';
    }

    return `你是 SD 提示词专家。根据风格参数输出正确的 Danbooru 标签格式。

## 输出格式
[ANALYSIS]
用一句中文简述当前场景

[POSITIVE]
6行Danbooru标签

第1行 — ${profile.specialTagSystem === 'noobai' ? '风格触发器(<=4): 选illust style/anime style/manga style等。★★★ 品质标签放第6行末尾！★★★' : `品质+风格(<=8): ${qualityLine}`}

第2行 — 主体(<=4): 标准人数标签
  单人: 1girl+female 或 solo focus+POV+first person view
  双人: couple, (duo focus:1.3), 2girls / 1boy1girl / couple hetero / couple yuri
  三人: 3girls / 1boy2girls 等
  四人+: multiple girls, group, crowd
  ★ 多人场景必须加 (duo focus:1.3) 避免模型只画单人
  POV判断: 「你」只是观看者→POV；「你」也在画面中→客观视角。多人POV仍可用POV标签但不加solo focus

★ 角色系列标签（帮生图模型精准识别角色）:
  如果角色来自知名动漫/游戏作品，在第2行追加系列标签:
    格式: 1girl, [角色英文Danbooru名], [系列名], [其他标签]...
    示例: 1girl, hatsune miku, vocaloid, ...  或  1girl, miyamizu mitsuha, kimi no na wa, ...
    常见系列: genshin impact, hololive, blue archive, fate/grand order, kimi no na wa, one piece, naruto, vocaloid, ...
  如果角色非知名作品角色或原创，只写角色名称，不要编造系列标签。

第3行 — 姿势+表情(<=25): ★ 多人场景核心规则 ★
  【2人及以上】按角色分别写，格式: name1: pose, expression; name2: pose, expression
  必须写出空间关系，根据场景类型选择:
    对话: facing each other, eye contact, (one sitting:1.2), (one standing:1.2)
    并肩: side by side, walking together, same direction, (arm in arm:1.2)
    对立: back to back, facing away, turning away, (arms crossed:1.1)
    教学: (one pointing:1.2), (one explaining:1.2), (one listening:1.3)
    照顾: (leaning over:1.2), (looking up:1.2), protective stance
    擦肩: passing by, glancing back, wind blowing
    围观: (in background:1.3), out of focus, crowd
    上下: (looking up at:1.2), (looking down at:1.2), height difference
  表情也要分离: 一人开心另一人害羞 / 一人严肃另一人轻松
  【单人】: 直接写姿势+表情，不必按角色分

第4行 — 服装(<=10): 多人按角色分写: name1: clothing1; name2: clothing2。同场景同制服写一次即可

第5行 — 身体+发型(<=30): 多人按角色分写: name1: hair/eyes/build; name2: hair/eyes/build。禁止混淆特征
  （性器官/体液标签规则见底部「内容级别」说明）

第6行 — ${profile.specialTagSystem === 'noobai' ? '场景+光线+构图(<=4) + ★品质标签★(<=4,末尾): ' + profile.qualityPrefix + '。然后根据人数选镜头:' : '场景+光线+视角+构图(<=8): 根据人数和场景选镜头:'}
  单人: 自由构图
  2人互动: medium shot / from side / cowboy shot（对话不用 close-up，看不清两人关系）
  3人: wide shot / from front
  4人+: wide shot / group shot / from above
  战斗: dynamic angle / from side / action shot
  亲密: POV / close-up / from above

★ 光线氛围（第6行必须包含1-2个光线标签，根据场景时间/情绪选择）:
  温馨/浪漫: warm lighting, (golden hour:1.2), (soft light:1.3), lens flare, sunset
  安静/平和: (soft lighting:1.3), (gentle light:1.2), afternoon light, (diffused light:1.2)
  悲伤/压抑: dim lighting, (cold light:1.3), overcast, grey sky, rain, (dark shadows:1.2)
  紧张/恐怖: (harsh shadows:1.3), low light, (chiaroscuro:1.2), fog, dark, (eerie:1.3)
  清新/明亮: bright lighting, morning light, sunlight, (god rays:1.2), (dappled light:1.2)
  神秘/梦幻: moonlight, (ethereal:1.3), (bioluminescence:1.2), nebula, floating dust, (starlight:1.2)
  室内人造光: fluorescent light, (lamp light:1.2), (candlelight:1.3), (warm lamp:1.2), (neon light:1.2)
  夜景户外: night, (city lights:1.2), street lamp, (neon reflection:1.1), (fireworks:1.3)
  雨天: rain, (wet ground:1.2), overcast, (reflections:1.2), (droplets:1.1)
  雾天: fog, (mist:1.2), (atmospheric perspective:1.3), ethereal
  背光/逆光: backlighting, (rim light:1.3), (silhouette:1.2), (contre-jour:1.2)
  棚拍/干净: studio lighting, (white background:1.1), (softbox:1.1), (clean light:1.2)
  日常: from front / wide shot

${notes}${extraRules}
## 规则
- 画面唯一依据=聊天记录。比喻/拟人忽略，只提取字面物理动作
- 单画面一个核心动作，禁止矛盾组合。不编造特征
- ★★★ 人数铁律: 如果用户消息中标注了「当前场景共有 N 个角色」，第2行必须用对应的人数标签。N≥2 时禁止使用 1girl/solo focus（即使用POV也不能用solo focus）；必须使用 Ngirls 或 1boy(N-1)girls 等正确标签
- 多人场景: 以聊天记录中明确在场的角色为准，不编造不在场角色
- ★ 多人防混合: 负向词中必须含 duplicate, bilateral symmetry, (blending:1.3) 防止角色特征互相污染
- 性内容标签的位置由底部「内容级别」说明决定，严格遵守

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
一段 100-250 字英文画面描述，自然段落格式：
  构图和视角、人物外貌姿势表情、服装细节（以聊天记录为准）、场景环境物品
  光线氛围（★ 必须包含，根据场景情绪选择）:
    温馨→warm golden hour lighting, soft glow, lens flare
    安静→soft diffused lighting, gentle afternoon light
    悲伤→cold dim lighting, overcast grey sky, rain
    紧张→harsh shadows, low light, fog, chiaroscuro
    清新→bright morning sunlight, god rays, dappled light
    神秘→ethereal moonlight, bioluminescence, starlight
    室内→warm lamp light, candlelight, fluorescent, neon

★ 多人场景（2人及以上）:
  用空间位置描述每个角色，句式: "On the left, [name1] is [action] with [expression]. On the right, [name2] [action] with [expression]. They are [facing each other / standing side by side / one behind the other]."
  根据场景选构图: 对话→medium shot from side，餐桌→wide shot from above，并肩→wide shot from front，战斗→dynamic angle，亲密→close-up

★ 角色系列标签:
  如果角色是知名动漫/游戏角色，在描述开头写 "An illustration of [character] from [series], ..."
  原创角色不需要加系列标签

品质词前缀: ${profile.qualityPrefix}
${notes}
## 规则
- 画面唯一依据=聊天记录。比喻/拟人忽略
- 不编造特征。描述具体可视化
- 多人场景: 以聊天记录中明确在场的角色为准
- 知名角色加系列标签，原创角色不加

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
        case '无':
            return `## 内容级别: SFW
当前为全年龄场景。所有6行均禁止任何性相关标签。
- 第3行: 禁止性行为标签
- 第5行: 禁止性器官/体液标签，身体描述限于脸/发型/体型
- 第6行: 禁止性暗示场景描述
人物必须保持着装完整。`;

        case '软色情':
            return `## 内容级别: 软色情
允许裸露和性感氛围，但无明确性行为。
- 第3行: 允许 suggestive pose, 但禁止性行为标签 (禁止: missionary/doggystyle/cowgirl/fellatio/blowjob/cunnilingus/creampie 等)
- 第4行: 允许 lingerie, underwear, partially clothed, completely nude 等
- 第5行: 允许体型描述(large breasts, curvy, slim waist 等)，允许裸露状态(nude, bare)，禁止性器官标签(pussy/labia/penis/glans/nipples 等)
- 第6行: 允许 dim lighting, bedroom, on bed`;

        case '显式':
            return `## ★★★ 内容级别: 显式 — 必须包含性器官标签 ★★★

⚠️ 这是硬性要求，不是建议。性器官标签是画面核心，缺少会导致生成结果完全不正确。

第3行(姿势+表情) — 必须包含性行为标签:
  权重1.3。从聊天记录中提取当前发生的性行为，选择对应标签（必须至少一个）:
    missionary(传教士) / doggystyle(后入) / cowgirl(骑乘) / fellatio+blowjob(口交) / cunnilingus(舔阴) / spoon(侧入) / masturbation+fingering(自慰) / creampie(中出)
  配合表情: ahegao, orgasm, embarrassed, tears, closed eyes, open mouth, tongue out

第5行(身体) — ★★★ 必须包含性器官标签 ★★★:
  根据画面中可见的身体部位，必须至少包含以下标签之一（权重1.3）:
    女性器官: pussy, labia, clitoris, (spread pussy:1.3), (wet pussy:1.2)
    男性器官: penis, glans, (erect penis:1.3)
    共通器官: nipples, (erect nipples:1.2)
  体液标签（权重1.2）: pussy juice, semen, cum, saliva, sweat, grool — 根据场景添加
  状态标签: erect, wet, parted, spread, penetration, inside
  多人时必须按角色分别列出各自可见的性器官: name1: pussy/labia; name2: penis/glans

第6行(场景):
  必须包含 POV / first person view / close-up / from above / on bed / mirror 中的适当标签。POV由你判断。`;

        default: // 自动
            return `## 内容级别: 自动判断
根据聊天内容自行判断当前是否为 NSFW 场景：
- 如果是 SFW 日常场景(吃饭/写作业/运动/逛街等)：所有行的性标签禁止，即使角色设定中有性器官描写也不使用。
- 如果涉及性内容：按显式规则处理（第3行可含性行为，第5行可含性器官/体液）。`;
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
        if (!s.modelProfiles) s.modelProfiles = { custom: [], activeProfileId: 'noobai_xl_v10' };
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
