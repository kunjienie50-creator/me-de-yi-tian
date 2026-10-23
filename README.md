# me的一天

面向手机浏览器的一天规划原型。写下一个目标，小猫帮你记住它。

> 当前进度：**第一步 · 目标卡片**
> 已实现：小猫首页、输入一个目标、点击后显示目标卡片。
> 暂未实现：登录、后端、数据库、数据持久化（刷新页面即清空）。

## 技术栈

- Vite 7 + React 19（JavaScript，非 TypeScript）
- 普通 CSS（无 Tailwind / CSS-in-JS / UI 组件库）
- 无任何运行时依赖的插画：小猫是内联 SVG + CSS 动画

## 本地运行

```bash
npm install
npm run dev
```

然后打开终端输出的地址（默认 http://localhost:5173/）。

手机预览：确保手机与电脑在同一 Wi-Fi，访问 `http://<你的局域网 IP>:5173/`。

### 如果安装阶段报 `spawn EPERM`

部分沙箱/受限环境下 esbuild 的 postinstall 无法启动子进程，可用：

```bash
npm install --ignore-scripts
```

esbuild 的平台二进制会随依赖一起安装，`--ignore-scripts` 不影响 `dev` / `build`。

## 目录结构

```
index.html          页面骨架与移动端 viewport 配置
vite.config.js      Vite 配置（host: true 便于手机访问）
src/main.jsx        React 挂载入口
src/App.jsx         首页：小猫、日期、气泡、目标输入、目标卡片
src/App.css         布局、卡片、动画
src/index.css       全局变量、reset、页面背景
```

## 可用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器（带 HMR） |
| `npm run build` | 生产构建，产物在 `dist/` |
| `npm run preview` | 预览生产构建结果 |

## 提交约定

- 主分支为 `main`。
- 不提交依赖目录、构建产物、本地缓存；仓库中不应出现任何密钥或令牌。
