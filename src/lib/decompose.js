// 演示模式的任务拆解：本地规则 + 预置样例，不调用任何模型服务
// 输出的结构与《提示词_任务拆解与任务重排.md》Prompt A 的 JSON 契约一致，
// 同样走「草案 → 规则校验 → 用户确认 → 应用」的唯一通道。

const CATEGORY_DEFAULT = '日常'
const EST_MIN = 10
const EST_MAX = 240
const EST_FALLBACK = 30

const SAMPLES = [
  {
    test: /路演|比赛|演讲|答辩|汇报|presentation/i,
    title: '准备比赛路演',
    category: '备赛',
    sets: {
      coarse: [
        ['梳理路演脚本', 30],
        ['完整演练两遍', 40],
        ['检查设备与现场彩排', 60],
      ],
      default: [
        ['梳理路演脚本', 30],
        ['打磨开场 30 秒', 20],
        ['做一版演示流程图', 45],
        ['完整演练两遍', 40],
        ['检查设备与备用方案', 25],
        ['现场彩排', 60],
      ],
      fine: [
        ['写一句话主题', 10],
        ['列路演大纲', 20],
        ['写完开场白', 25],
        ['做演示流程图', 40],
        ['录一遍自评', 20],
        ['完整演练两遍', 40],
        ['检查设备与备用方案', 25],
        ['现场彩排', 60],
      ],
    },
  },
  {
    test: /论文|报告|写作|开题|文献|paper|thesis/i,
    title: '写完课程论文',
    category: '学习',
    sets: {
      coarse: [
        ['定论文选题与结构', 60],
        ['写完初稿', 120],
        ['修改并定稿', 60],
      ],
      default: [
        ['定选题与结构', 45],
        ['读三篇关键文献', 60],
        ['写文献综述', 60],
        ['写完正文初稿', 120],
        ['通读一遍改逻辑', 45],
        ['排版与定稿', 30],
      ],
      fine: [
        ['确认选题与问题', 20],
        ['列三级提纲', 30],
        ['读三篇关键文献', 60],
        ['整理文献笔记', 30],
        ['写文献综述', 60],
        ['写正文第一版', 120],
        ['通读改逻辑', 45],
        ['排版与定稿', 30],
      ],
    },
  },
  {
    test: /健身|减脂|运动|跑步|训练|fitness/i,
    title: '恢复规律健身',
    category: '健身',
    sets: {
      coarse: [
        ['定一周三次的训练时间', 20],
        ['完成第一次训练', 45],
        ['坚持两周并记录', 60],
      ],
      default: [
        ['定一周三次训练时间', 20],
        ['准备一份训练计划', 30],
        ['完成第一次训练', 45],
        ['记录一周完成情况', 20],
        ['补一次拉伸与放松', 30],
        ['复盘并调整计划', 20],
      ],
      fine: [
        ['定训练目标', 15],
        ['选三套基础动作', 20],
        ['写一周训练表', 20],
        ['完成第一次训练', 45],
        ['记录训练感受', 10],
        ['完成第二次训练', 45],
        ['拉伸与放松', 30],
        ['复盘并调整计划', 20],
      ],
    },
  },
  {
    test: /英语|单词|口语|雅思|托福|四六级/i,
    title: '准备英语口语',
    category: '学习',
    sets: {
      coarse: [
        ['选一套口语素材', 30],
        ['每天跟读二十分钟', 20],
        ['录一段自评', 30],
      ],
      default: [
        ['选一套口语素材', 30],
        ['整理常用表达', 40],
        ['跟读练三天', 60],
        ['录一段自评', 30],
        ['找人对话一次', 45],
        ['复盘语音问题', 30],
      ],
      fine: [
        ['选口语素材', 30],
        ['整理 20 个常用表达', 40],
        ['跟读第一天', 20],
        ['跟读第二天', 20],
        ['跟读第三天', 20],
        ['录一段自评', 30],
        ['找人对话一次', 45],
        ['复盘语音问题', 30],
      ],
    },
  },
  {
    test: /作品集|设计|portfolio|简历|求职|面试/i,
    title: '整理作品集',
    category: '创作',
    sets: {
      coarse: [
        ['选出三个项目', 20],
        ['写完项目说明', 90],
        ['排版与导出', 40],
      ],
      default: [
        ['选出三个主打项目', 20],
        ['补全每个项目说明', 90],
        ['统一视觉与排版', 45],
        ['写一段自我介绍', 30],
        ['导出并自测可读性', 20],
        ['请朋友看一遍', 20],
      ],
      fine: [
        ['选出三个主打项目', 20],
        ['整理项目素材', 30],
        ['写项目一说明', 30],
        ['写项目二说明', 30],
        ['写项目三说明', 30],
        ['统一视觉与排版', 45],
        ['写一段自我介绍', 30],
        ['导出并自测可读性', 20],
      ],
    },
  },
]

const GENERIC = {
  coarse: [
    ['明确目标与验收标准', 20],
    ['做出第一版', 60],
    ['检查并收尾', 30],
  ],
  default: [
    ['明确目标与验收标准', 20],
    ['收集需要的材料', 30],
    ['列一份步骤清单', 20],
    ['做出第一版', 60],
    ['检查并收尾', 30],
  ],
  fine: [
    ['写明目标与验收标准', 20],
    ['列出所需材料', 20],
    ['收集材料', 30],
    ['列步骤清单', 20],
    ['做出第一版', 60],
    ['补上缺的部分', 40],
    ['检查并收尾', 30],
    ['写一句复盘', 10],
  ],
}

