# Scene2Prompt v2.6 — 场景画面生成增强

[English](#english) | [中文](#chinese)

> SillyTavern 插件：聊天上下文 → LLM → 标签 → 生图。即插即用，**选模型自动同步 ST 设置**。

---

<h1 id="chinese">中文</h1>

## 功能

- **聊天→画面**：分析对话，生成精准提示词
- **5 种 LLM**：DeepSeek / OpenAI / OpenRouter(含Claude) / Ollama / 自定义
- **9+ 模型配置**：WAI / NoobAI / Animagine / Hassaku / Pony / Nutella Pie / Kohaku / Illustrious / SDXL Base — 每个基于实测参数
- **自动检测 ComfyUI 模型**：对接 ST 接口，识别你安装的模型，自动匹配配置
- **一键同步 ST**：选模型 → 自动写 ST 的工作流/模型/CFG/Steps/采样器/分辨率
- **多人场景**：角色分离+空间关系+防特征混合
- **情绪感知**：从对话检测 35 种情绪 → 自动映射 Danbooru 表情标签
- **性格识别**：从角色卡提取 20 种性格 → 生成姿势/表情倾向
- **智能上下文**：三级分层（当前/近景/背景）+ 场景切换检测
- **光影氛围**：12 种氛围模板，自动选择光线标签
- **诊断模式**：生成后预览/编辑提示词再发送
- **词汇表**``

## 安装

```
SillyTavern/data/default-user/extensions/scene2prompt/
```

> ⚠️ **目录名必须是 `scene2prompt`**（全小写）。不要用 GitHub 默认克隆名 `SillyTavern-Scene2Prompt`，否则会 404 报错。

刷新 ST。

### 导入工作流

将 `workflows/` 下的 JSON 文件导入 ST 的 ComfyUI 工作流管理：
- `S2P_SDXL_eps.json` — 大多数 SDXL 模型
- `S2P_SDXL_vpred.json` — NoobAI-XL 专用
- `S2P_SD15.json` — SD1.5 模型

> 工作流文件也需复制到 `data/default-user/user/workflows/`

## 配置

### Provider

| Provider | 需要 | 模型名 | 价格 |
|----------|------|--------|------|
| DeepSeek | API Key | `deepseek-chat` | ¥2/百万token |
| OpenAI | API Key | `gpt-4o-mini` | $0.15/百万token |
| OpenRouter | API Key | `anthropic/claude-sonnet-4` | $3/百万token |
| Ollama | 本地 | `qwen2.5:7b` | 免费 |
| 自定义 | URL+Key | 任意 | — |

### 模型配置

点「刷新列表」自动检测 ComfyUI 里的模型，匹配到配置后自动同步参数到 ST：

| 模型 | 采样器 | CFG | 步数 | 分辨率 |
|------|--------|-----|------|--------|
| NoobAI-XL | Euler+Simple | 4 | 28 | 1024² |
| WAI Illustrious | Euler a | 5 | 30 | 896×1152 |
| Animagine XL | Euler a | 6 | 28 | 1024² |
| Hassaku XL | Euler a | 6 | 28 | 832×1216 |
| Nutella Pie | DPM++ 2M Karras | 5 | 30 | 1024² |
| SDXL Base | DPM++ 2M Karras | 7 | 25 | 1024² |
| Pony v6 | Euler a | 7 | 25 | 1024² |

## 使用

1. 聊天
2. 点橙色的 **「画面」** 按钮
3. LLM 生成提示词（按钮变身"生成中..."）
4. ComfyUI 出图

## 故障排查

| 问题 | 检查 |
|------|------|
| 点「画面」无反应 | ComfyUI 已启动？ST SD 设置已配？ |
| 画面异常 | 工作流选对了吗？v-pred 模型用 `S2P_SDXL_vpred.json` |
| 多人特征混合 | 换 Animagine XL 或 Hassaku XL |
| 404 Not Found (settings.html) | 目录名必须为 `scene2prompt`，不能是 `SillyTavern-Scene2Prompt` |

## 许可

AGPL-3.0

---

<h1 id="english">English</h1>

## Features

- **Chat→Image**: LLM-powered prompt generation from dialogue
- **5 LLM Providers**: DeepSeek / OpenAI / OpenRouter / Ollama / Custom
- **Auto-detect ComfyUI models**: Fetch installed checkpoints, match to profiles
- **One-click ST sync**: Auto-set workflow/model/CFG/Steps/Sampler/Resolution
- **9+ Model Profiles**: Civitai-verified params per model
- **Multi-character**: Per-character separation, spatial composition, anti-blending
- **Emotion sensing**: 35 emotions detected → Danbooru expression tags
- **Personality extraction**: 20 traits from character cards → pose/expression bias
- **Smart context**: 3-tier message weighting + scene change detection
- **Lighting atmosphere**: 12 mood templates → auto lighting tags
- **Diagnostic mode**: Preview/edit prompts before sending

## Quick Start

1. Copy to `SillyTavern/data/default-user/extensions/scene2prompt/` (⚠️ folder MUST be named `scene2prompt`)
2. Copy workflows to `data/default-user/user/workflows/`
3. Restart ST
4. Configure ComfyUI URL in ST's Image Generation settings
5. Scene2Prompt settings → select LLM Provider → enter API key
6. Click **「刷新列表」** to detect your ComfyUI models
7. Pick a model → params auto-sync to ST
8. Chat → click **「画面」**

## Recommended Models

| Model | Style | Download |
|-------|-------|----------|
| NoobAI-XL v1.0 | General anime | [Civitai](https://civitai.com/models/1118967) |
| WAI Illustrious v1.4 | Manhwa semi-real | [Civitai](https://civitai.com/models/140272) |
| Animagine XL v3.1 | Refined anime SFW | [Civitai](https://civitai.com/models/260267) |
| Hassaku XL v1.0 | Bright anime, multi-char | [Civitai](https://civitai.com/models/140272?modelVersionId=296830) |
| Nutella Pie | Sharp anime linework | [Civitai](https://civitai.com/models/1685052) |
| Pony Diffusion v6 | Western anime | [Civitai](https://civitai.com/models/257749) |
| SDXL Base 1.0 | Photorealistic | [HuggingFace](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0) |

## License

AGPL-3.0
