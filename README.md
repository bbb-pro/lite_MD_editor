# Lite MD Editor

轻量化 Markdown 编辑器 — 像 Word 一样编辑和阅读 MD 文件，纯本地运行，无需登录和联网。

## ✨ 功能特性

- **📝 Markdown 编辑**：完整语法支持，代码块语法高亮（Prism）
- **👁️ 实时预览**：支持 GitHub Flavored Markdown（表格、任务列表、删除线等）
- **🔀 三种模式**：编辑模式 / 分屏模式（默认）/ 预览模式
- **🗂️ 文件操作**：新建、打开、保存、另存为（Chrome/Edge 支持原生文件选择器）
- **🎨 Word 风格工具栏**：标题、加粗、斜体、删除线、行内代码、列表、引用、链接、图片、代码块、表格、分隔线
- **⌨️ 键盘快捷键**：Ctrl+S/N/O/Shift+S/B/I
- **📊 状态栏**：文件名、保存状态、字数统计（中英文混合计数）
- **🚫 纯本地运行**：无后端、无登录、无网络请求

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 🛠️ 技术栈

- Vite + React 18 + TypeScript
- Tailwind CSS
- react-markdown + remark-gfm
- react-syntax-highlighter (Prism)
- lucide-react

## 📦 部署

访问地址：`https://057300.xyz/lite_MD_editor/`

## 📄 License

MIT
