# 架构与设计（第二阶段：录制优化）

## 录制优化策略
- Input：使用按元素 key（xpath）做防抖，300ms 内只保留最后一次输入事件。
- Click：使用按元素 key（xpath）做节流，500ms 内只记录一次点击。

## 数据结构
保持统一消息结构：
```
{ action: 'RECORD_STEP', payload: { type, target, value?, text?, timestamp, url } }
```

## 关键点
- 防抖/节流在 content_script 层完成，减少无效消息传输。
- 以 xpath 为 key 保持同一控件的节流范围。
