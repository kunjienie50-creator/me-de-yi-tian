import { useMemo } from 'react'
import { Badge, DemoTag, Empty, Pips } from '../components/ui.jsx'
import { colorVars, projectColorOf } from '../lib/colors.js'
import { addDays, dayRange, diffDays, fmtMinutes, fmtRelative } from '../lib/dates.js'
import { tagMeta } from '../lib/tags.js'
import { clampToNeighbors, detectConflicts, orderConflicts, sortBySeq } from '../lib/schedule.js'
import { PRIORITY_META } from '../lib/decompose.js'
import { projectNodes, projectProgress, useStore } from '../store.jsx'

export default function Schedule({ projectId, navigate }) {
  const { state, dispatch, notify, today } = useStore()
  const project = state.projects.find((item) => item.id === projectId)
  const accent = projectColorOf(state, projectId)

  const nodes = useMemo(() => sortBySeq(projectNodes(state, projectId).filter((node) => node.status !== 'cancelled')), [state.tasks, projectId])
  const progress = projectProgress(state, projectId)
  const conflicts = useMemo(() => detectConflicts(nodes, project ? project.ddl : today, today), [nodes, project, today])
  const orderIssues = useMemo(() => orderConflicts(nodes), [nodes])

  if (!project) {
    return (
      <main className="screen">
        <Empty title="找不到这个目标" hint="它可能已经被重置。" />
        <button type="button" className="btn btn--ghost btn--block" onClick={() => navigate('goals')}>
          回到目标列表
        </button>
      </main>
    )
  }

  // 排期只排今天和以后：过去的日子不显示，落在那里的节点进「在截止日之外」（可以一键挪到今天）
  const minDate = today
  const endDate = diffDays(minDate, project.ddl) < 0 ? minDate : project.ddl
  const days = dayRange(minDate, endDate)

  const grouped = days.map((date) => ({
    date,
    items: nodes.filter((node) => node.date === date),
  }))

  const loose = nodes.filter((node) => !days.includes(node.date))

  function moveNode(node, delta) {
    // 锁定的节点不参与任何自动调整，手动拖动也要先解锁，避免误碰
    if (node.locked) {
      notify('这个节点已锁定，先点锁取消锁定再挪', 'warn')
      return
    }
    const index = nodes.findIndex((item) => item.id === node.id)
    const wanted = addDays(node.date, delta)
    const next = clampToNeighbors(nodes, index, wanted, minDate, endDate)
    if (next.error) {
      notify(next.error, 'warn')
      return
    }
    if (next.date === node.date) {
      notify(delta < 0 ? '已经到最早可放的日期' : '已经到截止日了', 'warn')
      return
    }
    dispatch({ type: 'set_changes', changes: [{ id: node.id, date: next.date }], label: `移动「${node.title}」` })
  }

  function stackNode(node, index) {
    if (node.locked) {
      notify('这个节点已锁定，先解锁再挪', 'warn')
      return
    }
    const prev = nodes[index - 1]
    if (!prev) {
      notify('这是第一个节点，前面没有可以堆叠的', 'warn')
      return
    }
    const result = clampToNeighbors(nodes, index, prev.date, minDate, endDate)
    if (result.error) {
      notify(result.error, 'warn')
      return
    }
    if (diffDays(node.date, prev.date) >= 0) {
      notify('它已经在同一天或更早了', 'warn')
      return
    }
    dispatch({ type: 'set_changes', changes: [{ id: node.id, date: prev.date }], label: `把「${node.title}」堆到 ${prev.date}` })
  }

  // 过期节点挪回今天：连同它后面还在过去的节点一起挪，否则前驱规则会拦住它
  function pullToToday(node) {
    const index = nodes.findIndex((item) => item.id === node.id)
    const behind = nodes.slice(index).filter((item) => String(item.date) < String(today) && !item.done)
    if (!behind.length) return
    const locked = behind.find((item) => item.locked)
    if (locked) {
      notify(`「${locked.title}」已锁定，先解锁再挪`, 'warn')
      return
    }
    dispatch({
      type: 'set_changes',
      changes: behind.map((item) => ({ id: item.id, date: today })),
      label: `把 ${behind.length} 个节点挪到今天`,
    })
    notify(behind.length > 1 ? `这 ${behind.length} 个节点一起挪到今天了` : '挪到今天了', 'ok')
  }

  return (
    <main className="screen">
      <header className="topbar">
        <div>
          <button type="button" className="link-btn link-btn--back" onClick={() => navigate('goals')}>
            ← 长期目标
          </button>
          <h1 className="topbar__title">{project.title}</h1>
          <p className="topbar__date">
            截止 {fmtRelative(project.ddl)} ·{' '}
            {diffDays(today, project.ddl) >= 0 ? `还剩 ${diffDays(today, project.ddl)} 天` : '已过期'} · {tagMeta(state, project.tag, project.category)?.label || '未分类'}
          </p>
        </div>
      </header>

      <section className="panel">
        <Pips done={progress.done} total={progress.total} />
        <p className="hint hint--tight">进度只数点亮的节点，不算百分比。</p>
      </section>

      {orderIssues.length ? (
        <div className="notice notice--warn">
          {orderIssues.map((issue) => (
            <p key={issue.nodeId}>{issue.text}，前驱应该排在前面。</p>
          ))}
        </div>
      ) : null}

      {conflicts.length ? (
        <div className={`notice ${conflicts[0].level === 'danger' ? 'notice--danger' : 'notice--warn'}`}>
          {conflicts.map((conflict) => (
            <p key={conflict.text}>{conflict.text}</p>
          ))}
          <p className="notice__foot">系统不会替你延期或取消；决定权在你，也可以在下面手动拖。</p>
        </div>
      ) : null}

      <div className="schedule-head">
        <h2 className="section-title__h">排期</h2>
        <div className="schedule-head__actions">
          <span className="hint hint--tight">拖动只挪节点，不删任务</span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={!state.undo || state.undo.length === 0}
            onClick={() => {
              dispatch({ type: 'restore_undo' })
              notify('已撤销上一次调整', 'ok')
            }}
          >
            撤销
          </button>
        </div>
      </div>

      <ul className="schedule" style={colorVars(accent)}>
        {grouped.map(({ date, items }) => (
          <li key={date} className={`schedule__day ${date === today ? 'is-today' : ''}`}>
            <div className="schedule__dayhead">
              <span className="schedule__date">{fmtRelative(date, today)}</span>
              <span className="schedule__sum">
                {items.length} 个节点 · {fmtMinutes(items.reduce((sum, item) => sum + (item.est_min || 0), 0))}
              </span>
            </div>
            {items.length ? (
              <ul className="schedule__nodes">
                {items.map((node) => (
                  <li key={node.id} className={`sched-node ${node.done ? 'is-done' : ''}`}>
                    <button
                      type="button"
                      className={`task-row__check ${node.done ? 'is-on' : ''}`}
                      onClick={() => {
                        dispatch({ type: 'complete_task', id: node.id, done: !node.done })
                        if (!node.done) notify(`点亮了「${node.title}」`, 'ok')
                      }}
                      aria-label={node.done ? `取消完成：${node.title}` : `点亮：${node.title}`}
                    >
                      {node.done ? '✓' : ''}
                    </button>
                    <div className="sched-node__body">
                      <p className="sched-node__title">
                        <span className="sched-node__seq">{node.seq || '·'}</span>
                        {node.title}
                      </p>
                      <p className="sched-node__meta">
                        <span className={`prio prio--${node.priority || 'mid'}`}>{PRIORITY_META[node.priority || 'mid'].short}</span>
                        {node.est_min ? fmtMinutes(node.est_min) : '未估时'}
                        {node.locked ? ' · 已锁定' : ''}
                        {node.status === 'undone' ? ' · 已确认未完成' : ''}
                      </p>
                    </div>
                    <div className="sched-node__actions">
                      <button type="button" className="mini-btn" aria-label="提前一天" onClick={() => moveNode(node, -1)}>
                        ←
                      </button>
                      <button type="button" className="mini-btn" aria-label="推后一天" onClick={() => moveNode(node, 1)}>
                        →
                      </button>
                      <button
                        type="button"
                        className="mini-btn"
                        aria-label="堆叠到前一个节点的日期"
                        title="堆叠：和上一个节点放同一天"
                        onClick={() => stackNode(node, nodes.indexOf(node))}
                      >
                        ⇤
                      </button>
                      <button
                        type="button"
                        className={`mini-btn ${node.locked ? 'is-on' : ''}`}
                        aria-label={node.locked ? '取消锁定' : '锁定节点'}
                        onClick={() => dispatch({ type: 'toggle_lock', id: node.id })}
                      >
                        {node.locked ? '🔒' : '🔓'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="schedule__blank">空着</p>
            )}
          </li>
        ))}
      </ul>

      {loose.length ? (
        <section className="panel panel--soft">
          <p className="panel__eyebrow">在截止日之外</p>
          <ul className="mini-list">
            {loose.map((node) => (
              <li key={node.id} className="mini-list__row">
                <span className="mini-list__date">{fmtRelative(node.date, today)}</span>
                <span className="mini-list__title">{node.title}</span>
                {String(node.date) < String(today) ? (
                  <button type="button" className="mini-btn mini-btn--text" onClick={() => pullToToday(node)}>
                    挪到今天
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="footnote">
        <DemoTag children="规则排期" /> 有估时就尽量让每天预计投入接近，没有估时就每天节点数差不超过 1；只有最近 1–3 个未完成节点会出现在今天的首页。
        {' '}
        <Badge tone="muted">AI 不安排日期</Badge>
      </p>
    </main>
  )
}
