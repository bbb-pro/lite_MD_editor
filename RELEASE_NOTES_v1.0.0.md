# Lite MD Editor v1.0.0

## 🎉 首个正式版本

轻量化的 Markdown 编辑器，像 Word 一样编辑和阅读 .md 文件，纯本地运行，无需登录和联网。

## ✨ 功能特性

- **📝 Markdown 编辑**：完整语法支持，代码块高亮
- **👁️ 实时预览**：支持 GitHub Flavored Markdown（表格、任务列表、删除线等）
- **🔀 三种模式**：编辑 / 分屏（默认）/ 预览，一键切换
- **🗂️ 文件操作**：新建、打开、保存、另存为
- **📄 PDF 导出**：一键导出为 PDF（Ctrl+E）
- **🎨 Word 风格工具栏**：标题、加粗、斜体、列表、链接、代码块、表格等快捷按钮
- **⌨️ 键盘快捷键**：Ctrl+S/N/O/Shift+S/B/I/E
- **📊 状态栏**：文件名、保存状态、字数统计（中英文混合）
- **🚫 纯本地**：无后端、无登录、无网络请求

## 📦 下载

| 文件 | 说明 | 适用 |
|------|------|------|
| `Lite-MD-Editor-Setup-1.0.0.exe` | NSIS 安装包（约 78MB） | 推荐普通用户，双击安装 |
| `Lite-MD-Editor-Portable-1.0.0.zip` | 便携版压缩包 | 免安装，解压即用 |

## 🖥️ 系统要求

- Windows 10/11 (64-bit)
- 无需安装其他运行时环境

## 🚀 快速开始

### 安装版
1. 下载 `Lite-MD-Editor-Setup-1.0.0.exe`
2. 双击运行，按提示安装
3. 从开始菜单或桌面快捷方式启动

### 便携版
1. 下载 `Lite-MD-Editor-Portable-1.0.0.zip`
2. 解压到任意目录
3. 双击 `Lite MD Editor.exe` 启动

## 💻 从源码构建

```bash
git clone https://github.com/bbb-pro/lite_MD_editor.git
cd lite_MD_editor
npm install
npm run electron:build    # 打包 EXE
npm run electron:dev      # 开发模式
npm run dev               # Web 开发模式
```

## 🌐 在线使用

访问：https://bbb-pro.github.io/lite_MD_editor/

## 📄 License

MIT