// 优先级：拆分时就定下来，序号决定先后（前驱必须排在后面的事之前）
export const PRIORITY_META = {
  high: { label: '先做', short: 'P1', className: 'is-high' },
  mid: { label: '接着做', short: 'P2', className: 'is-mid' },
  low: { label: '收尾', short: 'P3', className: 'is-low' },
}

const PRIORITY_KEYS = ['high', 'mid', 'low']

// 关键词判断优先级：起步/拍板类先做，检查/收尾类放后面
const PRIORITY_RULES = {
  high: ['定', '确认', '明确', '选', '写一句', '列', '梳理', '准备', '收集', '大纲', '提纲'],
  low: ['检查', '收尾', '复盘', '自测', '排版', '定稿', '导出', '放松', '请朋友', '记录'],
}

export const GRANULARITY_LABEL = {
  coarse: '太粗了',
  default: '重新拆一次',
  fine: '太细了',
}

function clampEst(value) {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return EST_FALLBACK
  return Math.min(EST_MAX, Math.max(EST_MIN, n))
}

function trimLabel(label) {
  const text = String(label || '').trim()
  return text.length > 20 ? `${text.slice(0, 20)}` : text
}

function normalizePriority(value, index, total) {
  if (PRIORITY_KEYS.includes(value)) return value
  // 没有显式给优先级时：第一个节点默认「先做」，其余默认「接着做」；
  // 收尾类节点交给关键词规则判断，避免把「现场彩排」这种关键步骤自动降级
  if (index === 0) return 'high'
  return 'mid'
}

/** 按关键词给一个建议优先级（演示规则；接真模型时由模型直接给 priority） */
function guessPriority(label, index, total) {
  const text = String(label || '')
  if (PRIORITY_RULES.high.some((word) => text.includes(word))) return 'high'
  if (PRIORITY_RULES.low.some((word) => text.includes(word))) return 'low'
  return normalizePriority(null, index, total)
}

function normalizeCategory(value) {
  const text = String(value || '').trim()
  if (!text) return CATEGORY_DEFAULT
  return text.slice(0, 4)
}

/** 本地规则拆解，返回与 Prompt A 契约一致的对象 */
export function decompose(rawInput, granularity = 'default') {
  const input = String(rawInput || '').trim()
  if (input.length < 2) {
    return { kind: 'chat', short_reply: '再多说一点点，我才好帮你拆。' }
  }

  const sample = SAMPLES.find((item) => item.test.test(input))
  const mode = granularity === 'coarse' || granularity === 'fine' ? granularity : 'default'
  const rows = sample ? sample.sets[mode] : GENERIC[mode]
  const title = sample ? (input.length <= 20 ? input : sample.title) : input.slice(0, 20)

  const nodes = rows.map(([label, est], index) => ({
    seq: index + 1,
    priority: guessPriority(label, index, rows.length),
    label: trimLabel(label),
    category: normalizeCategory(sample ? sample.category : CATEGORY_DEFAULT),
    est_min: clampEst(est),
  }))

  return {
    kind: 'long_term',
    title,
    category: normalizeCategory(sample ? sample.category : CATEGORY_DEFAULT),
    est_total_min: nodes.reduce((sum, n) => sum + n.est_min, 0),
    nodes,
  }
}

/** 模型输出（这里是本地规则输出）必须经过的 schema 校验 */
export function validateDraft(draft) {
  const issues = []
  if (!draft || typeof draft !== 'object') {
    return { ok: false, issues: ['返回内容不是有效的 JSON 对象'], draft: null }
  }
  if (draft.kind === 'chat') {
    return { ok: true, issues, draft: { kind: 'chat', short_reply: String(draft.short_reply || '').slice(0, 50) } }
  }
  if (draft.kind !== 'long_term' && draft.kind !== 'normal') {
    issues.push('kind 不在允许范围内')
  }
  const rawNodes = Array.isArray(draft.nodes) ? draft.nodes : []
  if (rawNodes.length < 1) {
    issues.push('没有任何子任务节点')
  }
  const nodes = rawNodes
    .map((node) => ({
      label: trimLabel(node && node.label),
      category: normalizeCategory(node && node.category),
      est_min: clampEst(node && node.est_min),
      priority: node && node.priority,
    }))
    .filter((node) => node.label)

  let clean = nodes.map((node, index) => ({
    ...node,
    seq: index + 1,
    priority: normalizePriority(node.priority, index, nodes.length),
  }))
  if (nodes.length > 8) {
    clean = clean.slice(0, 8)
    issues.push('节点超过 8 个，已截断')
  }
  if (clean.length < 2) {
    issues.push('节点少于 2 个，建议再拆细一点')
  }

  return {
    ok: issues.length === 0,
    issues,
    draft: {
      kind: draft.kind === 'normal' ? 'normal' : 'long_term',
      title: String(draft.title || '').slice(0, 40),
      category: normalizeCategory(draft.category),
      est_total_min: clean.reduce((sum, n) => sum + n.est_min, 0),
      nodes: clean,
    },
  }
}

/** 模拟一次「生成中」，让草案出现的过程可感知 */
export function fakeLatency(ms = 720) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
