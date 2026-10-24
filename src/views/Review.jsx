import { useEffect, useMemo, useState } from 'react'
import { Badge, DemoTag, Empty, Field, Pips, SectionTitle, Sheet, Toggle } from '../components/ui.jsx'
import { addDays, fmtClock, fmtMinutes, fmtRelative, todayKey } from '../lib/dates.js'
import { getImageUrl } from '../lib/images.js'
import { useStore } from '../store.jsx'

const DAYS_BACK = 6

export default function Review({ navigate }) {
  const { state, notify } = useStore()
  const today = todayKey()
  const days = useMemo(() => {
    const list = []
    for (let i = 0; i <= DAYS_BACK; i += 1) list.push(addDays(today, -i))
    return list
  }, [today])

  const [date, setDate] = useState(today)
  const [exportOpen, setExportOpen] = useState(false)
  const [withPhotos, setWithPhotos] = useState(false)
  const [photoConfirmed, setPhotoConfirmed] = useState(false)

  const data = useMemo(() => {
    const settlement = state.settlements.find((item) => item.date === date) || null
    const items = settlement ? settlement.items : []
    const doneIds = new Set(items.filter((row) => row.result === 'done').map((row) => row.taskId))
    const undoneIds = new Set(items.filter((row) => row.result === 'undone').map((row) => row.taskId))
    const unknownCount = items.filter((row) => row.result === 'unknown').length

    const doneTasks = state.tasks.filter(
      (task) => doneIds.has(task.id) || (task.done && task.completedAt && startsOn(task.completedAt, date)),
    )
    const sessions = state.sessions.filter((session) => startsOn(session.startedAt, date))
    const memorials = state.memorials.filter((item) => item.date === date)
    const undoneTasks = state.tasks.filter((task) => undoneIds.has(task.id))
    const total = items.length || doneTasks.length

    return { settlement, doneTasks, undoneTasks, unknownCount, sessions, memorials, total, skipped: Boolean(settlement && settlement.skipped) }
  }, [state, date])

  const hasAnything = data.doneTasks.length || data.sessions.length || data.memorials.length || data.settlement
  const exportText = buildExportText({ date, data, today })

  async function copyText() {
    try {
      await navigator.clipboard.writeText(exportText)
      notify('回顾文字已复制', 'ok')
    } catch {
      notify('这个浏览器不允许自动复制，可以手动选中上面的文字', 'warn')
    }
  }

  return (
    <main className="screen">
      <header className="topbar">
        <div>
          <p className="topbar__date">只看你确认过的内容</p>
          <h1 className="topbar__title">一天回顾</h1>
        </div>
      </header>

      <div className="day-chips">
        {days.map((day) => (
          <button
            key={day}
            type="button"
            className={`day-chip ${date === day ? 'is-active' : ''}`}
            aria-pressed={date === day}
            onClick={() => setDate(day)}
          >
            <span className="day-chip__main">{fmtRelative(day, today)}</span>
            <span className="day-chip__sub">{day.slice(5).replace('-', '/')}</span>
          </button>
        ))}
      </div>

      {!hasAnything ? (
        <Empty title="这一天没有留下记录" hint="没有记录不等于没做事；回顾只呈现你写过的东西。" />
      ) : (
        <>
          <section className="panel review-card" key={date}>
            <p className="panel__eyebrow">✦ {fmtRelative(date, today)}</p>
            <h2 className="panel__title">{data.doneTasks.length ? `点亮了 ${data.doneTasks.length} 件事` : '这一天慢慢过去了'}</h2>
            {data.total ? <Pips done={data.doneTasks.length} total={data.total} /> : null}

            {data.skipped || !data.settlement ? (
              <p className="review-note">
                {data.skipped ? '那天你选择了直接跳过，没有做结算。' : '那天没有做睡前结算，所以下面只显示你主动留下的痕迹。'}
                不补推断，也不写「应该完成」。
              </p>
            ) : null}

            {data.doneTasks.length ? (
              <ul className="review-list review-list--done">
                {data.doneTasks.map((task) => (
                  <li key={task.id}>
                    <span className="review-list__dot" aria-hidden="true">✦</span>
                    <span>{task.title}</span>
                    {task.est_min ? <span className="review-list__meta">{fmtMinutes(task.est_min)}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}

            {data.undoneTasks.length ? (
              <>
                <p className="review-sub">确认没做完的（不评价）</p>
                <ul className="review-list">
                  {data.undoneTasks.map((task) => (
                    <li key={task.id}>
                      <span className="review-list__dot review-list__dot--muted" aria-hidden="true">·</span>
                      <span>{task.title}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {data.unknownCount ? <p className="review-note">{data.unknownCount} 件事是「不想说 / 还没想好」，只记为未知。</p> : null}

            {data.sessions.length ? (
              <>
                <p className="review-sub">花了时间的地方</p>
                <ul className="review-list">
                  {data.sessions.map((session) => (
                    <li key={session.id}>
                      <span className="review-list__dot" aria-hidden="true">⏱</span>
                      <span>{session.label}</span>
                      <span className="review-list__meta">
                        {fmtClock(session.startedAt)} · {fmtMinutes(session.minutes)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>

          {data.memorials.length ? (
            <section className="panel panel--soft">
              <SectionTitle>纪念时刻</SectionTitle>
              <ul className="memorial-list">
                {data.memorials.map((item) => (
                  <li key={item.id}>
                    <p className="memorial-list__text">✦ {item.text}</p>
                    {item.imageId ? <MemorialImage imageId={item.imageId} /> : null}
                  </li>
                ))}
              </ul>
              <p className="hint hint--tight">照片只存在这台设备上，默认不进入分享与导出。</p>
            </section>
          ) : null}
        </>
      )}

      <button type="button" className="btn btn--primary btn--block" onClick={() => setExportOpen(true)}>
        分享这一天
      </button>

      <p className="footnote">
        <DemoTag children="固定样片" /> 原型用文字卡片模拟导出；照片默认不出现，需要你显式勾选并二次确认。
      </p>

      <Sheet
        open={exportOpen}
        title="分享这一天"
        subtitle="只包含你确认完成的事和你写下的纪念。"
        onClose={() => setExportOpen(false)}
        footer={
          <div className="stack">
            <button type="button" className="btn btn--primary btn--block" onClick={copyText}>
              复制文字
            </button>
            <p className="hint hint--center">原型不生成图片文件；真实版会渲染成一张卡片。</p>
          </div>
        }
      >
        <div className="export-card">
          <p className="export-card__brand">me的一天</p>
          <p className="export-card__date">{fmtRelative(date, today)} · {date}</p>
          <p className="export-card__headline">{data.doneTasks.length ? `点亮了 ${data.doneTasks.length} 件事` : '安静的一天'}</p>
          <ul className="export-card__list">
            {data.doneTasks.slice(0, 4).map((task) => (
              <li key={task.id}>✦ {task.title}</li>
            ))}
          </ul>
          {data.memorials.length ? <p className="export-card__memorial">「{data.memorials[0].text}」</p> : null}
        </div>

        <Field label="复制的内容（可改）">
          <textarea className="input input--area" rows={6} value={exportText} readOnly />
        </Field>

        <Toggle
          checked={withPhotos}
          onChange={(next) => {
            setWithPhotos(next)
            if (!next) setPhotoConfirmed(false)
          }}
          label="在预览里带上照片"
          hint="默认关闭。照片不会上传，也不会出现在复制出的文字里。"
        />
        {withPhotos && !photoConfirmed ? (
          <div className="notice notice--warn">
            <p>照片可能包含私人信息，确定要放进这次的预览吗？</p>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPhotoConfirmed(true)}>
              我确认，带照片预览
            </button>
          </div>
        ) : null}
        {withPhotos && photoConfirmed && data.memorials.some((item) => item.imageId) ? (
          <div className="photo-strip">
            {data.memorials
              .filter((item) => item.imageId)
              .map((item) => (
                <MemorialImage key={item.id} imageId={item.imageId} />
              ))}
          </div>
        ) : null}

        <p className="hint hint--left">
          <Badge tone="muted">不进分享</Badge> 没做完的事不会出现在分享卡里，也不会用来评价你。
        </p>
      </Sheet>
    </main>
  )
}

function MemorialImage({ imageId }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let alive = true
    getImageUrl(imageId).then((next) => {
      if (alive) setUrl(next)
    })
    return () => {
      alive = false
    }
  }, [imageId])
  if (!url) return null
  return <img className="memorial-photo" src={url} alt="纪念照片" />
}

function startsOn(iso, dateKey) {
  if (!iso) return false
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return false
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` === dateKey
}

function buildExportText({ date, data, today }) {
  const lines = [`me的一天 · ${fmtRelative(date, today)}（${date}）`, '']
  if (data.doneTasks.length) {
    lines.push(`点亮了 ${data.doneTasks.length} 件事：`)
    data.doneTasks.forEach((task) => lines.push(`· ${task.title}`))
  } else {
    lines.push('安静的一天，没有确认完成的节点。')
  }
  if (data.sessions.length) {
    const minutes = data.sessions.reduce((sum, session) => sum + (session.minutes || 0), 0)
    lines.push('', `一共记录了 ${fmtMinutes(minutes)} 的专注时间。`)
  }
  if (data.memorials.length) {
    lines.push('', `值得纪念：${data.memorials[0].text}`)
  }
  lines.push('', '（没有记录没做完的事，也不评价。）')
  return lines.join('\n')
}
