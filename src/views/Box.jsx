import { useRef, useState } from 'react'
import BoxArt from '../components/BoxArt.jsx'
import { Empty, Field, SectionTitle } from '../components/ui.jsx'
import { fmtRelative, todayKey } from '../lib/dates.js'
import { guessTagId, tagMeta } from '../lib/tags.js'
import { boxItems, uid, useStore } from '../store.jsx'

/**
 * 事件箱：所有还没定下来的事都先放这儿——灵感、想做但没排期的、
 * 以及做不完商量后决定「先放下」的。取出来就是正式计划。
 */
export default function Box({ navigate }) {
  const { state, dispatch, notify } = useStore()
  const [title, setTitle] = useState('')
  const inputRef = useRef(null)
  const [picking, setPicking] = useState(null) // 哪一条正在挑日期
  const today = todayKey()
  const items = boxItems(state)

  function add(event) {
    event.preventDefault()
    const text = title.trim()
    if (!text) return
    dispatch({
      type: 'add_box',
      item: {
        id: uid('bx'),
        title: text,
        note: '',
        source: 'manual',
        fromTaskId: null,
        fromProjectId: null,
        tag: guessTagId(text),
        createdAt: new Date().toISOString(),
      },
    })
    setTitle('')
    notify('放进箱子了，它不会跑', 'ok')
  }

  function takeOut(item, date) {
    // 过去的日子没法再排期，选到过去就按今天算
    const target = date && date < today ? today : date
    dispatch({
      type: 'box_to_task',
      itemId: item.id,
      task: {
        id: uid('t'),
        kind: 'normal',
        projectId: item.fromProjectId || null,
        title: item.title,
        tag: item.tag || guessTagId(item.title),
        category: '',
        date: target,
        est_min: null,
        done: false,
        status: 'todo',
        locked: false,
        note: item.note || '',
        noteForAI: false,
      },
    })
    setPicking(null)
    notify(`「${item.title}」已经排进 ${fmtRelative(date, today)}`, 'ok')
  }

  return (
    <main className="screen">
      <header className="topbar">
        <div>
          <button type="button" className="link-btn" onClick={() => navigate('home')}>
            ← 今天
          </button>
          <h1 className="topbar__title">事件箱</h1>
          <p className="topbar__date">{items.length} 件还没定下来的事</p>
        </div>
      </header>

      <section className="box-hero" aria-labelledby="box-hero-title">
        <p className="box-hero__eyebrow">想法收纳处 · {items.length} 件</p>
        <button type="button" className="box-hero__art-button" aria-label="记一件事，放进事件箱" onClick={() => inputRef.current?.focus()}>
          <BoxArt size="hero" />
        </button>
        <h2 className="box-hero__title" id="box-hero-title">先放这里，慢慢来</h2>
        <p className="box-hero__hint">想做的、没想清楚的，都可以先收好。<br />等想好了，再挑一天取出来。</p>
      </section>

      <form className="box-add box-add--art" onSubmit={add}>
        <input
          ref={inputRef}
          className="input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="现在不想安排，先记一句"
          maxLength={40}
          aria-label="往事件箱里加一件事"
        />
        <button type="submit" className="btn btn--primary btn--sm" disabled={!title.trim()}>
          放进箱子
        </button>
      </form>

      <section className="panel">
        <SectionTitle>箱子里的东西</SectionTitle>
        {items.length ? (
          <ul className="box-list">
            {items.map((item) => {
              const tag = tagMeta(state, item.tag, item.tag ? '' : '未分类')
              return (
                <li key={item.id} className="box-item">
                  <div className="box-item__head">
                    <p className="box-item__title">{item.title}</p>
                    <button
                      type="button"
                      className="mini-btn"
                      aria-label={`从箱子里删掉：${item.title}`}
                      onClick={() => {
                        dispatch({ type: 'remove_box', id: item.id })
                        notify('已经从箱子里删掉了', 'ok')
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  <p className="box-item__meta">
                    <span className={`box-item__source ${item.source === 'gaveup' ? 'is-gaveup' : ''}`}>
                      {item.source === 'gaveup' ? '从计划里收进来' : '主动记下'}
                    </span>
                    {tag ? <span> · {tag.emoji} {tag.label}</span> : null}
                    <span> · {fmtRelative(String(item.createdAt).slice(0, 10), today)}记下</span>
                  </p>
                  <div className="box-item__actions">
                    <button type="button" className="btn btn--primary btn--sm" onClick={() => takeOut(item, today)}>
                      放进今天
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => setPicking((prev) => (prev === item.id ? null : item.id))}
                    >
                      挑一天
                    </button>
                  </div>
                  {picking === item.id ? (
                    <Field label="排到哪天" htmlFor={`box-date-${item.id}`} hint="选好就变成一条正式计划。">
                      <input
                        id={`box-date-${item.id}`}
                        className="input"
                        type="date"
                        defaultValue={today}
                        min={today}
                        onChange={(event) => {
                          if (event.target.value) takeOut(item, event.target.value)
                        }}
                      />
                    </Field>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : (
          <Empty title="箱子是空的" hint="空着挺好，说明该定的事都定了。" />
        )}
      </section>

      <p className="footnote">
        箱子里的东西不算计划、不进进度，也不会被催。想清楚了再取出来就行。
      </p>
    </main>
  )
}
