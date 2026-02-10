# 架构与设计（侧边栏文档解析预览）

## UI 结构
- 上部：录制步骤列表（保留现有）。
- 下部：Markdown 输入区 + 解析按钮 + JSON 预览区。

## 数据流
1. 用户在侧边栏输入 Markdown。
2. 点击“解析”后调用 `parseMarkdown`。
3. 结果以 JSON 字符串展示。

## 模块依赖
- 使用 `src/parser/markdown.js` 提供的 `parseMarkdown`。
