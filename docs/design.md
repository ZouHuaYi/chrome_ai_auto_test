# 架构与设计（Markdown 解析模块）

## 输出结构
```
{
  type: 'document',
  children: [
    { type: 'heading', level: 1, text: '...' },
    { type: 'paragraph', text: '...' },
    { type: 'list', ordered: false, items: ['a','b'] }
  ]
}
```

## 解析策略（基础版）
- 行级解析：
  - `#` 开头 → heading
  - `-/*/+` 或 `1.` → list item
  - 其他非空行 → paragraph（连续行合并）

## 约定
- 先保证稳定输出结构，后续再引入 markdown-it/AST。
