# Scene2Prompt 更新日志

## v2.4.0 — 多人场景增强 + 显式场景强化 (2026-07-02)

- 多人场景规则全面重写：7 种空间关系模板 + duo focus + 防混合
- 多人检测三层防御：用户消息标注 + 系统铁律 + 后处理兜底
- 智能人数标签：自动检测性别生成 2girls / 1boy1girl / couple
- 角色系列标签：知名角色自动加 Danbooru 系列名
- 显式场景强化：性器官标签从"可选"→"★★★必须包含"
- SFW 保护：自动在负向词添加 nsfw/nude/naked
- 负向词门控与 enforceContentLevel 同步

## v2.3.0 — 模型驱动体系 + Civitai 实测 (2026-07-02)

- 重写 model_profiles.js：8 个配置基于 Civitai 真实数据
- 新增 vPred / clipSkip / specialTagSystem / warning 字段
- UI：模型配置升级为主入口，预设降级为折叠区
- 修复 18 个 bug（迁移死代码、splice 索引错位等）

## v2.2.0 — 模型适配系统 (2026-07-02)

- 新建 model_profiles.js：8 内置模型配置
- engine.js buildSystemPrompt() 改为模板驱动
- 三种提示词格式：danbooru / natural / mixed

## v2.1.0 — 体验增强 (2026-07-01)

- 诊断模式：Prompt Inspector 弹窗（LLM 原始输出 + 编辑 + 变更日志）
- 按钮状态：点击后变身"生成中.../LLM请求中.../后处理中..."
- 批量提取外貌 + 缓存管理列表
- 增强测试连接报告 + 错误分类 + 修复建议

## v2.0.0 — 社区版首版 (2026-07-01)

- 模块化重构：单文件 911 行 → 6 个模块
- 5 种 LLM Provider：DeepSeek / OpenAI / OpenRouter / Ollama / Custom
- 降级链 + 关键词回退
- 3-Tab 设置面板（Handlebars 模板）
- 即插即用，无需 Patch ST 源码

## v1.0.0 — 个人版 (2025)

- 单文件 index.js 911 行
- 仅 DeepSeek 支持
- 6 行 Danbooru 标签格式
- 内容门控 + 外貌缓存 + 反马赛克
