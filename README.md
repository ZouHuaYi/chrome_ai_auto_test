# Chrome AI Auto Test

基于 AI 的自动化回归测试录制工具 —— Chrome 扩展，用于在浏览器中录制用户操作、结合需求文档生成测试 Prompt/执行计划与断言，为后续 AI 驱动回放与校验提供输入。

---

## 项目简介

- **形态**：Chrome 扩展（Manifest V3），含侧边栏面板、Content Script 录制、Service Worker 后台。
- **能力**：在任意网页上录制 click/input/change/scroll 及可选网络请求；将录制步骤与 Markdown/飞书/思维导图等文档结合，生成 Prompt、执行计划、断言模板与统一输出；配置项与录制数据持久化到 `chrome.storage.local`。
- **当前阶段**：UI 与数据流完整，模型配置、飞书/思维导图入口为占位；执行与校验为本地模拟/占位，不做真实 API 调用与真实回放。

---

## 快速开始

### 环境要求

- Node.js 18+
- 现代 Chrome 浏览器（支持 Manifest V3、Side Panel）

### 安装与运行

```cmd
git clone <repo-url>
cd chrome_ai_auto_test
npm install
npm run build
```

### 加载扩展

1. 打开 Chrome，进入 `chrome://extensions/`。
2. 开启右上角「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择项目下的 **`dist`** 目录。
4. 扩展安装后，点击扩展图标或通过菜单打开**侧边栏**，即可使用测试面板。

### 开发模式

```cmd
npm run dev
```

在 `chrome://extensions/` 中加载 **`dist`** 目录（若使用 @crxjs/vite-plugin，dev 会持续产出 dist）。修改代码后根据需要重新加载扩展或等待热更新。

### 测试

