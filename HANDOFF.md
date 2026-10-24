# 交接说明（给下一位队友）

> 最后更新：2026-10-24 · 对应代码提交 `e9d22f0`（`main`）；本文档随 `8f151b2` 提交
> 产品名：me的一天（手机浏览器优先的原型）
> 线上：https://kunjienie50-creator.github.io/me-de-yi-tian/ ｜ 本地：`npm run dev` 后 http://127.0.0.1:5173/

这是一个**可以当面演示的原型**，不是能上线给真实用户的产品。所有数据只存在浏览器本地，没有登录、没有后端数据库，唯一的网络请求是「本机 → DeepSeek」的模型调用。

---

## 1. 五分钟跑起来

```bash
git clone https://github.com/kunjienie50-creator/me-de-yi-tian.git
cd me-de-yi-tian
npm install --cache .\.npm-cache --ignore-scripts   # Windows 沙箱下必须这样装，见下方说明
cp .env.example .env                                 # 填 DEEPSEEK_API_KEY（不填也能跑，会走离线规则）
npm run dev                                          # http://127.0.0.1:5173/
```

- **Windows 上 `npm install` 的两个坑**：①默认缓存目录在项目外，可能报 `EPERM`，必须 `--cache .\.npm-cache`；②esbuild 的 postinstall 可能报 `spawn EPERM`，用 `--ignore-scripts` 跳过即可，`@esbuild/win32-x64` 的二进制已随依赖装好，不影响运行。
- 不想装依赖，也可以直接看线上地址（线上是静态构建，**没有 AI 代理，永远走离线规则**）。
- 想验证 AI 界面但暂时没 key：`.env` 里加 `DEEPSEEK_MOCK=1`，代理返回固定样例。

---

## 2. 这一版有什么（已完成）

| 模块 | 能做什么 |
| --- | --- |
| 今天 | 小猫（可点、可换三套形象）、广告语、横向一周日历、开始计时/睡前结算两个大入口、事件箱卡片、昨天没做完的提示、今日清单、加任务（带分类） |
| 目标 | 长期目标列表；新建流程 = 一句话弹窗 → 确认清单（序号 + P1/P2/P3 + 估时）→ 日历拖拽排期（截止日钉住） |
| 排期 | 按天分组、拖/推/堆叠/锁定、撤销、顺序冲突提示 |
| 计时 | 自由活动或挂到任务、实时走字、结束可点亮节点并写纪念（可传照片，存 IndexedDB） |
| 漏停 | 超过 5 小时或跨日 → 首页提示条「补录 / 先不管」，补录只问「实际几点结束」，不按当前时间倒算 |
| 睡前 | 逐条三选一（点亮了/没做完/不想说）、估时校正、可跳过、收尾动画、没做完可「先收进事件箱」 |
| 重启 | 快照 → 三个可跳过的问题 → 草案（建议安排/建议放下/需要你决定）→ 逐条勾选采纳，也可「放进事件箱」 |
| 回顾 | 只看你确认过的内容，缺数据降级说明，分享用固定样片，照片默认不进 |
| 事件箱 | 随手记下 / 挑一天 / 放进今天 / 删除；从计划收进来的保留来源标记 |
| 分类 | 六类默认标签 + 关键词猜 + 自建；任务行、目标卡、排期页都会显示 |
| 设置 | 模型状态、小猫形象、睡眠时间、本地数据体积、导出 JSON、重置演示数据 |
| 大模型 | 三处：拆解清单、次日重排草案、备注补一句；失败自动降级到规则并标注 |

---

## 3. 不能被改掉的产品规则（评审时会被问）

1. **进度只数点亮过的节点**，不出现百分比。
2. **模型只拆清单、只提建议，不排日期**；日期由 `src/lib/schedule.js` 的规则算（均匀铺、按估时负载、前驱在后继之前）。
3. 所有模型/规则产出都是**草案**：先展示 → 本地校验 → 用户勾选 → 才写入。
4. **硬禁令**：不改截止日、不删除任务、不移动 `locked` 节点；以上在 `validateRestartDraft()` 与 `planAdoption()` 里各有一道。
5. 每个未完成节点必须出现在「建议安排 / 建议放下 / 需要你决定」之一，漏了就补成「需要你决定」，不会静默消失。
6. **没回答 = 未知**，不推断失败、不评价、不责备；睡前结算可以整段跳过。
7. **从今天移除 ≠ 删除**；睡前的收尾动画也不删任务；原型暂不提供永久删除长期子任务的入口。
8. 照片只存本机、默认不进分享与导出；备注默认不进 AI 快照，除非用户勾选。

---

## 4. 目录地图

