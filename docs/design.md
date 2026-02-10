# 架构与设计（Prompt 组装器）

## 模块接口
```
assemblePrompt({ steps, docJson }) -> string
```

## Prompt 结构
- 标题：目标说明
- 录制步骤列表（编号）
- 文档结构 JSON（序列化）

## 侧边栏交互
- 按钮：生成 Prompt
- 结果区：多行文本框展示 Prompt
