# 架构与设计（产品化完善）

## 配置面板
- Storage key: settings
- 结构：
```
{
  enabled: true,
  events: { click: true, input: true, change: true, scroll: false },
  debounceMs: 300,
  throttleMs: 500,
  networkCapture: false
}
```

## 采集增强
- 事件支持：click/input/change/scroll
- selector 优先级：xpath -> css selector

## 网络采集
- 使用 chrome.webRequest.onCompleted 记录 {url, method, statusCode}
- 仅在 networkCapture=true 时启用
