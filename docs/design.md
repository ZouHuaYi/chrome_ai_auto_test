# 架构与设计（Phase 2：可落地设计）

本文档覆盖 `req.md` 待补充功能清单（1–10），包含模块划分、数据结构、关键流程、接口/存储变更、UI 变更点、风险与里程碑。

---

## 1. 模块划分

| 模块 | 职责 | 对应 req 项 | 现状→目标 |
|------|------|-------------|-----------|
| **feishu** | 飞书文档拉取与解析 | 1 | 占位 → 真实 API + 输出 docJson |
| **parser** | 文档/思维导图解析为统一结构 | 2 | 仅 markdown → + 思维导图 JSON/大纲 |
| **prompt** | 组装 Prompt、统一输出、模型参数注入 | 3 | 占位 model/temp/tokens → 读 storage 写入 |
| **executor** | 在页面上真实执行步骤 | 4 | mock SIMULATED → Content Script 真实 click/input/change |
| **validators** | 校验引擎执行 | 5 | PENDING 占位 → 真实 DOM/文案/数据校验 |
| **assertions** | 断言与执行/校验结果绑定 | 6 | mock → 预期 vs 实际、通过/失败展示 |
| **test** | 单元测试与 CI | 7 | 无 → Vitest + GitHub Actions |
| **sidepanel** | 录制步骤导入/去重、网络步骤展示、导出与版本 | 8, 9, 10 | 无导入/无 network 详情/无导出历史 → 全补全 |
| **storage** | 统一 key、导出历史 | 3, 10 | 已有 modelConfig/recorded_steps → + exportHistory |

**依赖关系（实现顺序建议）**：parser/feishu 可并行 → prompt（依赖 modelConfig）→ executor → validators → assertions；步骤导入/去重、网络展示、导出版本可并行且仅依赖 sidepanel + storage。

---

## 2. 数据结构

### 2.1 已有且沿用

- **Step（录制步骤）**
  - 操作类：`type`: `click`|`input`|`change`|`scroll`；`target`（xpath 或 css）；`selector`: `{ xpath, css }`；`value`/`text`；`timestamp`；`url`。
  - 网络类（已有）：`type`: `network`；`target`/`url`；`method`；`statusCode`；`timestamp`。
- **docJson（需求文档结构）**：`{ type: 'document', children: [...] }`，子节点 `heading`（level, text）、`list`（ordered, items）、`paragraph`（text）。飞书解析输出与此兼容。
- **modelConfig**：`{ model, temperature, max_tokens }`，存 `chrome.storage.local` 键 `modelConfig`。

### 2.2 新增或明确约定

- **思维导图解析输出**（req#2）  
  - 与 docJson 兼容：树形压平为 `children` 数组，每节点至少 `{ type: 'heading'|'list'|'node', text, level?, items? }`，便于复用 `generateDocAssertions`。
- **执行计划 step**  
  - 与录制 step 同形，执行器消费字段：`type`、`target`（优先 xpath 再 css）、`value`/`text`。
- **执行结果（executor）**  
  - 单步：`{ index, step, status: 'OK'|'FAIL', note?, screenshot? }`。  
  - 总：`{ ok, report: { executed, logs } }`。
- **校验结果（validators）**  
  - `{ ok, context, result: { status: 'PASS'|'FAIL'|'PENDING', issues: [{ kind, message, selector? }] } }`。
- **断言结果（assertions）**  
  - `{ ok, issues: [{ expected, actual, passed, reason? }] }`，与执行/校验结果绑定。
- **导出历史（req#10）**  
  - 单条：`{ id, timestamp, content }`（content 为统一输出全文）。  
  - Storage key：`exportHistory`，值：数组，最近 N 条（如 20），按时间倒序。

### 2.3 存储 Key 汇总

