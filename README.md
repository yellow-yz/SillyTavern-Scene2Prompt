# Scene2Prompt v2.0 — 场景画面生成增强

> 读取 SillyTavern 聊天上下文 → LLM 生成 6 行 Danbooru 标签 → ComfyUI 出图。**即插即用。**

[English](#english) | [中文](#chinese)

---

<h1 id="chinese">🇨🇳 中文</h1>

## 功能简介

Scene2Prompt 是一个 SillyTavern 扩展，在用户点击「画面」按钮时：

1. **收集聊天上下文** — 最近 N 条消息、角色外貌、场景氛围
2. **LLM 生成标签** — 调用 AI（DeepSeek/OpenAI/Claude 等）生成 6 行结构化 Danbooru 标签
3. **后处理优化** — 冲突检测、去重、标签上限、内容门控、反马赛克
4. **发给 ComfyUI** — 注入 ST 生图管道，通过 ComfyUI 工作流出图

### 功能清单

- ✅ **5 种 LLM Provider**：DeepSeek / OpenAI / OpenRouter(含Claude) / Ollama / 自定义
- ✅ **降级链**：主 LLM → 备用 LLM → 76 个关键词回退
- ✅ **5 个内置预设**：韩漫特化 / 通用动漫 / 写实摄影 / 极速轻量 / 角色设计
- ✅ **4 级内容门控**：自动 / 显式 / 软色情 / 无
- ✅ **外貌缓存**：自动从角色卡提取外貌 → 注入提示词
- ✅ **6 行 Danbooru 标签格式**：比自然语言精准得多
- ✅ **150 行后处理管线**：冲突解决 / 去重 / 上限120标签 / 反马赛克
- ✅ **多人场景支持**：群聊自动检测所有角色
- ✅ **即插即用**：不需要改 ST 源码

### 与同类插件的区别

| | Scene2Prompt | 内置 SD 扩展 | Image Gen Kazuma | Auto Illustrator |
|---|---|---|---|---|
| 提示词格式 | **6 行 Danbooru** | 通用自然语言 | 通用自然语言 | 通用自然语言 |
| LLM 调用 | **独立 API 直连** | 依赖 ST 后端 | 依赖 ST 后端 | 依赖 ST 后端 |
| 内容门控 | **4 级** | ❌ | ❌ | ❌ |
| 外貌缓存 | **自动提取+注入** | ❌ | ❌ | ❌ |
| 后处理管线 | **150 行** | ❌ | ❌ | ❌ |

### 前置要求

- SillyTavern v1.12+
- ComfyUI（带 SDXL 模型）
- 至少一个 LLM API Key（推荐 DeepSeek，便宜好用）

## 安装

### 1. 安装扩展

将 `scene2prompt/` 整个文件夹放入：

```
SillyTavern/data/default-user/extensions/scene2prompt/
```

重启 SillyTavern 或刷新页面。

### 2. 导入 ComfyUI 工作流

1. 打开 SillyTavern → 扩展 → Image Generation → ComfyUI
2. 点击 "Import Workflow"
3. 选择 `workflows/sdxl_generic.json`
4. 设为默认工作流

### 3. 配置 ComfyUI 连接

在 ST 的 Image Generation 设置中：
- Source: ComfyUI
- URL: `http://127.0.0.1:8188`
- 选择导入的工作流

## 配置

### Provider 设置

打开 Scene2Prompt 设置面板 → 「基本设置」Tab：

| Provider | 需要 | 推荐模型 | 价格 |
|----------|------|---------|------|
| **DeepSeek** | API Key | `deepseek-chat` | ¥2/百万token |
| **OpenAI** | API Key | `gpt-4o-mini` | $0.15/百万token |
| **OpenRouter** | API Key | `anthropic/claude-sonnet-4` | $3/百万token |
| **Ollama** | 本地服务 | `qwen2.5:7b` | 免费 |
| **自定义** | URL + Model | 任意 OpenAI 兼容 API | — |

> ⚠️ **Claude 用户注意**：Anthropic 官方 API 不支持浏览器 CORS。请通过 **OpenRouter** 中转（选择 `anthropic/claude-sonnet-4-20250514`）。

### 选择预设

切换到「画面设置」Tab → 选择预设。推荐：
- **韩漫特化**：NSFW 半写实韩漫风，WAI Illustrious
- **通用动漫**：日常 SFW 场景
- **极速轻量**：本地 Ollama，不要钱

### 画面参数

- **内容级别**：自动（根据聊天判断）/ 显式（全放行）/ 软色情（裸但不色情）/ 无（纯 SFW）
- **POV**：默认自动判断，可手动强制开启
- **上下文消息数**：2-30 条，越多越准确但越贵
- **过滤对话/心理描写**：默认开启，提高提示词精准度

## 使用

1. 在 SillyTavern 中正常聊天
2. 想要生成当前场景的画面时，点击发送栏旁边橙色的 **「画面」** 按钮
3. 等待 LLM 生成提示词（状态栏显示进度）
4. ComfyUI 开始生成图片
5. 图片自动出现在聊天中

> 💡 「画面」按钮等价于输入 `/sd raw_last` 并发送。你也可以手动输入这个命令。

## 外观管理

- **自动提取**：切换到新角色时，自动从角色卡提取外貌标签（10 秒冷却）
- **手动提取**：在设置面板点击「重新提取」
- **手动编辑**：直接在 textarea 中修改外貌标签

## 预设管理

「预设 · 日志」Tab 中：
- **保存当前**：将当前所有设置保存为自定义预设
- **导出/导入**：分享预设给其他人（不含 API Key）
- **恢复内置**：重置内置预设

## 常见问题

### Q: 生图失败怎么办？
检查设置面板的日志区域。常见原因：
- API Key 无效或余额不足
- Provider 模型名写错
- ComfyUI 没启动或 URL 不对
- 网络不通（点「测试连接」排查）

### Q: 提示词质量不好？
- 增大上下文消息数（让 LLM 看到更多场景信息）
- 切换到更强的 LLM（Claude > GPT-4o > DeepSeek > 本地）
- 开启诊断模式（v1.1）

### Q: 反马赛克不生效？
反马赛克词强制前置在负向提示词中。如果 ComfyUI 模型不支持，需要换一个更少审查的模型。

### Q: 多人场景一个人被漏掉？
当前通过聊天记录自动检测角色。确保所有角色都在最近消息中出现过。外貌缓存会被检测到的角色注入。

### Q: 我的 API Key 安全吗？
API Key 存在浏览器本地，通过 ST 的 `extension_settings` 持久化。不会上传到任何服务器。**导出预设不含 API Key**。

---

<h1 id="english">🇬🇧 English</h1>

## Overview

Scene2Prompt is a SillyTavern extension that enhances image generation prompts using LLM-powered scene analysis:

1. **Collects chat context** — recent messages, character appearances, scene mood
2. **LLM generates tags** — calls AI (DeepSeek/OpenAI/Claude/etc.) to produce structured Danbooru tags
3. **Post-processing** — conflict detection, dedup, tag cap, content gating, anti-censorship
4. **Sends to ComfyUI** — injects into ST's image generation pipeline

## Features

- ✅ **5 LLM Providers**: DeepSeek / OpenAI / OpenRouter (incl. Claude) / Ollama / Custom
- ✅ **Fallback chain**: Primary → Secondary → 76 keyword fallback
- ✅ **5 built-in presets**: Manhwa / Anime / Photorealistic / Speed Lite / Character Design
- ✅ **4 content levels**: Auto / Explicit / Soft / None
- ✅ **Appearance cache**: Auto-extract from character cards → inject into prompts
- ✅ **6-line Danbooru format**: Far more precise than natural language prompts
- ✅ **Post-processing pipeline**: Conflict resolution / dedup / 120-tag cap / anti-censor
- ✅ **Multi-character support**: Group chat detection
- ✅ **Plug-and-play**: No ST source patching required

## Requirements

- SillyTavern v1.12+
- ComfyUI with SDXL models
- At least one LLM API key (DeepSeek recommended for cost-effectiveness)

## Quick Start

1. Copy `scene2prompt/` to `SillyTavern/data/default-user/extensions/`
2. Restart SillyTavern
3. Import `workflows/sdxl_generic.json` into ST's ComfyUI workflow manager
4. Open Scene2Prompt settings → select your LLM Provider → enter API key
5. Chat → click **「画面」** button → image generated

## Provider Setup

| Provider | API URL | Auth | Notes |
|----------|---------|------|-------|
| DeepSeek | `api.deepseek.com` | Bearer token | Best value |
| OpenAI | `api.openai.com` | Bearer token | GPT-4o-mini recommended |
| OpenRouter | `openrouter.ai` | Bearer token | Routes to Claude, Gemini, etc. |
| Ollama | `localhost:11434` | None | Free, local, needs `OLLAMA_ORIGINS=*` |
| Custom | Any | Optional | OpenAI-compatible APIs (vLLM, LiteLLM) |

> ⚠️ **Claude via Anthropic API directly is not supported** due to CORS restrictions. Use OpenRouter instead (model: `anthropic/claude-sonnet-4-20250514`).

## Claude/Anthropic CORS Workaround

The Anthropic Messages API (`api.anthropic.com`) does not support browser CORS. Two solutions:

1. **Recommended**: Use OpenRouter. Add `anthropic/claude-sonnet-4-20250514` as the model in OpenRouter provider settings.
2. **Alternative**: Run a local CORS proxy (e.g., nginx reverse proxy, or `cors-anywhere`).

## License

AGPL-3.0

## Links

- [SillyTavern](https://github.com/SillyTavern/SillyTavern)
- [ComfyUI](https://github.com/comfyanonymous/ComfyUI)
- [Scene2Prompt v1.0 Plan](../v1.0/README.md)
- [Future Roadmap](../v1.1+/README.md)
