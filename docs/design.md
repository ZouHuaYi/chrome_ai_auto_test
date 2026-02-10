# 架构与设计（自动化与全流程通畅）

## 一键生成
- 读取 Markdown 输入/文件 → 解析 JSON
- 生成 Prompt / 执行计划 / 校验计划 / 执行模拟 / 断言模板
- 生成统一输出

## 导出/导入
- steps.json 导出（Blob 下载）
- Markdown 文件导入（FileReader）

## 自动化打包
- npm script: package:ext = Compress-Archive dist -> zip
