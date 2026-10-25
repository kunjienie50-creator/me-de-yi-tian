import { useMemo, useState } from 'react'
import Cat from '../components/Cat.jsx'
import { Badge, Empty, Field, SectionTitle } from '../components/ui.jsx'
import { aiRestart } from '../lib/ai.js'
import { fmtMinutes, fmtRelative, todayKey } from '../lib/dates.js'
import {
  GOAL_OPTIONS,
  REASON_OPTIONS,
  TIME_OPTIONS,
  buildRestartDraft,
  buildSnapshot,
  collectRestartNodes,
  restartHistory,
  planAdoption,
  validateRestartDraft,
} from '../lib/restart.js'
import { useStore } from '../store.jsx'

const STEPS = ['ask', 'draft', 'done']

export default function Restart({ navigate }) {
  const { state, dispatch, notify } = useStore()
  const today = todayKey()
  const nodes = useMemo(() => collectRestartNodes(state), [state.tasks, today])
  const tomorrow = useMemo(() => {
    const [y, m, d] = today.split('-').map(Number)
    const date = new Date(y, m - 1, d + 1)
    const pad = (n) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  }, [today])

  // 草案里那些「今天排了、但你通常做不完」的条目：标一句提醒，并给一个一键挪到明天
  function cautionOf(row) {
    const cap = draft && draft.insights ? draft.insights.capacity_min : null
    if (!cap || !row.typical_min || row.action !== 'schedule' || row.date !== today) return null
    if (row.typical_min <= cap) return null
    return `今天只有约 ${cap} 分钟，这条你通常要 ${fmtMinutes(row.typical_min)}`
  }

  function moveProposalToTomorrow(row) {
    setDraft((current) => ({
      ...current,
      proposals: current.proposals.map((item) =>
        item.node_id === row.node_id
          ? { ...item, date: tomorrow, after: '挪到明天，今天先留着力气' }
          : item,
      ),
    }))
    notify('这条挪到明天了，其余不动', 'ok')
  }

  const [step, setStep] = useState('ask')
  const [answers, setAnswers] = useState({ reason: null, time: null, goal: null })
  const [draft, setDraft] = useState(null)
  const [dropped, setDropped] = useState([])
  const [selected, setSelected] = useState([])
  const [cancelConfirm, setCancelConfirm] = useState(null)
  const [snapshotOpen, setSnapshotOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [source, setSource] = useState('rule')
  const [aiNote, setAiNote] = useState('')

  const snapshot = useMemo(() => (snapshotOpen ? buildSnapshot(state) : null), [snapshotOpen, state])

  async function generate() {
    dispatch({ type: 'set_restart', patch: { answers } })
    setBusy(true)
    // 先问本地模型；没 key / 没代理 / 超时 / 返回不合规，就用离线规则，并在草案上标出来
    let candidate = null
    let usedSource = 'rule'
    let error = ''
    // 规则草案先生成一份：既是兜底，也提供「今天有多少时间 / 历史用时」这些上下文
    const ruleDraft = buildRestartDraft(state, answers)
    const history = restartHistory(state)
    const ai = await aiRestart(buildSnapshot(state), answers, {
      capacity: ruleDraft.insights ? ruleDraft.insights.capacity_min : null,
      history,
    })
    if (ai.ok) {
      candidate = { ...ai.draft }
      usedSource = 'model'
    } else {
      error = ai.error || ''
    }
    if (!candidate) {
      // 本地规则生成有一点点延迟，避免点完瞬间跳过去
      await new Promise((resolve) => setTimeout(resolve, 420))
      candidate = ruleDraft
    }
    // 模型草案不带这几项展示信息时，用规则算出来的补上
    candidate.insights = candidate.insights || ruleDraft.insights
    if (Array.isArray(candidate.proposals)) {
      const map = new Map(history.map((item) => [item.node_id, item.typical_min]))
      candidate.proposals = candidate.proposals.map((row) =>
        row.typical_min || !map.get(row.node_id) ? row : { ...row, typical_min: map.get(row.node_id) },
      )
    }
    setSource(usedSource)
    setAiNote(error)
    const checked = validateRestartDraft(candidate, state)
    setBusy(false)
    setDraft(checked.draft)
    setDropped(checked.dropped)
    setSelected(
      checked.draft.proposals
        .filter((row) => row.action !== 'keep_today')
        .map((row) => row.node_id),
    )
    setStep('draft')
  }

  function adopt() {
    const ids = selected
    const changes = planAdoption(draft, ids, state)
    dispatch({ type: 'apply_restart', changes, adoptedIds: ids })
    // 这里只统计"排期/估时"的写入；取消是用户单独确认的，不算进这句话
    if (changes.length) notify(`按草案调整了 ${changes.length} 处`, 'ok')
    else notify('这次没有改动排期，其余保持原样', 'ok')
    setStep('done')
  }

  // 用户可能在草案页里直接把某件事收进事件箱，标题上的数量要跟着变
  function isAlive(nodeId) {
    const task = state.tasks.find((row) => row.id === nodeId)
    return Boolean(task) && task.status !== 'boxed' && task.status !== 'cancelled'
  }

  const draftCounts = draft
    ? {
        schedule: draft.proposals.filter((row) => row.action !== 'keep_today' && isAlive(row.node_id)).length,
        cancel: draft.suggest_cancel.filter((row) => isAlive(row.node_id)).length,
        conflicts: draft.conflicts.filter((row) => isAlive(row.node_id)).length,
      }
    : null

  const liveSummary = draftCounts
    ? [
        draftCounts.schedule ? `${draftCounts.schedule} 个建议安排` : '',
        draftCounts.cancel ? `${draftCounts.cancel} 个建议放下` : '',
        draftCounts.conflicts ? `${draftCounts.conflicts} 个要你决定` : '',
      ]
        .filter(Boolean)
        .join('，')
    : ''

  function toggleCancel(nodeId) {
    setCancelConfirm(nodeId)
  }

  // 用户说「这件事先不做了」：收进事件箱，比直接取消更温和，之后还能取出来
  function boxIt(nodeId) {
    dispatch({ type: 'task_to_box', taskId: nodeId })
    setCancelConfirm(null)
    notify('已放进事件箱，任务本身保留', 'ok')
  }

  function confirmCancel(nodeId) {
    dispatch({ type: 'update_task', id: nodeId, patch: { status: 'cancelled', done: false } })
    setCancelConfirm(null)
    notify('这个节点已取消（任务本身保留在项目里）', 'ok')
  }

  if (!nodes.length && step !== 'done') {
    return (
      <main className="screen">
        <header className="topbar">
          <div>
            <p className="topbar__date">昨天没做完的</p>
            <h1 className="topbar__title">今天没有需要顺延的节点</h1>
          </div>
          <button type="button" className="icon-btn" onClick={() => navigate('home')} aria-label="关闭">
            ✕
          </button>
        </header>
        <Empty title="干干净净的一天" hint="今天之前没有留下未完成的节点，这里就不打扰你了。" />
        <button type="button" className="btn btn--ghost btn--block" onClick={() => navigate('home')}>
          回到今天
        </button>
      </main>
    )
  }

  return (
    <main className="screen">
      <header className="topbar">
        <div>
          <p className="topbar__date">第 {STEPS.indexOf(step) + 1} / {STEPS.length} 步</p>
          <h1 className="topbar__title">昨天没做完的</h1>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={() => {
            if (step !== 'done') dispatch({ type: 'dismiss_restart' })
            navigate('home')
          }}
          aria-label="关闭"
        >
          ✕
        </button>
      </header>

      {step === 'ask' ? (
        <div className="stack">
          <div className="restart-hero">
            <Cat mood="idle" skin={state.settings.catSkin || 'orange'} className="cat--restart" />
            <p className="restart-hero__text">
              有 <strong>{nodes.length}</strong> 件停在今天之前。我不会自己把它们往后挪，也不会替你改截止日。
              先回答两三个小问题，我再给一份草案给你挑。
            </p>
          </div>

          <ul className="restart-list">
            {nodes.map((node) => {
              const project = node.projectId ? state.projects.find((row) => row.id === node.projectId) : null
              return (
                <li key={node.id} className="restart-list__row">
                  <span className="restart-list__title">{node.title}</span>
                  <span className="restart-list__meta">
                    {fmtRelative(node.date, today)} · {project ? project.title : '普通任务'}
                    {node.locked ? ' · 已锁定' : ''}
                  </span>
                </li>
              )
            })}
          </ul>

          <Field label="昨天为什么没做完？（可跳过）" hint="选什么都不会被评价，只是帮我判断该往后挪还是拆细。">
            <div className="chips">
              {REASON_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`chip ${answers.reason === option.value ? 'is-active' : ''}`}
                  onClick={() => setAnswers((prev) => ({ ...prev, reason: prev.reason === option.value ? null : option.value }))}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="今天大概有多少时间？（可跳过）">
            <div className="chips">
              {TIME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`chip ${answers.time === option.value ? 'is-active' : ''}`}
                  onClick={() => setAnswers((prev) => ({ ...prev, time: prev.time === option.value ? null : option.value }))}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="这个目标还想继续吗？（可跳过）">
            <div className="chips">
              {GOAL_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`chip ${answers.goal === option.value ? 'is-active' : ''}`}
                  onClick={() => setAnswers((prev) => ({ ...prev, goal: prev.goal === option.value ? null : option.value }))}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </Field>

          <p className="hint hint--left">不回答也可以，我会按「还不确定」处理，不推断成失败。</p>

          <div className="notice">
            <p>草案只是建议：每件未完成的事都会明确出现在「建议安排 / 建议放下 / 需要你决定」里，不会漏项。</p>
            <button type="button" className="link-btn" onClick={() => setSnapshotOpen((prev) => !prev)}>
              {snapshotOpen ? '收起' : '看看会发给模型的快照'}
            </button>
            {snapshot ? <pre className="snapshot">{JSON.stringify(snapshot, null, 2).slice(0, 1200)}</pre> : null}
          </div>

          <button type="button" className="btn btn--primary btn--block" onClick={generate} disabled={busy}>
            {busy ? '正在让模型过一遍…' : '生成草案'}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--block"
            onClick={() => {
              dispatch({ type: 'dismiss_restart' })
              navigate('home')
            }}
          >
            今天先不管这些
          </button>
        </div>
      ) : null}

      {step === 'draft' && draft ? (
        <div className="stack">
          <section className="panel">
            <p className="panel__eyebrow">
              <span className={`ai-badge ${source === 'model' ? 'is-model' : ''}`}>
                {source === 'model' ? '本地模型生成' : '离线规则生成'}
              </span>
            </p>
            <h2 className="panel__title">{liveSummary || draft.summary}</h2>
            <p className="hint hint--tight">勾选你同意的部分，没勾的保持原样。截止日和已锁定节点不会被改。</p>
            {draft.insights && (draft.insights.capacity_label || draft.insights.planned_today_min) ? (
              <div className="insight-card">
                {draft.insights.capacity_label ? <p className="insight-card__row">{draft.insights.capacity_label}</p> : null}
                {draft.insights.planned_today_min ? (
                  <p className="insight-card__row">
                    这份草案在今天的安排约 {draft.insights.planned_today_min} 分钟
                    {draft.insights.capacity_min && draft.insights.planned_today_min > draft.insights.capacity_min
                      ? '，可能装不下，可以把下面的勾去掉'
                      : ''}
                  </p>
                ) : null}
                {draft.insights.rhythm_label ? (
                  <p className="insight-card__row insight-card__row--quiet">
                    你通常 {draft.insights.rhythm_label} 更在状态，难的可以放这个时段
                  </p>
                ) : null}
                {draft.insights.history_count ? (
                  <p className="insight-card__row insight-card__row--quiet">
                    其中 {draft.insights.history_count} 条用了你自己的历史用时来估算
                  </p>
                ) : null}
              </div>
            ) : null}
            {source === 'model' ? (
              <p className="ai-hint ai-hint--tight">
                <span className="ai-hint__text">模型给的建议已经过本地校验：越界的丢弃、漏项的补成「需要你决定」。</span>
              </p>
            ) : null}
            {source === 'rule' && aiNote ? (
              <p className="ai-hint ai-hint--tight">
                <span className="ai-hint__text">没连上模型（{aiNote}），这次用的是离线规则。</span>
              </p>
            ) : null}
          </section>

          {draft.proposals.filter((row) => row.action !== 'keep_today').length ? (
            <section className="panel panel--soft">
              <SectionTitle>建议安排</SectionTitle>
              <ul className="proposal-list">
                {draft.proposals
                  .filter((row) => row.action !== 'keep_today')
                  .map((row) => {
                    const node = state.tasks.find((task) => task.id === row.node_id)
                    const checked = selected.includes(row.node_id)
                    return (
                      <li key={row.node_id} className="proposal">
                        <label className="proposal__check">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setSelected((prev) => (prev.includes(row.node_id) ? prev.filter((id) => id !== row.node_id) : [...prev, row.node_id]))
                            }
                          />
                          <span className="proposal__title">{node ? node.title : row.node_id}</span>
                        </label>
                        <p className="proposal__diff">
                          <span>{row.before}</span>
                          <span className="proposal__arrow">→</span>
                          <span className="proposal__after">{row.after}</span>
                        </p>
                        <p className="proposal__reason">{row.reason}</p>
                        {row.typical_min ? (
                          <p className="proposal__meta">你通常要 {fmtMinutes(row.typical_min)}</p>
                        ) : null}
                        {cautionOf(row) ? (
                          <p className="proposal__caution">
                            {cautionOf(row)}
                            <button type="button" className="link-btn" onClick={() => moveProposalToTomorrow(row)}>
                              挪到明天
                            </button>
                          </p>
                        ) : null}
                      </li>
                    )
                  })}
              </ul>
            </section>
          ) : null}

          {draft.proposals.filter((row) => row.action === 'keep_today').length ? (
            <section className="panel panel--soft">
              <SectionTitle>保持不动</SectionTitle>
              <ul className="mini-list">
                {draft.proposals
                  .filter((row) => row.action === 'keep_today')
                  .map((row) => {
                    const node = state.tasks.find((task) => task.id === row.node_id)
                    return (
                      <li key={row.node_id}>
                        <span className="mini-list__title">{node ? node.title : row.node_id}</span>
                        <span className="mini-list__est">已锁定</span>
                      </li>
                    )
                  })}
              </ul>
            </section>
          ) : null}

          {draft.conflicts.length ? (
            <section className="panel panel--soft">
              <SectionTitle>需要你决定</SectionTitle>
              <ul className="proposal-list">
                {draft.conflicts.map((row) => {
                  const node = state.tasks.find((task) => task.id === row.node_id)
                  return (
                    <li key={row.node_id} className="proposal proposal--warn">
                      <p className="proposal__title">{node ? node.title : row.node_id}</p>
                      <p className="proposal__diff">
                        <span>{row.before}</span>
                        <span className="proposal__arrow">→</span>
                        <span>{row.after}</span>
                      </p>
                      <p className="proposal__reason">{row.reason}</p>
                      <button type="button" className="link-btn" onClick={() => navigate('schedule', { projectId: node?.projectId })}>
                        自己去排期页处理
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}

          {draft.suggest_cancel.length ? (
            <section className="panel panel--soft">
              <SectionTitle>建议放下（需你确认）</SectionTitle>
              <ul className="proposal-list">
                {draft.suggest_cancel
                  .filter((row) => {
                    const node = state.tasks.find((task) => task.id === row.node_id)
                    return node && node.status !== 'cancelled' && node.status !== 'boxed'
                  })
                  .map((row) => {
                  const node = state.tasks.find((task) => task.id === row.node_id)
                  return (
                    <li key={row.node_id} className="proposal">
                      <p className="proposal__title">{node ? node.title : row.node_id}</p>
                      <p className="proposal__reason">{row.reason}</p>
                      {cancelConfirm === row.node_id ? (
                        <div className="btn-row">
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setCancelConfirm(null)}>
                            再想想
                          </button>
                          <button type="button" className="btn btn--danger btn--sm" onClick={() => confirmCancel(row.node_id)}>
                            确认取消这个节点
                          </button>
                        </div>
                      ) : (
                        <div className="btn-row">
                          <button type="button" className="link-btn" onClick={() => toggleCancel(row.node_id)}>
                            取消它…
                          </button>
                          <button type="button" className="link-btn" onClick={() => boxIt(row.node_id)}>
                            放进事件箱
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}

          {dropped.length ? (
            <details className="panel panel--soft">
              <summary className="panel__eyebrow">校验结果（{dropped.length}）</summary>
              <ul className="dropped-list">
                {dropped.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className="btn-row">
            <button type="button" className="btn btn--ghost" onClick={() => setStep('ask')}>
              改回答
            </button>
            <button type="button" className="btn btn--primary" onClick={adopt}>
              应用勾选的调整
            </button>
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--block"
            onClick={() => {
              dispatch({ type: 'dismiss_restart' })
              notify('这次先不调整，什么都没变', 'warn')
              navigate('home')
            }}
          >
            先不调整
          </button>
        </div>
      ) : null}

      {step === 'done' ? (
        <div className="stack">
          <div className="restart-hero">
            <Cat mood="happy" skin={state.settings.catSkin || 'orange'} className="cat--restart" />
            <h2 className="restart-hero__title">安排好了</h2>
            <p className="restart-hero__text">
              只应用了你勾选的调整。截止日、已锁定节点、没出现在草案里的节点都保持原样。
            </p>
          </div>
          <div className="notice">
            <p>
              被拒绝或没勾的提案不会自动执行；如果你想回退这次调整，排期页右上角还有「撤销」。
            </p>
            <Badge tone="muted">不静默迁移</Badge>
          </div>
          <button type="button" className="btn btn--primary btn--block" onClick={() => navigate('home')}>
            回今天
          </button>
        </div>
      ) : null}
    </main>
  )
}