单元测试使用 [Vitest](https://vitest.dev/)，当前为最小可行：parser、prompt、executor、validators 各 1 个用例（`tests/*.test.js`）。

```cmd
npm test
```

单次运行全部测试（CI 使用）。

```cmd
npm run test:watch
```

监听模式，修改源码后自动重跑相关测试。

- 测试匹配规则见 `vite.config.js` 中 `test.include`（含 `tests/**/*.test.js`）。
- 所有脚本通过 npm 调用，**Windows 下可直接在 cmd/PowerShell 中执行**。

**CI**：GitHub Actions 在 `push` / `pull_request` 到 `main` 或 `master` 时执行 `npm ci`、`npm test`、`npm run build`；矩阵在 **Ubuntu** 与 **Windows** 上运行（`.github/workflows/ci.yml`）。

---

## 目录结构

```
chrome_ai_auto_test/
├── src/
│   ├── sidepanel/           # 侧边栏 UI（React）
│   │   ├── index.html
│   │   ├── main.jsx
│   │   └── SidePanel.jsx    # 主面板：配置、录制列表、文档导入、生成与导出
│   ├── background/
│   │   └── service_worker.js  # 接收录制步、持久化、广播、可选网络采集
│   ├── content/
│   │   └── recorder.js      # 注入页面的录制脚本（事件、选择器、敏感信息脱敏）
│   ├── parser/              # 文档解析
│   │   ├── index.js
│   │   └── markdown.js      # Markdown → 结构化 JSON
│   ├── prompt/              # Prompt 组装与统一输出
│   │   ├── assembler.js     # 根据步骤 + 文档生成 Prompt
│   │   └── unified.js       # 统一输出格式
│   ├── executor/
│   │   └── executor.js      # 执行计划生成 / 模拟执行（当前为 mock）
│   ├── assertions/          # 断言
│   │   ├── assertor.js      # 断言计划生成（mock）
│   │   └── template.js      # 断言模板
│   └── validators/          # 校验
│       ├── engine.js        # 校验引擎入口（占位）
│       ├── uiValidator.js
│       ├── textValidator.js
│       ├── dataValidator.js
│       └── resultPlaceholder.js
├── docs/
│   ├── req.md               # 需求说明
│   └── design.md            # 架构与设计
├── rules/
│   └── execution-rules.md   # 执行/开发守则
├── manifest.json            # 扩展清单
├── vite.config.js           # Vite + @crxjs/vite-plugin
└── package.json
```

---

## 依赖 / 环境

- **运行时**：React 19、浏览器环境（Chrome 扩展 API）。
- **构建**：Vite 7、@crxjs/vite-plugin、@vitejs/plugin-react。
- **代码质量**：ESLint（含 React 相关规则）。

安装依赖：

```cmd
npm install
```

打包扩展（产出 `dist/`）：

```cmd
npm run build
```

打 zip 包（Windows）：

```cmd
npm run package:ext
```

---

## 使用方式

1. **录制**
   - 打开侧边栏，在「录制配置」中勾选启用录制及需要的事件（click/input/change/scroll），可选开启网络采集。
   - 在任意标签页内操作，步骤会同步到侧边栏「录制步骤」列表，并写入扩展本地存储。

2. **文档与导入**
   - **Markdown**：在「Markdown 解析预览」中粘贴或导入 `.md`，点击「解析」后用于生成 Prompt/断言模板。
   - **飞书文档**：在「飞书文档导入」中配置 Access Token（需自行在飞书开放平台获取 tenant_access_token）、可选 API Base，输入文档链接或 Doc Token 后点击「拉取」，将飞书文档转为与 Markdown 一致的结构（标题/列表/段落）并参与生成。
   - **思维导图**：在「思维导图导入」中粘贴 JSON（支持 `name`/`title` + `children` 树形）或 Markdown 大纲（`-`/`*` 缩进），点击「解析思维导图」后参与生成。文档来源可在「当前文档来源」处切换（Markdown / 飞书 / 思维导图）。

3. **生成与导出**
   - **生成 Prompt**：基于当前录制步骤 + 解析后的文档生成测试 Prompt。
   - **生成执行计划**：生成 executor + assertions 的 JSON 计划（当前执行为模拟）。
   - **执行模拟 / 生成校验计划 / 生成断言模板 / 生成校验结果占位**：在面板中按按钮即可，结果仅作本地占位或模拟。
   - **一键生成全流程**：一次生成 Prompt、计划、校验、模拟与断言模板，并填入「统一输出」。
   - **复制统一输出**：将统一格式内容复制到剪贴板，供外部 AI 或流水线使用。
   - **导出 Steps**：将当前录制步骤导出为 `steps.json`。

4. **模型配置**
   - 在「模型配置」中设置 model、temperature、max_tokens，会保存到 `chrome.storage.local`（供后续接入真实 LLM 时使用，当前生成逻辑中仍为占位）。

---

## 配置说明

| 配置项 | 存储键 | 说明 |
|--------|--------|------|
| 录制步骤 | `recorded_steps` | 数组，每项为 `{ type, target, value?, text?, ... }` |
| 录制设置 | `settings` | `enabled`、`events`（click/input/change/scroll）、`debounceMs`、`throttleMs`、`networkCapture` |
| 模型配置 | `modelConfig` | `model`、`temperature`、`max_tokens` |
| 飞书配置 | `feishuConfig` | `accessToken`（tenant_access_token）、`apiBase`（可选，默认 `https://open.feishu.cn/open-apis`）；用于「飞书文档导入」拉取文档 |

- 扩展权限：`sidePanel`、`storage`、`tabs`、`activeTab`、`webRequest`；`host_permissions`: `<all_urls>`（用于注入录制与可选网络采集）。

---

## 常见问题

**Q：侧边栏没有录制到步骤？**  
确认「录制配置」中已勾选「启用录制」，且当前操作页面已刷新（Content Script 需在页面加载后注入）。若仍无数据，在 `chrome://extensions/` 中查看扩展是否有错误。

**Q：如何只打包扩展不运行 dev？**  
执行 `npm run build`，然后在扩展管理页重新加载 `dist` 目录。

**Q：飞书/思维导图导入没效果？**  
飞书需在侧边栏配置 Access Token（飞书开放平台应用获取 tenant_access_token），输入文档链接或 Doc Token 后点击「拉取」。思维导图支持 JSON 树形（name/title + children）或 Markdown 大纲，粘贴后点击「解析思维导图」即可参与生成；生成时以「当前文档来源」选中的为准。

**Q：执行计划/校验结果是真实执行吗？**  
否。当前执行与校验均为本地模拟/占位，不会真正回放或调用外部 API。

**Q：模型配置会用在哪儿？**  
会持久化到 storage，供后续接入 LLM 时使用；当前「生成 Prompt」等流程中模型参数仍为占位文案。

---

更多需求与设计见 `docs/req.md`、`docs/design.md`。
