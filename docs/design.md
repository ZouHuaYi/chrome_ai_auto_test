# 架构与设计（录制链路修复）

## 数据流
1. content_script 捕获事件并发送消息（action: RECORD_STEP）。
2. service_worker 接收消息，写入 storage，并广播给 sidepanel。
3. sidepanel 监听消息并展示，同时在加载时从 storage 读取历史记录。

## 统一消息结构
```
{
  action: 'RECORD_STEP',
  payload: {
    type: 'click' | 'input',
    target: '<xpath>',
    text?: '...',
    value?: '...'
  }
}
```

## 关键修复点
- content_script 消息字段与 sidepanel 展示字段保持一致（type/target/value/text）。
- 保留 storage 作为历史记录来源。
