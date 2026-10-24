// 可路演种子数据：一个长期目标、跨日期子任务、今日普通任务、已完成节点、待处理节点
import { addDays, todayKey } from './dates.js'
import { guessTagId } from './tags.js'

export const SCHEMA_VERSION = 1

const node = (id, projectId, title, date, est_min, extra = {}) => ({
  id,
  kind: 'node',
  projectId,
  title,
  category: extra.category || '备赛',
  tag: extra.tag || guessTagId(title),
  date,
  est_min,
  done: false,
  status: 'todo',
  locked: false,
  note: '',
  noteForAI: false,
  ...extra,
})

const normal = (id, title, date, est_min, extra = {}) => ({
  id,
  kind: 'normal',
  projectId: null,
  title,
  category: '日常',
  tag: extra.tag || guessTagId(title),
  date,
  est_min,
  done: false,
  status: 'todo',
  locked: false,
  note: '',
  noteForAI: false,
  ...extra,
})

export function createSeedState() {
  const today = todayKey()
  const yesterday = addDays(today, -1)
  const now = new Date()
  const createdAt = new Date(now.getTime() - 3 * 86400000).toISOString()

  return {
    version: SCHEMA_VERSION,
    seededAt: new Date().toISOString(),
    settings: { sleepTime: '23:30', onboarded: false, catSkin: 'orange' },
    projects: [
      {
        id: 'p1',
        title: '准备比赛路演',
        category: '备赛',
        tag: 'work',
        ddl: addDays(today, 6),
        createdAt,
        status: 'active',
      },
      {
        id: 'p2',
        title: '投递实习申请',
        category: '求职',
        tag: 'work',
        ddl: today,
        createdAt,
        status: 'active',
      },
    ],
    tasks: [
      node('p1n1', 'p1', '梳理路演脚本', today, 30, {
        done: true,
        status: 'done',
        completedAt: new Date(now.getTime() - 3600000).toISOString(),
      }),
      node('p1n2', 'p1', '打磨开场 30 秒', today, 20),
      node('p1n3', 'p1', '做一版演示流程图', addDays(today, 1), 45),
      node('p1n4', 'p1', '完整演练两遍', addDays(today, 2), 40),
      node('p1n5', 'p1', '检查设备与备用方案', addDays(today, 3), 25),
      node('p1n6', 'p1', '现场彩排', addDays(today, 4), 60),
      node('p2n1', 'p2', '更新一份简历', yesterday, 30, { category: '求职' }),
      node('p2n2', 'p2', '写求职邮件', yesterday, 20, { category: '求职' }),
      normal('t1', '给设计师回消息', today, 10),
      normal('t2', '买明早的咖啡豆', today, null, { note: '楼下那家，要浅烘' }),
      normal('t3', '预约周五会议室', today, 5, {
        done: true,
        status: 'done',
        completedAt: new Date(now.getTime() - 7200000).toISOString(),
      }),
    ],
    box: [
      {
        id: 'bx1',
        title: '把旧照片整理成相册',
        note: '',
        source: 'manual',
        fromTaskId: null,
        fromProjectId: null,
        tag: 'life',
        createdAt: new Date(now.getTime() - 2 * 86400000).toISOString(),
      },
      {
        id: 'bx2',
        title: '试录一期播客的开场',
        note: '',
        source: 'manual',
        fromTaskId: null,
        fromProjectId: null,
        tag: 'fun',
        createdAt: new Date(now.getTime() - 4 * 86400000).toISOString(),
      },
    ],
    customTags: [],
    timer: null,
    sessions: [
      {
        id: 's1',
        taskId: 'p1n1',
        label: '梳理路演脚本',
        startedAt: new Date(now.getTime() - 3 * 3600000).toISOString(),
        endedAt: new Date(now.getTime() - 2.4 * 3600000).toISOString(),
        minutes: 36,
        lit: true,
      },
    ],
    memorials: [
      {
        id: 'mm1',
        taskId: 'p1n1',
        sessionId: 's1',
        date: today,
        text: '把开场那句改顺了，连念三遍都不磕巴',
        imageId: null,
        createdAt: new Date(now.getTime() - 2.4 * 3600000).toISOString(),
      },
    ],
    settlements: [],
    restart: {
      answers: { reason: null, time: null, goal: null },
      draft: null,
      adopted: [],
      appliedAt: null,
      dismissedAt: null,
    },
    undo: [],
  }
}
