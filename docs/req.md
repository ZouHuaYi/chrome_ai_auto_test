# 需求说明（模型配置 + 飞书/思维导图导入入口）

## 阶段目标
- 增加模型配置面板（model/temperature/max_tokens）。
- 增加飞书文档/思维导图导入入口（占位/文件导入）。
- 统一存储配置到 storage。

## 约束
- 不引入新依赖。
- 先做 UI 与数据占位，不做真实 API 调用。

## 验收标准
- 侧边栏可保存模型配置。
- 飞书/思维导图输入区可导入文件并展示内容。

---

## 待补充功能清单

基于当前代码与 README 仍缺失、可执行可落地的功能建议如下（按优先级与依赖关系排列）：

1. **飞书文档真实接入**
   - 现状：飞书区仅为占位，无 API 调用。
   - 建议：支持通过飞书开放平台 Doc Token 或链接拉取文档正文，解析为与 Markdown 一致或兼容的结构（如 headings/lists），并接入「生成 Prompt / 断言模板」流程，与现有 `docJson` 使用方式统一。

2. **思维导图结构化解析**
   - 现状：仅支持文件上传将原始文本填入文本框，无解析与结构化。
   - 建议：对常见思维导图格式（如某一种 JSON 结构或 Markdown 大纲）做解析，输出树形/列表结构，并可选参与 Prompt 或断言模板生成（例如按节点生成检查点）。

3. **模型配置接入生成流程**
   - 现状：`modelConfig` 已存 storage，但 `prompt/assembler.js` 中仍为占位文案（model/temperature/max_tokens）。
   - 建议：在组装 Prompt 或「统一输出」时读取 storage 中的 `modelConfig`，将实际 model/temperature/max_tokens 写入输出，便于下游或后续 LLM 调用直接使用。

4. **真实执行回放（Executor）**
   - 现状：`executor/executor.js` 仅做 mock，返回 SIMULATED 状态。
   - 建议：在 Content Script 或独立回放环境中，按执行计划顺序在页面上执行 click/input/change 等（基于现有 step 的 target/value/text），并上报每步成功/失败与可选截图，为后续断言提供真实结果。

5. **校验引擎真实执行**
   - 现状：`validators/engine.js` 为占位，仅返回 PENDING。
   - 建议：基于现有 ui/text/data 校验计划，在回放后或当前页面对 DOM/文案/数据做实际校验（如元素存在性、文本包含、接口数据快照对比），输出 status 与 issues 列表。

6. **断言执行与结果绑定**
   - 现状：`assertions/assertor.js` 为 mock，断言模板仅生成文本。
   - 建议：将断言模板与执行/校验结果关联，支持「预期 vs 实际」对比，并在侧边栏或导出中展示通过/失败与简要原因。

7. **单元测试与 CI**
   - 现状：`rules/execution-rules.md` 要求「严禁未通过测试合并」，但仓库内无测试脚本与 CI。
   - 建议：为 parser、prompt、executor、validators 等纯逻辑模块增加单元测试（如 Vitest/Jest），并配置 GitHub Actions 等 CI 在 PR/merge 前运行 `npm test`。

8. **录制步骤导入与去重**
   - 现状：支持导出 steps.json，但未支持从文件重新导入并合并/替换当前录制步骤。
   - 建议：在侧边栏增加「导入 Steps」入口，支持上传 steps.json 后替换或追加到当前步骤，并可选做简单去重（如同 target 同 type 的连续重复）。

9. **网络请求与步骤的关联展示**
   - 现状：开启 networkCapture 后网络请求会作为 step 写入，但侧边栏仅展示为通用 step，无请求/响应详情。
   - 建议：在录制步骤列表中区分展示 network 类型，并可选展开显示 method、url、statusCode 等，便于与操作步骤对应分析。

10. **统一输出的导出与版本**
    - 现状：支持复制统一输出，无持久化与历史。
    - 建议：支持将当前「统一输出」以文件形式导出（含时间戳或版本号），并可选择将最近若干次导出记录存于 storage，在面板中查看或再次复制。
