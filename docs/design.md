# 架构与设计（第三阶段：执行/断言骨架）

## 执行器接口
```
executePlan(steps) -> { ok, report }
```

## 断言器接口
```
assertPlan(context) -> { ok, issues[] }
```

## 侧边栏
- 新增“生成执行计划”按钮，输出执行计划文本。
