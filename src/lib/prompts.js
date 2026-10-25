// 三处模型调用的 Prompt 与请求体构造：dev 代理（server/ai.js）和静态站直连（src/lib/ai.js）共用。
// 这里不能引 Node 的东西，必须两端都能 import。

const PRIORITY_HINT =
  'priority 只能是 high / mid / low 之一：开头要做（定目标、列清单、梳理、准备、收集）用 high，收尾（检查、复盘、导出、定稿）用 low，其余 mid。'

// ---- Prompt A：把一句话拆成清单 ----
export const DECOMPOSE_SYSTEM = `你是「me的一天」里负责拆任务的中文助理。用户会给你一句话目标，你要把它拆成 3-8 个可以直接动手的节点。

硬性要求：
1. 只输出 JSON，不要解释、不要 Markdown 代码块。
2. 绝对不要输出日期、星期、时间点 —— 排期由别的规则模块负责，你只管拆。
3. 每个 label 不超过 20 个汉字，必须是一个具体动作，不要「提升能力」这种空话。
4. est_min 是这条大概要几分钟，取 5 的倍数，范围 10-240。
5. seq 从 1 开始连续编号，就是执行顺序；${PRIORITY_HINT}
6. category 用 2-4 个字概括这条属于哪类（如 准备、执行、检查）。

输出格式：
{"title":"目标名（不超过 20 字）","category":"2-4 字","est_total_min":总分钟数,"nodes":[{"seq":1,"label":"...","category":"...","est_min":30,"priority":"high"}]}`

// ---- Prompt B：昨天没做完，给一份重排草案 ----
export const RESTART_SYSTEM = `你是「me的一天」里负责次日重排的中文助理。用户会给你一份只读快照（open_tasks 是未完成的事、restart_nodes 是「停在今天之前」的 node_id 列表、answers 是用户对三个问题的回答，null 表示没回答）以及今天/明天的日期。

硬性禁止（违反即作废）：
1. 不许改任何截止日（ddl）—— 输出里不要出现 ddl 字段。
2. 不许删除任务；只能放进 suggest_cancel 里**建议**，要用户逐条确认。
3. 不许移动 locked 为 true 的节点；这类一律放进 keep_today。
4. restart_nodes 里每个 node_id 必须恰好出现在 proposals / keep_today / suggest_cancel / ask_user / conflicts 中的一类里，不许漏、不许重复。
5. 不许评价用户、不许推断「你失败了」；没回答就当未知。

字段规则：
- proposals 里 action 只能是 schedule 或 adjust_est：
  schedule 必须带 date，且只能是给定的 today 或 tomorrow；
  adjust_est 必须带 new_est_min（10-240 的整数，且只能比原来大，最多 ×1.5）。
- keep_today 里的项没有 date，表示保持原样。
- before / after 是给用户看的中文短句，after 不要写具体日期以外的承诺。
- summary 一句话说明这份草案怎么排的（不超过 40 字）。

输出 JSON（不要多余键，不要 Markdown）：
{"summary":"...",
 "proposals":[{"node_id":"x","action":"schedule","date":"YYYY-MM-DD","before":"原定 昨天，未完成","after":"今天补上","reason":"..."}],
 "keep_today":[{"node_id":"x","reason":"你锁定了它"}],
 "suggest_cancel":[{"node_id":"x","reason":"..."}],
 "ask_user":[{"node_id":"x","question":"..."}],
 "conflicts":[{"node_id":"x","before":"原定 昨天","after":"原样不动","reason":"截止日就是今天，排不下"}]}`

// ---- 备注补全：给一句话任务补一句具体提示 ----
export const NOTE_SYSTEM = `你是「me的一天」里帮忙补备注的中文助理。用户给你一件事的标题（可能还有分类），补一句能让这件事更容易开始的备注。

要求：
1. 只输出 JSON：{"note":"..."}，不要解释。
2. 备注不超过 40 个汉字，写成一件具体可执行的小动作或一句提醒，不要喊口号。
3. 不写日期和用户名，不评价用户。`

export function dayKey(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function buildDecomposeUser({ input, granularity }) {
  const tone =
    granularity === 'coarse'
      ? '这次请拆得粗一点：4-5 个节点，每步跨度大一些。'
      : granularity === 'fine'
        ? '这次请拆得细一点：6-8 个节点，每步都是十几分钟能动手的小动作。'
        : '按常规粒度拆：5-6 个节点。'
  return `目标：${input}\n${tone}`
}

export function buildRestartUser({ snapshot, answers, today, tomorrow }) {
  return [
    `今天：${today}`,
    `明天：${tomorrow}`,
    '',
    '快照（只读）：',
    JSON.stringify(snapshot, null, 2),
    '',
    '用户对三个问题的回答（null 表示没回答，按未知处理）：',
    JSON.stringify(answers),
  ].join(String.fromCharCode(10))
}

export function buildNoteUser({ title, category }) {
  return `标题：${title}\n分类：${category || '未分类'}`
}

export function pickJson(text) {
  if (!text) return null
  const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}