| Key | 说明 |
|-----|------|
| `recorded_steps` | 录制步骤数组 |
| `settings` | 录制设置（含 networkCapture） |
| `modelConfig` | 模型配置 |
| `exportHistory` | 统一输出导出历史（新增） |

---

## 3. 关键流程

### 3.1 录制 → 解析 → 生成 → 执行 → 校验 → 导出

```
[录制] content/recorder.js 产生 step → background 持久化 + 广播
         ↓
[解析] 飞书/思维导图 → feishu + parser → docJson（与现有 docJson 一致）
         ↓
[生成] prompt/assembler 读 steps + docJson + modelConfig(storage) → promptText
       plan/validate/assert 由现有逻辑生成 planJson / validateJson / assertionTemplate
       prompt/unified 组装统一输出（含真实 model/temperature/max_tokens）
         ↓
[执行] executor 在目标 tab 的 Content Script 中按 plan 顺序执行 click/input/change
       → 上报每步 OK/FAIL + 可选截图 → simulateJson 更新为真实结果
         ↓
[校验] validators/engine 在回放后/当前页执行 ui/text/data 校验
       → result.status + issues → 写入 context
         ↓
[断言] assertor 将断言模板与执行/校验结果对比 → 预期 vs 实际 → 通过/失败
         ↓
[导出] 统一输出复制 / 导出为文件（带时间戳或版本号）/ 写入 exportHistory
```

### 3.2 流程与 req 的对应

- **req#1 飞书**：录制与解析并行；飞书输出 docJson，进入「生成」的 assemblePrompt / 断言建议。
- **req#2 思维导图**：解析后得到 docJson 兼容结构，参与「生成」。
- **req#3 模型配置**：在「生成」环节从 storage 读 modelConfig，写入 Prompt 与统一输出。
- **req#4 真实执行**：「执行」环节由 executor 在 Content Script 真实回放。
- **req#5 校验引擎**：「校验」环节 engine 真正跑 ui/text/data 校验。
- **req#6 断言绑定**：「断言」环节 assertor 消费执行+校验结果，输出通过/失败。
- **req#8 步骤导入**：侧边栏「导入 Steps」→ 读 steps.json → 替换或追加 + 可选去重 → 写回 storage。
- **req#9 网络步骤展示**：录制时已有 network step；侧边栏列表按 `step.type === 'network'` 区分展示，可展开 method/url/statusCode。
- **req#10 导出与版本**：统一输出支持「导出文件」+ 写入 exportHistory；侧边栏可查看最近导出列表并再次复制。

---

## 4. 接口与存储变更

### 4.1 内部接口（无 HTTP API，仅扩展内）

- **feishu**（新）：`fetchDoc(tokenOrUrl) → Promise<docJson>`，失败返回空 doc 或明确 error。
- **parser**：新增 `parseMindmap(input: string): docJson`，支持一种约定 JSON 或 Markdown 大纲。
- **prompt/assembler**：`assemblePrompt({ steps, docJson })` 增加从 `chrome.storage.local.get(['modelConfig'])` 取模型参数（或由调用方传入），替换占位为真实 model/temperature/max_tokens。
- **executor**：`executePlan(steps, tabId?)` 通过 `chrome.tabs.sendMessage(tabId, { action: 'REPLAY', steps })` 在 Content Script 执行，并接收 `sendResponse` 的每步结果；无 tab 时保持 mock。
- **validators/engine**：`run(context)` 中 context 含当前页 DOM/执行结果；调用 ui/text/data 校验器，汇总 status 与 issues。
- **assertions/assertor**：`assertPlan(context)` 的 context 含执行 report、校验 result；输出 `issues[]` 含 expected/actual/passed。

### 4.2 消息（extension 内部）

- 已有：`RECORD_STEP`、`CLEAR_RECORDED_STEPS`、`GET_RECORDED_STEPS`。
- 新增：`REPLAY`（executor → content script，payload: `{ steps }`），content 回传每步 `{ index, status, note?, screenshot? }`。

