# me的一天

面向手机浏览器的一天规划原型：小猫陪你写下今天想做的事、把长期目标拆成节点、排进日程、计时打卡，晚上小结，第二天温和重启。

> **这是可路演的原型，不是成品。** 没有登录、没有后端、没有数据库；AI 部分是**演示模式**——拆解与重启草案都由本地规则和预置样例生成，不会调用任何真实模型。数据只存在当前浏览器里。

## 直接打开（不用装环境）

- 在线版：**https://kunjienie50-creator.github.io/me-de-yi-tian/**
- 仓库：https://github.com/kunjienie50-creator/me-de-yi-tian

手机打开后用浏览器菜单「添加到主屏幕」，观感更接近 App。每台设备的数据独立存在各自的浏览器里，互不同步。

## 技术栈

- Vite 7 + React 19（JavaScript，非 TypeScript）
- 普通 CSS（无 Tailwind / CSS-in-JS / UI 组件库），单一全局样式表 `src/App.css`
- 无路由库：视图由 `src/App.jsx` 里的 `route` 状态切换
- 无状态管理库：`src/store.jsx` 用 `useReducer` + Context
- 小猫是内联 SVG + CSS 动画，没有图片资源依赖

## 本地运行

```bash
npm install
npm run dev
```

打开终端输出的地址（默认 http://localhost:5173/）。手机预览：确保手机与电脑同一 Wi-Fi，访问 `http://<局域网 IP>:5173/`；建议用浏览器的「添加到主屏幕」，观感更接近 App。

### 如果安装阶段报 `spawn EPERM`

受限环境（例如某些沙箱）里 esbuild 的 postinstall 无法启动子进程，可用：

```bash
npm install --ignore-scripts
```

esbuild 的平台二进制会随依赖一起安装，`--ignore-scripts` 不影响 `dev` / `build`。

## 目录结构

```
index.html             页面骨架、移动端 viewport、emoji favicon
vite.config.js         Vite 配置（host: true 便于手机访问）
src/main.jsx           React 挂载入口
src/App.jsx            应用外壳：底部导航、全屏视图、计时浮条
src/App.css            全部样式（含睡前深色主题、弹层、动画）
src/index.css          全局变量、reset、页面背景
src/store.jsx          useReducer 状态机、持久化、选择器、toast
src/lib/
  dates.js             日期与时长格式化（本地时区）
  storage.js           localStorage 读写（含容量不足的提示文案）
  images.js            IndexedDB 存照片、图片压缩
  decompose.js         演示用的目标拆解（规则 + 样例库）
  schedule.js          均匀排期、冲突预检、日期钳制
  restart.js           次日重启：快照、草案、校验、采纳计划
  seed.js              演示种子数据（今天/昨天/明天都是相对日期）
src/components/
  Cat.jsx              小猫（idle / happy / sleepy）
  ui.jsx               弹层 Sheet、全屏 FullScreen、Chips、Toggle 等
  TaskRow.jsx          任务行（点亮、计时、锁定、状态徽标）
src/views/
  Home.jsx             今天：小猫、重启横幅、今日清单、加任务、快捷入口
  Goals.jsx            长期目标列表 + 四步新建向导
  Schedule.jsx         排期页：按天分组、拖动/堆叠/锁定、撤销
  Timer.jsx            计时：自由活动或挂到任务、结束可点亮并写纪念
  Bedtime.jsx          睡前结算（可跳过）+ 收尾动画
  Restart.jsx          温和重启：快照 → 三问 → 草案 → 勾选采纳
  Review.jsx           一天回顾 + 分享文字（照片默认不进）
  Settings.jsx         睡眠时间、本地数据体积、导出 JSON、重置演示数据
```

## 可用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器（带 HMR） |
| `npm run build` | 生产构建，产物在 `dist/` |
| `npm run preview` | 预览生产构建结果 |

## 产品边界（原型刻意守住的规则）

