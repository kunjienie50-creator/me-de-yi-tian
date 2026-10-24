// 计划分类：睡觉 / 学习&工作 / 娱乐 / 社交 / 运动 / 生活琐事
// 创建计划时先按标题猜一个默认分类，用户可以改，也可以自己加新分类。

export const DEFAULT_TAGS = [
  { id: 'work', label: '学习&工作', emoji: '📚' },
  { id: 'sleep', label: '睡觉', emoji: '🌙' },
  { id: 'fun', label: '娱乐', emoji: '🎮' },
  { id: 'social', label: '社交', emoji: '☕' },
  { id: 'sport', label: '运动', emoji: '🏃' },
  { id: 'life', label: '生活琐事', emoji: '🧺' },
]

export const FALLBACK_TAG = 'life'

// 关键词规则：命中越多分越高，分高的分类胜出；都没命中时落到「生活琐事」
const RULES = [
  ['sleep', ['睡', '午休', '早睡', '熬夜', '打盹', '赖床']],
  [
    'sport',
    ['跑', '健身', '运动', '瑜伽', '球', '游泳', '拉伸', '骑车', '爬山', '训练', '力量', '深蹲', '俯卧撑', '器械', '有氧', '跳绳', '体能', '徒步', '拳'],
  ],
  ['social', ['约', '见面', '聊天', '电话', '聚餐', '朋友', '家人', '同事', '拜访', '消息', '回复']],
  ['fun', ['剧', '游戏', '电影', '番', '听歌', '漫画', '播客', '休息', '散步', '逛']],
  [
    'work',
    [
      '写',
      '学',
      '课',
      '作业',
      '论文',
      '报告',
      'ppt',
      '演示',
      '复习',
      '背',
      '准备',
      '路演',
      '简历',
      '面试',
      '邮件',
      '会议',
      '整理资料',
      '设计',
      '方案',
      '流程图',
      '排期',
      '读',
      '书',
    ],
  ],
  ['life', ['买', '收', '洗', '打扫', '做饭', '取', '寄', '缴', '搬', '修']],
]

/** 猜一个分类 id。纯本地规则，不调用模型。 */
export function guessTagId(text = '') {
  const source = String(text).toLowerCase()
  if (!source.trim()) return FALLBACK_TAG
  let best = FALLBACK_TAG
  let bestScore = 0
  RULES.forEach(([id, words]) => {
    const score = words.reduce((sum, word) => (source.includes(word) ? sum + word.length : sum), 0)
    if (score > bestScore) {
      best = id
      bestScore = score
    }
  })
  return best
}

/** 默认分类 + 用户自建的分类 */
export function allTags(state) {
  return [...DEFAULT_TAGS, ...((state && state.customTags) || [])]
}

/** 拿到一个分类的完整信息；找不到时按分类名兜底，保证界面永远有东西显示 */
export function tagMeta(state, id, fallbackLabel = '') {
  const found = allTags(state).find((tag) => tag.id === id)
  if (found) return found
  if (fallbackLabel) return { id: id || 'unknown', label: fallbackLabel, emoji: '·' }
  return null
}
