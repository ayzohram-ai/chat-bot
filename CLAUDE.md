# Claude Chat — 项目约定

## 项目概览
- **名称**: Claude Chat 桌面应用
- **技术栈**: Electron + React 18 + TypeScript + Vite + Tailwind CSS
- **通信方式**: IPC bridge → `claude -p` CLI 子进程

## Memory 蒸馏系统

本项目内置"蒸馏"功能，用户点击蒸馏按钮后，Claude 会自动回顾当前对话并提取关键信息。

### 蒸馏协议

当用户触发蒸馏时，Claude 应：

1. **回顾**本次对话中的关键决策和变更
2. **分类提取**信息并告知用户：
   - API 配置（endpoint、key、模型）
   - 用户偏好（工具、风格、习惯）
   - 项目信息（路径、技术栈、状态）
   - 常用代码片段
   - 联系方式 / 地址
3. **精简输出**：只保留可跨会话复用的关键信息，不保留临时调试过程
4. 以结构化 Markdown 格式输出蒸馏结果

## 开发规范
- 组件放在 `src/components/`
- Hooks 放在 `src/hooks/`
- 工具函数放在 `src/lib/`
- Electron 主进程代码在 `electron/`
- 使用 Tailwind CSS，遵循已有的暗色主题配色
