// 项目配色：同一个长期目标固定一个颜色，日历方块、任务行、目标卡都用它
// 目的：首页把不同目标的子任务混在一天里时，一眼能看出归属
const PALETTE = [
  { id: 'pink', dot: '#f07db3', soft: '#ffe6f2', ink: '#b81763' },
  { id: 'mint', dot: '#5fb69a', soft: '#d9f0e8', ink: '#2f6f5e' },
  { id: 'lav', dot: '#8f86d8', soft: '#e7e3fb', ink: '#564d9c' },
  { id: 'sun', dot: '#dfa23c', soft: '#fbeacb', ink: '#8a6212' },
  { id: 'rose', dot: '#e5809a', soft: '#fbdfe7', ink: '#9c3f57' },
  { id: 'sky', dot: '#5f9fd8', soft: '#dceafa', ink: '#2f6499' },
]

// 普通任务没有项目，用中性色，避免和长期目标抢注意力
export const NEUTRAL_COLOR = { id: 'plain', dot: '#b19da9', soft: '#f3edf0', ink: '#6f5665' }

function hash(text) {
  let value = 0
  for (let i = 0; i < String(text).length; i += 1) {
    value = (value * 31 + String(text).charCodeAt(i)) % 9973
  }
  return value
}

/** 按项目 id 稳定取色：同一个目标刷新前后颜色不变 */
export function projectColor(projectId) {
  if (!projectId) return NEUTRAL_COLOR
  return PALETTE[hash(projectId) % PALETTE.length]
}

/** 按目标在列表里的先后取色：新建的目标依次拿到粉、绿、紫… */
export function projectColorOf(state, projectId) {
  if (!projectId) return NEUTRAL_COLOR
  const index = state.projects.findIndex((project) => project.id === projectId)
  if (index < 0) return projectColor(projectId)
  return PALETTE[index % PALETTE.length]
}

export function taskColor(task) {
  return projectColor(task && task.projectId)
}

/** 内联 CSS 变量，让样式表里直接 var(--dot) / var(--soft) / var(--ink-strong) */
export function colorVars(color) {
  const c = color || NEUTRAL_COLOR
  return { '--dot': c.dot, '--soft': c.soft, '--strong': c.ink }
}
