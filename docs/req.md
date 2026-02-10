# 需求说明（录制数据无法在侧边栏显示）

## 问题描述
- 打开侧边栏后操作网页，仍未看到任何录制步骤。
- 说明录制链路（content_script → service_worker → sidepanel）存在断点或数据结构不一致。

## 目标
- 任何网页操作（click/input）都能实时显示在侧边栏。
- 侧边栏打开后，也能加载历史录制记录。

## 约束
- 保持 SidePanel 入口为 `src/sidepanel/index.html`。
- 继续使用 Chrome MV3 + CRXJS。

## 验收标准
- 在任意 http/https 页面点击/输入，侧边栏能实时显示记录。
- 刷新侧边栏后仍能看到历史记录（来自 storage）。
