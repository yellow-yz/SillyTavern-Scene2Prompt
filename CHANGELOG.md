# Scene2Prompt v2.0 更新日志

## v2.0.0 — 社区版首版 (2026-07-01)

### 🎉 重大更新

- **模块化重构**：从单文件 911 行拆分为 5 个模块（index.js / engine.js / providers.js / presets.js / settings.html）
- **多 LLM 支持**：支持 DeepSeek / OpenAI / OpenRouter / Ollama / 自定义 五种 Provider
- **降级链**：主 LLM → 备用 LLM → 关键词回退，确保任何情况下都有提示词可用
- **预设系统**：5 个内置预设 + 自定义预设 CRUD + 导入/导出
- **设置面板重做**：Handlebars 模板 + 3-Tab UI，支持 Provider 动态切换
- **即插即用**：不再需要 Patch ST 源码，所有 API 从浏览器直发
- **中英双语文档**

### 🔧 改进

- 修复 `fallbackTags` 中 Animagine 重复定义 bug
- 修复面板底部过时的「工作流 Scene2Prompt_Anime · 模型 YesMix」文案
- 设置持久化改用 `saveSettingsDebounced`
- 日志分级（debug / info / error / silent）

### ⚠️ 破坏性变更

- 配置键名变更：`deepseek_key` → `providerConfigs.deepseek.apiKey`
- 首次启动自动迁移 v4 配置

---

## v1.0.0 — 个人版 (2025)

- 单文件 911 行 index.js
- 仅 DeepSeek 支持（ST 代理 + 直连双路径）
- 6 行 Danbooru 标签格式
- 三级内容门控
- 外貌缓存 + 自动提取
- 关键词回退（63 SFW + 14 NSFW）
- 反马赛克强制负向词
- 150 行后处理管线