```
server/ai.js            本地 AI 代理：三个 Prompt + DeepSeek 调用 + /api/ai/* 中间件 + mock
vite.config.js          读 .env、挂代理中间件（只在本机 dev/preview 存在）
src/App.jsx             应用壳：视图切换、底部导航、计时浮条、hash 路由
src/App.css             全部样式（约 3400 行，含深色睡前主题、弹层、日历、动画）
src/index.css           变量与页面底色
src/store.jsx           useReducer 状态机 + 持久化 + 选择器 + toast + 共享时钟
src/lib/
  dates.js              日期键、相对日期、时长格式化
  storage.js            localStorage 读写（含容量不足提示）
  images.js             IndexedDB 存照片 + 压缩
  decompose.js          离线拆解样例库 + validateDraft + PRIORITY_META/guessPriority
  ai.js                 前端调用 /api/ai/*，失败返回 { ok:false }
  schedule.js           planEven / clampToNeighbors / orderConflicts / sortBySeq
  restart.js            快照 buildSnapshot / 规则草案 buildRestartDraft / 校验 / 采纳计划
  timer.js              漏停判定（5h 或跨日）+ 「先不管」记忆
  tags.js               分类默认表 + guessTagId + tagMeta
  slogans.js            四句广告语，按日期固定
  seed.js               演示种子数据（相对今天生成）
src/components/         Cat / WeekStrip / TaskRow / TagPicker / ui.jsx（Sheet、FullScreen、Chips…）
src/views/              Home / Goals / Schedule / Timer / Bedtime / Restart / Review / Box / Settings
README.md               使用说明（面向使用者与演示）
HANDOFF.md              本文件（面向开发者）
```

---

## 5. 数据模型与存储

- 单一状态树存在 `localStorage` 的 `me-de-yi-tian.state.v1`；照片在 IndexedDB 的 `me-de-yi-tian-images`；漏停「先不管」记在 `me-de-yi-tian.leak-dismissed.v1`。
- 任务 `task` 关键字段：`kind`（`normal` 普通任务 / `node` 长期子任务，同层存在同一数组）、`projectId`、`date`、`seq`、`priority`（high/mid/low）、`tag`、`est_min`、`done`、`status`（`todo` / `unknown` / `skipped` / `cancelled` / `boxed`）、`locked`、`note`、`noteForAI`。
- `cancelled` 和 `boxed` 都不会出现在今天清单、目标节点、排期里；`boxed` 的任务本体保留，可以在事件箱里取出。
- 旧数据升级在 `store.jsx` 的 `initState()` 里做（补 `seq`/`priority`/`tag`），改字段时记得在这里加兼容。
- 重置演示数据 = `createSeedState()`，种子日期全部相对「今天」生成，所以永远不会过期。

---

## 6. 大模型怎么接的（要改 Prompt 就从这里入手）

链路：`src/lib/ai.js` → `POST /api/ai/{decompose|restart|note}` → `server/ai.js` → `https://api.deepseek.com/chat/completions`（`response_format: json_object`）。

- **Prompt A（拆解）**：`server/ai.js` 的 `DECOMPOSE_SYSTEM`。要求只输出 JSON、不排日期、3–8 个节点、label ≤20 字、est 10–240、带 `seq`/`priority`。返回后仍过 `validateDraft()`（重排序号、截断超量、补分类）。
- **Prompt B（重排）**：`RESTART_SYSTEM`。schema 很硬：`proposals[].date` 只能是今天或明天、`adjust_est` 的 `new_est_min` 10–240 且最多 ×1.5、五类桶每类只放该放的、`restart_nodes` 每个 id 必须恰好出现一次。返回后过 `validateRestartDraft()`。
- **备注**：`NOTE_SYSTEM`，≤40 字。
- 失败分支：没 key / 401 / 超时（45s）/ 非 JSON / 网络断，都返回 `{ok:false, code, error}`，前端换成离线规则，并在界面标「离线规则生成（原因）」。
- 成本（实测，按当前 Prompt，改长会涨）：一次拆解约 325 in / 186 out tokens；一次重排约 674 in / 76 out（未完成项越多 in 越高）；备注约 128 in / 14 out。
- 安全：key 只在本机 `.env`（已 gitignore），只被 Node 读；线上静态版没有代理，不会带 key；备注只有勾了 `noteForAI` 才进快照。

想调的两个已知点（上一轮评测时记下的）：

1. **P1 给太多**：实测三个节点连续都是 P1，区分度不够。可在 Prompt A 里加「high 最多 2 个」。
2. **估时偏大**：路演这种会出现「制作初稿 120 分钟」。可加「单节点 ≤90 分钟，超出就再拆一步」。

---

## 7. 几个容易踩的实现细节