- **进度只数节点**：不算百分比，`已完成节点数 / 节点总数`。
- **AI 不排日期**：拆解只给清单和估时；均匀排期由规则完成，截止日是硬约束，AI 不改。
- **写之前先给草案**：拆解、重启都是「草案 → 校验 → 你勾选确认 → 才写入」，没勾的保持原样。
- **不静默迁移**：未完成节点只有两个后移来源——你自己拖动，或采纳重启草案。锁定节点谁都动不了（手动拖动也会被拦）。
- **取消 ≠ 删除**：建议取消需要你逐个二次确认，任务本体留在项目里；原型不提供长期子任务的永久删除入口。
- **未回答 = 未知**：睡前没点的条目记为「状态未知」，不推断成没做完，也不责备；没做完的事不进分享卡。
- **睡前结算可跳过**：跳过不删任何任务，只是留了一条 `skipped` 记录。
- **照片只在本机**：存在 IndexedDB，不上传；分享/导出默认不带，需要显式勾选并二次确认。
- **漏停不猜**：计时忘记结束，下次打开只问「真实结束时间」，不自动结束。

## 数据存在哪里

| 内容 | 位置 | 说明 |
| --- | --- | --- |
| 任务、目标、结算、计时、纪念 | `localStorage` 键 `me-de-yi-tian.state.v1` | 刷新/重开浏览器都在；设置页可导出 JSON |
| 纪念照片 | IndexedDB 库 `me-de-yi-tian-images` | 只在本机；重置会一并清空 |
| 计时页「记住上次写的」 | `localStorage` 键 `me-de-yi-tian.timer-bookmark` | 一句话备忘，方便下次计时 |

设置页 →「重置演示数据」会清空以上内容并恢复初始种子（相对今天重新生成）。

## 演示走位（约 3 分钟）

1. **今天**：看到小猫问「昨天有 2 个节点没做完」，点横幅进「温和重启」。
2. **重启**：先看「会发给模型的快照」，回答三问中任意几问 → 生成草案 → 只勾一半 → 应用；再回排期页点「撤销」，证明可以回退。
3. **目标**：新建长期目标 → 写「准备下周的产品分享」→ 看草案、改节点、点「太细了」重拆 → 设截止日 → 预览均匀排期 → 创建。
4. **排期**：把某个节点推到隔壁天、用「⇤」堆叠、锁一个节点再点箭头（会被拦住），然后撤销。
5. **计时**：选一条任务开始 → 结束 → 勾「点亮这个节点」并写一句纪念。
6. **睡前**：逐条点「点亮了 / 没做完 / 不想说」→ 保存 → 看收尾动画 → 进回顾。
7. **回顾**：切到昨天看降级说明；点「分享这一天」看固定样片，打开照片开关（会出现二次确认）。
8. **设置**：看本地数据体积 → 导出 JSON → 最后再点「重置演示数据」回到起点。

## 更新在线版

在线版是 `gh-pages` 分支上的静态构建产物，`main` 只放源码。改完代码后重新发布：

```bash
npm run build
rm -rf ../pages-build && mkdir ../pages-build && cp -r dist/. ../pages-build/
cd ../pages-build && git init -b gh-pages && git add -A \
  && git commit -m "deploy" \
  && git remote add origin https://github.com/kunjienie50-creator/me-de-yi-tian.git \
  && git push -f origin gh-pages
```

推送后 1–2 分钟生效，GitHub 的 Actions 页面能看到这次 Pages 构建的状态。

## 一起改这个项目

- **只看/只跑**：仓库已公开，直接 `git clone` 即可。
- **要提交代码**：需要仓库管理员在 Settings → Collaborators 里邀请（Write 权限），否则只能 fork。
- 本地开发不要提交 `node_modules`、`dist`、`.npm-cache`、`.dsh-check`，已在 `.gitignore` 里排除。
- 这个仓库目前**没有 LICENSE**：公开可见，但严格来说未授予他人复制、改造、再发布的许可。要开源给队友/外部复用，建议加一个（MIT 最省事）。

## 已知限制

- 演示拆解只覆盖少量样例主题（路演、论文、健身、英语、作品集…），其余走通用模板，不会真的理解你的输入。
- 没有多端同步、没有账号、没有通知；「计时浮层」是页面内浮条，不是系统级悬浮窗。
- 分享是文字样片，不生成真正的图片文件；真实版才会渲染成卡片。
- 长期子任务暂不提供永久删除入口（符合产品当前边界）。

## 提交约定

- 主分支为 `main`。
- 不提交依赖目录、构建产物、本地缓存；仓库中不应出现任何密钥或令牌。
