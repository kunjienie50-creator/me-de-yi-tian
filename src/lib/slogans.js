// 广告语：首页每天固定用一句，点一下可以换下一句。
export const SLOGANS = [
  '今天一小步，喵了一大步',
  'Me的一天，踩我的步点',
  '喵的一天，踩me的步点',
  'Me的一天，喵着向前。',
]

/** 按日期挑一句，同一天打开看到的是同一句，不会乱跳。 */
export function sloganForDay(dayKey = '') {
  let hash = 0
  for (let i = 0; i < dayKey.length; i += 1) {
    hash = (hash * 31 + dayKey.charCodeAt(i)) % 9973
  }
  return SLOGANS[hash % SLOGANS.length]
}
