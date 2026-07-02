# Scene2Prompt v2 — 场景画面生成增强

[English](#english) | [中文](#chinese)

> SillyTavern 插件：聊天上下文 → LLM → Danbooru 标签 → 生图。即插即用。

---

<h1 id="chinese">中文</h1>

## 功能

- **聊天 → 画面**：自动分析角色对话，生成精准的 Danbooru 标签提示词
- **5 种 LLM**：DeepSeek / OpenAI / OpenRouter(含Claude) / Ollama / 自定义
- **8 个模型配置**：WAI Illustrious / NoobAI-XL / Animagine XL / Hassaku XL / Pony v6 / SDXL Base / Illustrious-XL，基于 Civitai 实测参数
- **3 级内容门控**：自动 / 显式 / 软色情 / 无
- **多人场景**：自动检测群聊角色、分别描述外貌和姿势、防止特征混合
- **外貌缓存**：自动提取角色外貌特征、注入提示词保持一致性
- **诊断模式**：生成后预览/编辑提示词再发送

## 安装

### 1. 安装扩展

```
SillyTavern/
└── data/
    └── default-user/
        └── extensions/
            └── scene2prompt/   ← 放这里
                ├── manifest.json
                ├── index.js
                ├── engine.js
                ├── providers.js
                ├── presets.js
                ├── model_profiles.js
                ├── settings.html
                ├── style.css
                └── workflows/
                    └── sdxl_generic.json
```

重启 SillyTavern 或刷新页面。

### 2. 部署 ComfyUI

**方案 A — 一键包（推荐新手）**

下载 [ComfyUI_windows_portable](https://github.com/comfyanonymous/ComfyUI/releases)，解压即用。

**方案 B — 手动安装**

```bash
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI
pip install -r requirements.txt
```

启动 ComfyUI：
```bash
# Windows
python main.py

# 或使用 GPU 加速
python main.py --highvram
```

默认地址：`http://127.0.0.1:8188`

### 3. 下载模型

将 SDXL 模型放入 `ComfyUI/models/checkpoints/`：

| 模型 | 用途 | 下载 |
|------|------|------|
| **NoobAI-XL v1.0** | 通用动漫（推荐首选） | [Civitai](https://civitai.com/models/1118967) |
| **WAI Illustrious v1.4** | 韩漫半写实 | [Civitai](https://civitai.com/models/140272) |
| **Animagine XL v3.1** | 精细动漫 SFW | [Civitai](https://civitai.com/models/260267) |
| **Pony Diffusion v6** | 欧美动漫 | [Civitai](https://civitai.com/models/257749) |

### 4. 导入 ComfyUI 工作流

1. SillyTavern → 扩展 → Image Generation
2. Source 选 ComfyUI，URL 填 `http://127.0.0.1:8188`
3. 点击 **Import Workflow** → 选择 `scene2prompt/workflows/sdxl_generic.json`
4. 设为默认工作流

## 配置

### Provider 设置

打开扩展设置 → Scene2Prompt → 基本设置：

| Provider | 需要 | 模型名 | 价格 |
|----------|------|--------|------|
| **DeepSeek** | API Key | `deepseek-chat` | ¥2/百万token |
| **OpenAI** | API Key | `gpt-4o-mini` | $0.15/百万token |
| **OpenRouter** | API Key | `anthropic/claude-sonnet-4` | $3/百万token |
| **Ollama** | 本地启动 | `qwen2.5:7b` | 免费 |
| **自定义** | URL + Key | 任意 OpenAI 兼容 | — |

> **Claude 用户**：Anthropic 官方 API 不支持浏览器跨域，请通过 OpenRouter 中转。

### 模型配置

选择生图模型，S2P 会根据模型自动切换提示词格式和推荐参数：

| 模型 | 推荐步数 | CFG | 采样器 | 格式 |
|------|---------|-----|--------|------|
| NoobAI-XL | 28 | 4.5 | Euler | Danbooru |
| WAI Illustrious | 30 | 5 | Euler Ancestral | Danbooru |
| Animagine XL | 28 | 6 | Euler Ancestral | Danbooru |
| Hassaku XL | 28 | 6 | Euler Ancestral | Danbooru |
| Pony v6 | 25 | 7 | Euler Ancestral | Danbooru+score |
| SDXL Base | 25 | 7 | DPM++ 2M Karras | 自然语言 |

### 模型下载

| 模型 | 用途 | 下载 |
|------|------|------|
| **NoobAI-XL v1.0** | 通用动漫（推荐首选） | [Civitai](https://civitai.com/models/1118967) |
| **WAI Illustrious v1.4** | 韩漫半写实，NSFW 出色 | [Civitai](https://civitai.com/models/140272) |
| **Animagine XL v3.1** | 精细动漫，SFW 最佳 | [Civitai](https://civitai.com/models/260267) |
| **Hassaku XL v1.0** | 鲜艳动漫，多人/风景 | [Civitai](https://civitai.com/models/140272?modelVersionId=296830) |
| **Pony Diffusion v6** | 欧美动漫 | [Civitai](https://civitai.com/models/257749) |
| **SDXL Base 1.0** | 真实照片风格 | [HuggingFace](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0) |

下载后放入 `ComfyUI/models/checkpoints/` 目录。

## 使用

### 基本使用

1. 在 SillyTavern 中正常聊天
2. 想生成当前场景的画面时 → 点击输入框旁边橙色的 **「画面」** 按钮
3. 等待 LLM 生成提示词（按钮会变成 "生成中..."）
4. ComfyUI 自动生图，图片出现在聊天中

### 诊断模式

设置 → 画面设置 → 诊断模式 → "始终预览提示词"

生成后会弹出编辑器，可以手动修改提示词再发 ComfyUI。

### 多人场景

S2P 自动检测聊天中的多个角色，为每个角色分别生成外貌和姿势标签。不需要额外配置。

### 内容门控

| 级别 | 效果 |
|------|------|
| **自动**（默认） | 根据聊天内容自动判断 |
| **显式** | 包含全部性器官/行为标签 |
| **软色情** | 可裸露无性行为 |
| **无** | 完全 SFW，强制着装 |

### 外貌缓存

切换到新角色时自动提取外貌特征，之后每次生图自动注入。也可以在设置中手动"重新提取"或"批量提取所有角色"。

## 故障排查

| 问题 | 检查 |
|------|------|
| 点「画面」无反应 | 确认 ComfyUI 已启动、ST 的 Image Generation 已配好 |
| 提示词质量差 | 换更强的 LLM（Claude > GPT-4o > DeepSeek）、增大上下文消息数 |
| 多人场景特征混合 | 换 Animagine XL 或 NoobAI-XL |
| SFW 场景出现裸露 | 确认内容门控为「自动」或「无」，模型建议用 Animagine |
| 显式场景无性器官 | 内容门控设为「显式」，模型建议用 WAI Illustrious |
| 连接测试失败 | 检查 API Key、网络代理、Ollama 是否用 `OLLAMA_ORIGINS=*` 启动 |

## 项目结构

```
scene2prompt/
├── index.js              # 入口：事件、UI、按钮
├── engine.js             # 核心管线
├── providers.js          # 多 LLM 接口
├── presets.js            # 预设管理
├── model_profiles.js     # 8 个模型配置
├── settings.html         # 设置面板
├── style.css             # 样式
└── workflows/
    └── sdxl_generic.json # ComfyUI 工作流
```

## 许可

AGPL-3.0

---

<h1 id="english">English</h1>

## Features

- **Chat → Image**: Analyzes dialogue, generates precise Danbooru tag prompts
- **5 LLM Providers**: DeepSeek / OpenAI / OpenRouter (incl. Claude) / Ollama / Custom
- **8 Model Profiles**: Pre-configured with Civitai-verified parameters
- **Content Gating**: Auto / Explicit / Soft / None
- **Multi-Character**: Auto-detects group chat characters, separate descriptions
- **Appearance Cache**: Auto-extracts character features, maintains consistency
- **Diagnostic Mode**: Preview/edit prompts before sending

## Quick Start

1. Copy `scene2prompt/` to `SillyTavern/data/default-user/extensions/`
2. Restart SillyTavern
3. Set up ComfyUI (see below)
4. Import `workflows/sdxl_generic.json` into ST's ComfyUI settings
5. Open Scene2Prompt settings → select LLM Provider → enter API key
6. Chat → click **「画面」** button

## ComfyUI Setup

1. Download [ComfyUI](https://github.com/comfyanonymous/ComfyUI) or use the portable version
2. Download an SDXL model to `ComfyUI/models/checkpoints/` (NoobAI-XL recommended)
3. Start ComfyUI: `python main.py` (default: `http://127.0.0.1:8188`)
4. In ST: Extensions → Image Generation → Source: ComfyUI → URL: `http://127.0.0.1:8188`
5. Import `workflows/sdxl_generic.json`

## Recommended Models

| Model | Style | Download |
|-------|-------|----------|
| **NoobAI-XL v1.0** | General anime | [Civitai](https://civitai.com/models/1118967) |
| **WAI Illustrious v1.4** | Manhwa semi-real | [Civitai](https://civitai.com/models/140272) |
| **Animagine XL v3.1** | Refined anime SFW | [Civitai](https://civitai.com/models/260267) |
| **Hassaku XL v1.0** | Bright anime, multi-char | [Civitai](https://civitai.com/models/140272?modelVersionId=296830) |
| **Pony Diffusion v6** | Western anime | [Civitai](https://civitai.com/models/257749) |
| **SDXL Base 1.0** | Photorealistic | [HuggingFace](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0) |

Download to `ComfyUI/models/checkpoints/`.

## License

AGPL-3.0