### 4.3 存储变更

- 新增 key：`exportHistory`，值为 `Array<{ id, timestamp, content }>`，最多保留 20 条，由 sidepanel 在「导出」时 append 并截断。

---

## 5. UI 变更点

| 位置 | 变更内容 | 对应 req |
|------|----------|----------|
| 飞书区 | 输入 Doc Token 或链接，按钮「拉取」→ 展示正文并解析为 docJson，用于生成/断言 | 1 |
| 思维导图区 | 上传/粘贴后展示解析结果（树或列表），可选参与生成 | 2 |
| 模型配置 | 已存在；确保生成/统一输出中展示真实值（只读展示亦可） | 3 |
| 录制步骤列表 | 按 `step.type === 'network'` 区分图标或标签；network 行可展开显示 method、url、statusCode | 9 |
| 步骤操作 | 新增「导入 Steps」：选择替换/追加，上传 steps.json，可选「去重」（同 target 同 type 连续合并） | 8 |
| 执行/校验/断言 | 展示真实执行状态（OK/FAIL）、校验 issues、断言通过/失败与原因 | 4, 5, 6 |
| 统一输出 | 按钮「导出为文件」（含时间戳/版本号）；「导出历史」：最近 N 条，点击复制 | 10 |

---

## 6. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 飞书 API 需鉴权与网络 | 先支持「粘贴正文」降级，Doc Token 为可选；文档中说明需自行申请飞书应用 |
| 思维导图格式多样 | 先支持一种（如单一 JSON 结构或 Markdown 大纲），其余格式后续迭代 |
| 执行器依赖 DOM 变化导致选择器失效 | 优先用 xpath，失败再试 css；单步失败记 FAIL + note，不中断全量 |
| 校验/断言依赖执行完成 | 执行未完成或无 tab 时，校验/断言保持 PENDING，UI 明确展示「需先执行」 |
| exportHistory 过大 | 仅保留最近 20 条，写入时按 timestamp 截断 |

---

## 7. 里程碑拆分

| 里程碑 | 内容 | req 覆盖 |
|--------|------|----------|
| **M1** | 模型配置接入生成流程；步骤导入与去重；网络步骤在侧边栏区分与展开 | 3, 8, 9 |
| **M2** | 飞书文档真实接入（Token/链接拉取或粘贴）；思维导图一种格式解析并输出 docJson | 1, 2 |
| **M3** | 真实执行回放（Executor + Content Script REPLAY）；校验引擎真实执行 | 4, 5 |
| **M4** | 断言与执行/校验结果绑定；统一输出导出与版本（文件 + exportHistory） | 6, 10 |
| **M5** | 单元测试（parser、prompt、executor、validators、assertions）+ CI（如 GitHub Actions） | 7 |

实施顺序建议：M1（无外部依赖、立刻提升可用性）→ M2 → M3 → M4，M5 可与 M2 并行（先搭测试框架再随功能补用例）。

---

## 8. 与现有实现的衔接

- **assemblePrompt / unified**：在现有函数内或调用前读取 `modelConfig`，将 `【LLM 接口占位】` 替换为实际字段。
- **executor**：保留 `executePlan(steps)` 无 tab 时返回 mock 行为；有 tab 时走 `tabs.sendMessage` + content 的 REPLAY 处理。
- **validators/engine**：在 `run(context)` 中调用现有 `uiValidator`/`textValidator`/`dataValidator`，将结果汇总为 `result.status` 与 `result.issues`。
- **assertor**：输入 context 增加 `execReport`、`validateResult`，输出从空 issues 改为基于实际对比的 issues。
- **侧边栏**：在现有「录制步骤」区块加「导入 Steps」与 network 展开；在「统一输出」区块加「导出文件」「导出历史」入口。

以上设计覆盖 req.md 待补充功能 1–10，并保持与现有 storage、step、docJson、modelConfig 兼容，无破坏性变更。