- **共享时钟**：`store.jsx` 每秒更新 `now`，并把派生的 `today` 一起放进 context；计时走字、跨零点换天、漏停检测都依赖它。不要在组件里各自 `Date.now()`，否则会出现「刷新才走字」的旧 bug。
- **Sheet / FullScreen 用 `createPortal(..., document.body)`**：不加 portal 会被底部 tabbar 盖住、点击穿透；加了之后写选择器要注意容器前缀（CSS 选择器可能命中被遮挡页面的按钮）。
- **日期排序方向**：`diffDays(a, b)` 返回 `b - a`，所以 `sort((a, b) => diffDays(b.date, a.date))` 才是升序；踩过一次。
- **日历拖拽**：松手定位优先用 `event.target.closest('[data-date]')`，`elementFromPoint` 在元素滚出视口时返回 null；格子必须用 `div[role=button]`，不要 button 套 button。
- **hash 路由**：切页用 `history.replaceState`，同时监听 `hashchange`，刷新/手改地址都能直达。
- **小猫换形象**：`src/components/Cat.jsx` 顶部 `CAT_SKINS`；把 skin 写成 `{ id, name, kind:'image', idle, happy, sleepy }` 放进 `public/` 即可，代码不用动。

---

## 8. 已知问题与待办（按建议优先级）

1. **没有自动化测试**：目前全部靠手动/CDP 脚本验收。建议先补 `schedule.js`（前驱约束、均匀排期）和 `restart.js`（校验、采纳）的单元测试，这两块最容易回归。
2. **拆解质量的 Prompt 调优**（P1 过多、估时偏大，见第 6 节）。
3. **草案页没显示模型的原始 JSON 与 token 用量**：调 Prompt 时不便，可在「校验结果」里展开。
4. **回顾页的动画方案没定**：目前是静态卡 + 收尾动画，等视觉方案一起大改。
5. **事件箱入口位置待定**：现在是首页卡片 + `#box`；也考虑做成底部导航第五个 tab 或悬浮按钮。
6. **计时浮条是页面内模拟**，不是系统浮窗；真机 App 阶段再定形态。
7. **线上版没有 AI**：这是有意的（避免 key 泄漏）。如果以后要在线上演示模型，需要一个真正的服务端（至少一个 serverless 函数）。
8. **没有 LICENSE**：仓库公开可见，但严格说未授予复制/再发布许可，要开源复用建议补 MIT。

---

## 9. 已经手动验收过的路径（回归时照着走一遍）

1. 首页渲染（广告语、周历、两个入口、事件箱、提示条）→ 加一条任务 → 分类自动猜 + 可自建。
2. 新建目标四步：弹窗 → 清单（改优先级/删节点/重拆）→ 钉截止日 → 拖方块（合法成功、越界被拦）→ 创建 → 排期页序号与 P1/P2/P3 正常。
3. 排期页：推/堆/锁/撤销；锁定节点点箭头会被拦并有提示。
4. 计时：开始 → 走字（不刷新）→ 结束 → 点亮 + 纪念；放弃不留记录。
5. 漏停：把 `timer.startedAt` 改成 6 小时前 → 首页提示条 → 补录填 11:44 → 记录 120 分钟；点「先不管」刷新不再弹。
6. 睡前：三选一、估时校正、跳过不删任务、收进事件箱。
7. 重启：生成草案（模型/规则）、勾选采纳、撤销、先不调整不改数据。
8. 回顾：确认过的内容、未知占比、分享文字复制、照片开关二次确认。
9. 设置：模型状态、换猫、导出 JSON、重置演示数据。
10. 刷新持久化 + 桌面 1280 宽下居中 520 列。

---

## 10. 提交与发布

- `main` 放源码，`gh-pages` 放静态构建产物（线上版）。提交信息用 `feat:/fix:/docs:/chore:` 前缀，一次一件事。
- 发布：

```bash
npm run build
rm -rf ../pages-build && mkdir ../pages-build && cp -r dist/. ../pages-build/
cd ../pages-build && git init -b gh-pages && git add -A && git commit -m deploy \
  && git remote add origin https://github.com/kunjienie50-creator/me-de-yi-tian.git \
  && git push -f origin gh-pages
```

- 本机到 GitHub 需要代理（`http.https://github.com.proxy=http://127.0.0.1:7890`），新克隆的仓库要重新配一次。
- 回退：已推送的用 `git revert <sha>`；只在本地没推才用 `git reset --hard <sha>`；只回退某个文件用 `git checkout <sha> -- <path>`。
- 邀请协作：仓库 Settings → Collaborators，给 Write 权限。

---

## 11. 想继续做的话

1. 补单元测试（排期、重启校验）。
2. Prompt 调优 + 草案页展示原始 JSON 与用量。
3. 回顾页视觉/动画定稿。
4. 事件箱入口定稿；「此刻最该做的一件」推到首页最前。
5. 真机适配细节（安全区、iOS 输入框键盘遮挡、长列表滚动性能）。
