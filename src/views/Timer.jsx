import { useEffect, useMemo, useState } from 'react'
import { DemoTag, Empty, Field, SectionTitle, Sheet, Toggle } from '../components/ui.jsx'
import { diffDays, fmtClock, fmtMinutes, fmtRelative, fmtStopwatch, isoToLocalInput, minutesBetween, todayKey } from '../lib/dates.js'
import { compressImage, deleteImage, getImageUrl, putImage } from '../lib/images.js'
import { clearLeakDismiss, timerLeak } from '../lib/timer.js'
import { uid, useStore } from '../store.jsx'

export default function Timer() {
  const { state, dispatch, notify, now, today } = useStore()
  const [stopOpen, setStopOpen] = useState(false)
  const [pickOpen, setPickOpen] = useState(false)
  const timer = state.timer

  // now 来自 store 里每秒更新的共享时钟，界面才会真的走字
  const elapsed = timer ? now - new Date(timer.startedAt).getTime() : 0
  // 和首页同一条规则：开了 5 小时以上，或者跨天了，才算「可能忘了停」
  const leak = timerLeak(timer, now, today)
  const longRun = Boolean(leak)

  const [makeup, setMakeup] = useState('')
  const [bookmark, setBookmark] = useState(null)

  useEffect(() => {
    const stored = localStorage.getItem('me-de-yi-tian.timer-bookmark')
    if (stored && !timer) setBookmark(stored)
  }, [timer])

  const recent = useMemo(
    () =>
      [...state.sessions]
        .sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime())
        .slice(0, 6)
        .map((session) => ({
          ...session,
          memorial: state.memorials.find((item) => item.sessionId === session.id) || null,
        })),
    [state.sessions, state.memorials],
  )

  function startFor(task) {
    dispatch({
      type: 'start_timer',
      timer: { id: uid('timer'), taskId: task ? task.id : null, label: task ? task.title : '自由活动', startedAt: new Date().toISOString(), status: 'running' },
    })
    setPickOpen(false)
    notify(task ? `开始计时：${task.title}` : '开始计时：自由活动', 'ok')
  }

  /**
   * 结束一次计时。
   * 纪念内容与这次 session 一起提交，sessionId 当场生成，
   * 不从 state.sessions 里倒着取，避免连续保存时挂错记录。
   */
  function stopWith(endedAt, minutes, options = {}) {
    const lit = Boolean(options.lit)
    const label = options.label || timer?.label || '自由活动'
    const sessionId = uid('s')
    dispatch({
      type: 'stop_timer',
      session: {
        id: sessionId,
        taskId: timer?.taskId || null,
        label,
        startedAt: timer?.startedAt,
        endedAt,
        minutes,
        lit,
        litTaskId: lit ? timer?.taskId : null,
      },
      memorial: options.text
        ? {
            id: uid('mm'),
            taskId: timer?.taskId || null,
            sessionId,
            date: todayKey(),
            text: options.text,
            imageId: options.imageId || null,
            createdAt: new Date().toISOString(),
          }
        : null,
    })
    localStorage.removeItem('me-de-yi-tian.timer-bookmark')
    clearLeakDismiss()
    notify(lit ? '记录了时间，并点亮了一个节点' : '时间记录好了', 'ok')
  }

  // 挂计时的候选列表：先按日期从早到晚（过期 → 今天 → 明天…），同一天再按序号
  const undone = state.tasks
    .filter((task) => !task.done && task.status !== 'cancelled' && task.status !== 'boxed')
    .sort((a, b) => diffDays(b.date, a.date) || (a.seq || 999) - (b.seq || 999) || a.title.localeCompare(b.title, 'zh'))

  return (
    <main className="screen">
      <header className="topbar">
        <div>
          <p className="topbar__date">任意时点开始，随时结束</p>
          <h1 className="topbar__title">计时</h1>
        </div>
      </header>

      {timer ? (
        <section className="timer-card">
          <p className="timer-card__label">
            <span className="pulse-dot" aria-hidden="true" /> 计时中
          </p>
          <p className="timer-card__clock">{fmtStopwatch(elapsed)}</p>
          <p className="timer-card__task">{timer.label}</p>
          <p className="timer-card__since">从 {fmtClock(timer.startedAt)} 开始</p>
          {longRun ? (
            <div className="notice notice--warn">
              <p>
                {leak ? leak.reason : '这次计时看起来忘了停'}。如果确实忘了停，补一个<strong>实际结束时间</strong>，我不会自动猜成现在。
              </p>
              <div className="row-2">
                <input
                  className="input"
                  type="datetime-local"
                  aria-label="实际几点结束的"
                  value={makeup}
                  min={isoToLocalInput(timer.startedAt)}
                  max={isoToLocalInput(new Date().toISOString())}
                  onChange={(event) => setMakeup(event.target.value)}
                />
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={!makeup}
                  onClick={() => {
                    const endedAt = new Date(makeup)
                    if (Number.isNaN(endedAt.getTime()) || endedAt <= new Date(timer.startedAt)) {
                      notify('补录时间要晚于开始时间', 'warn')
                      return
                    }
                    stopWith(endedAt.toISOString(), minutesBetween(timer.startedAt, endedAt.toISOString()), { lit: false, label: timer.label })
                  }}
                >
                  按补录时间结束
                </button>
              </div>
            </div>
          ) : null}
          <div className="btn-row">
            <button type="button" className="btn btn--ghost" onClick={() => { dispatch({ type: 'discard_timer' }); notify('已放弃这次计时，没有留下记录', 'warn') }}>
              放弃
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setStopOpen(true)}>
              结束计时
            </button>
          </div>
        </section>
      ) : (
        <section className="timer-card timer-card--idle">
          <p className="timer-card__clock timer-card__clock--idle">00:00:00</p>
          <p className="timer-card__since">现在开始，结束时再决定要不要点亮节点。</p>
          <div className="btn-row">
            <button type="button" className="btn btn--ghost" onClick={() => startFor(null)}>
              自由活动
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setPickOpen(true)}>
              选一条任务开始
            </button>
          </div>
        </section>
      )}

      <p className="hint hint--left">
        <DemoTag children="模拟浮层" /> 手机 App 阶段再决定浮窗形态；这里用页面内浮条模拟，离开页面后不会在系统里悬浮。
      </p>

      <section className="panel panel--soft">
        <SectionTitle>最近记录</SectionTitle>
        {recent.length ? (
          <ul className="session-list">
            {recent.map((session) => (
              <li key={session.id}>
                <div className="session-list__main">
                  <p className="session-list__title">{session.label}</p>
                  <p className="session-list__meta">
                    {fmtClock(session.startedAt)} – {fmtClock(session.endedAt)} · {fmtMinutes(session.minutes)}
                    {session.lit ? ' · 已点亮' : ' · 仅记录'}
                  </p>
                  {session.memorial ? (
                    <p className="session-list__memorial">
                      ✦ {session.memorial.text}
                      {session.memorial.imageId ? <MemorialThumb imageId={session.memorial.imageId} /> : null}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="还没有记录" hint="开始一次计时，结束后就能在这里看到。" />
        )}
      </section>

      {bookmark ? (
        <p className="hint">
          上次留下的一句话：{bookmark}{' '}
          <button type="button" className="link-btn" onClick={() => { localStorage.removeItem('me-de-yi-tian.timer-bookmark'); setBookmark(null) }}>
            清掉
          </button>
        </p>
      ) : null}

      <Sheet open={pickOpen} title="这条计时挂在哪儿" subtitle="关联任务后，结束时可选择点亮它的节点。" onClose={() => setPickOpen(false)}>
        <ul className="pick-list">
          {undone.length ? (
            undone.map((task) => (
              <li key={task.id}>
                <button type="button" className="pick" onClick={() => startFor(task)}>
                  <span>{task.title}</span>
                  <span className="pick__meta">
                    {diffDays(today, task.date) < 0 ? `已过期 · ${fmtRelative(task.date)}` : fmtRelative(task.date)}
                  </span>
                </button>
              </li>
            ))
          ) : (
            <li>
              <p className="hint">暂时没有未完成的事，先记一件吧。</p>
            </li>
          )}
        </ul>
        <button type="button" className="btn btn--ghost btn--block" onClick={() => startFor(null)}>
          不关联任务，记自由活动
        </button>
      </Sheet>

      <StopSheet
        open={stopOpen}
        timer={timer}
        onClose={() => setStopOpen(false)}
        onSave={(options) => {
          stopWith(new Date().toISOString(), Math.max(1, Math.round(elapsed / 60000)), options)
          setStopOpen(false)
        }}
      />
    </main>
  )
}

function MemorialThumb({ imageId }) {
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
  return <img className="memorial-thumb" src={url} alt="这次计时的纪念照片" />
}

function StopSheet({ open, timer, onClose, onSave }) {
  const { state, dispatch, notify } = useStore()
  const task = timer && timer.taskId ? state.tasks.find((item) => item.id === timer.taskId) : null
  const [lit, setLit] = useState(false)
  const [label, setLabel] = useState('')
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [remember, setRemember] = useState(false)

  useEffect(() => {
    if (open) {
      setLit(Boolean(task && !task.done))
      setLabel(timer ? timer.label : '')
      setText('')
      setPhoto(null)
      setRemember(false)
    }
  }, [open, timer, task])

  async function pickFile(event) {
    const file = event.target.files && event.target.files[0]
    if (!file) return
    try {
      setUploading(true)
      const blob = await compressImage(file)
      const id = uid('img')
      await putImage(id, blob)
      const url = await getImageUrl(id)
      setPhoto({ id, url })
    } catch (error) {
      notify(`照片没能保存：${error.message}`, 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Sheet
      open={open}
      title="结束这次计时"
      subtitle={timer ? `${timer.label} · 从 ${fmtClock(timer.startedAt)} 开始` : ''}
      onClose={onClose}
      footer={
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={uploading}
          onClick={() => {
            if (text.trim() && remember) localStorage.setItem('me-de-yi-tian.timer-bookmark', text.trim().slice(0, 40))
            onSave({ lit, label, text: text.trim(), imageId: photo ? photo.id : null })
          }}
        >
          保存记录
        </button>
      }
    >
      <Field label="这次在做什么（可改）" htmlFor="stop-label">
        <input id="stop-label" className="input" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={40} />
      </Field>

      {task ? (
        <div className="stack">
          <p className="field__label">和这条任务的关系</p>
          <div className="radio-list">
            <label className={`radio ${lit ? 'is-active' : ''}`}>
              <input type="radio" checked={lit} onChange={() => setLit(true)} />
              <span>点亮「{task.title}」这个节点</span>
            </label>
            <label className={`radio ${!lit ? 'is-active' : ''}`}>
              <input type="radio" checked={!lit} onChange={() => setLit(false)} />
              <span>只记录时间，不改进度</span>
            </label>
          </div>
        </div>
      ) : (
        <p className="hint hint--left">这次没有关联任务，只记录时间，不会点亮任何节点。</p>
      )}

      <Field label="值得纪念的时刻（可选）" htmlFor="stop-text" hint="挂在这次计时上；照片只存本机，不会上传，也不进分享。">
        <textarea
          id="stop-text"
          className="input input--area"
          rows={2}
          value={text}
          maxLength={60}
          onChange={(event) => setText(event.target.value)}
          placeholder="比如：终于把那句话改顺了"
        />
      </Field>

      <div className="photo-row">
        <label className="photo-picker">
          <input type="file" accept="image/*" onChange={pickFile} />
          <span>{uploading ? '保存中…' : photo ? '换一张' : '＋ 加一张照片'}</span>
        </label>
        {photo ? (
          <div className="photo-preview">
            <img src={photo.url} alt="刚选的照片" />
            <button
              type="button"
              className="mini-btn"
              onClick={async () => {
                await deleteImage(photo.id)
                setPhoto(null)
              }}
              aria-label="移除照片"
            >
              ✕
            </button>
          </div>
        ) : null}
      </div>

      {text.trim() ? <Toggle checked={remember} onChange={setRemember} label="把这句话留到下次打开" hint="只存在本机。" /> : null}

      <p className="hint">漏停怎么办：下次打开时不会自动结束，只会在计时页请你补一个真实结束时间。</p>
    </Sheet>
  )
}
