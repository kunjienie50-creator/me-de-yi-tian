import { useEffect, useMemo, useRef, useState } from 'react'
import TagPicker from '../components/TagPicker.jsx'
import { Badge, DemoTag, Empty, Field, FullScreen, Pips, Sheet } from '../components/ui.jsx'
import { colorVars, projectColorOf } from '../lib/colors.js'
import { aiDecompose } from '../lib/ai.js'
import { GRANULARITY_LABEL, PRIORITY_META, decompose, fakeLatency, validateDraft } from '../lib/decompose.js'
import { addDays, dayRange, diffDays, fmtMD, fmtMinutes, fmtRelative, fmtWeekday, fromKey } from '../lib/dates.js'
import { detectConflicts, orderConflicts, planEven, sortBySeq } from '../lib/schedule.js'
import { guessTagId, tagMeta } from '../lib/tags.js'
import { projectNodes, projectProgress, uid, useStore } from '../store.jsx'

const WEEK_HEAD = ['日', '一', '二', '三', '四', '五', '六']

export default function Goals({ navigate }) {
  const { state, dispatch, notify, today } = useStore()
  const [quickOpen, setQuickOpen] = useState(false)
  const [wizardSeed, setWizardSeed] = useState(null)

  const projects = state.projects.filter((project) => project.status !== 'archived')

  return (
    <main className="screen">
      <header className="topbar">
        <div>
          <p className="topbar__date">把想做成的事拆开</p>
          <h1 className="topbar__title">长期目标</h1>
        </div>
        <button type="button" className="icon-btn" onClick={() => setQuickOpen(true)} aria-label="新建目标">
          ＋
        </button>
      </header>

      <p className="hint hint--left">
        <DemoTag children="演示拆解" /> 拆解草案由本地规则生成，你确认之后才会变成真正的节点。
      </p>

      {projects.length ? (
        <ul className="project-list">
          {projects.map((project) => {
            const progress = projectProgress(state, project.id)
            const nodes = projectNodes(state, project.id)
            const conflicts = detectConflicts(nodes, project.ddl, today)
            const orderIssues = orderConflicts(sortBySeq(nodes))
            return (
              <li key={project.id} className="project-card" style={colorVars(projectColorOf(state, project.id))}>
                <button type="button" className="project-card__main" onClick={() => navigate('schedule', { projectId: project.id })}>
                  <div className="project-card__head">
                    <h2>
                      <span className="project-card__dot" aria-hidden="true" />
                      {project.title}
                    </h2>
                    <Badge tone="soft">{tagMeta(state, project.tag, project.category)?.label || '未分类'}</Badge>
                  </div>
                  <Pips done={progress.done} total={progress.total} />
                  <p className="project-card__meta">
                    截止 {fmtRelative(project.ddl, today)}
                    {diffDays(today, project.ddl) >= 0 ? ` · 还剩 ${diffDays(today, project.ddl)} 天` : ' · 已过期'}
                  </p>
                  {orderIssues.length ? (
                    <p className="project-card__conflict is-warn">⚠ {orderIssues[0].text}</p>
                  ) : conflicts.length ? (
                    <p className={`project-card__conflict is-${conflicts[0].level}`}>⚠ {conflicts[0].text}</p>
                  ) : null}
                </button>
                <div className="project-card__foot">
                  <button type="button" className="link-btn" onClick={() => navigate('schedule', { projectId: project.id })}>
                    查看排期与拖动
                  </button>
                  <span className="project-card__count">{progress.total} 个节点</span>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <Empty title="还没有长期目标" hint="比如「准备比赛路演」「写完课程论文」。" />
      )}

      <button type="button" className="btn btn--primary btn--block" onClick={() => setQuickOpen(true)}>
        新建长期目标
      </button>

      <QuickAddSheet
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        onSubmit={(text) => {
          setQuickOpen(false)
          setWizardSeed({ raw: text, at: Date.now() })
        }}
      />

      <GoalWizard
        seed={wizardSeed}
        onClose={() => setWizardSeed(null)}
        onCreate={(project, tasks) => {
          dispatch({ type: 'add_project', project, tasks })
          setWizardSeed(null)
          notify('目标建好了，按你排的日期进了日程', 'ok')
          navigate('schedule', { projectId: project.id })
        }}
      />
    </main>
  )
}

/** 第一步：只要一句话。点开就是一个输入框，不打扰。 */
function QuickAddSheet({ open, onClose, onSubmit }) {
  const [text, setText] = useState('')

  useEffect(() => {
    if (!open) setText('')
  }, [open])

  return (
    <Sheet
      open={open}
      title="想做成什么？"
      subtitle="一句话就行，不用写日期，拆解和排期都在下一步。"
      onClose={onClose}
      footer={
        <button type="button" className="btn btn--primary btn--block" disabled={!text.trim()} onClick={() => onSubmit(text.trim())}>
          开始拆解
        </button>
      }
    >
      <Field label="一句话说清" htmlFor="quick-goal">
        <input
          id="quick-goal"
          className="input"
          value={text}
          maxLength={60}
          placeholder="比如：准备下周的比赛路演"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && text.trim()) onSubmit(text.trim())
          }}
        />
      </Field>
      <div className="chips">
        {['准备下周的比赛路演', '学完概率论第二章', '整理一版作品集'].map((sample) => (
          <button key={sample} type="button" className="chip" onClick={() => setText(sample)}>
            {sample}
          </button>
        ))}
      </div>
    </Sheet>
  )
}

const STEPS = ['draft', 'plan']

function GoalWizard({ seed, onClose, onCreate }) {
  const { state, dispatch, notify, today } = useStore()
  const [loading, setLoading] = useState(false)
  const [granularity, setGranularity] = useState('default')
  const [issues, setIssues] = useState([])
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [nodes, setNodes] = useState([])
  const [tag, setTag] = useState('work')
  const [ddl, setDdl] = useState(addDays(today, 6))
  const [step, setStep] = useState('draft')
  const [plan, setPlan] = useState(new Map())
  const [dragging, setDragging] = useState(null)
  const [selected, setSelected] = useState(null)
  const [plans, setPlans] = useState(0) // 改动次数，用来给「重排」后的说明
  const [source, setSource] = useState('rule') // 'model' | 'rule'
  const [aiNote, setAiNote] = useState('') // 模型失败时的原因，展示在清单上方

  const open = Boolean(seed)
  const raw = seed ? seed.raw : ''

  // 先问本地模型（/api/ai/decompose）；没 key、没代理或超时就退回离线规则，界面会标出来
  async function requestDraft(granularity) {
    const ai = await aiDecompose(raw, granularity)
    if (ai.ok) {
      return { source: 'model', error: '', checked: validateDraft({ kind: 'long_term', ...ai.draft }) }
    }
    await fakeLatency(560)
    return { source: 'rule', error: ai.error || '', checked: validateDraft(decompose(raw, granularity)) }
  }

  function applyDraft(result) {
    const checked = result.checked
    setSource(result.source)
    setAiNote(result.error)
    if (checked.draft && checked.draft.kind === 'chat') {
      setIssues([checked.draft.short_reply || '再多说一点'])
      return
    }
    setTitle(checked.draft.title || raw)
    setCategory(checked.draft.category || '日常')
    setTag(guessTagId(`${raw} ${checked.draft.title || ''}`))
    setNodes(
      (checked.draft.nodes || []).map((node) => ({
        key: `n${node.seq}_${Math.random().toString(36).slice(2, 5)}`,
        seq: node.seq,
        priority: node.priority || 'mid',
        label: node.label,
        category: node.category,
        est_min: node.est_min,
      })),
    )
    setIssues(checked.issues || [])
  }

  // 打开时先「拆解」，直接落到确认清单
  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    setIssues([])
    setStep('draft')
    setGranularity('default')
    setDdl(addDays(today, 6))
    setPlan(new Map())
    requestDraft('default').then((result) => {
      if (!alive) return
      applyDraft(result)
      setLoading(false)
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed && seed.at])

  async function regenerate(nextGranularity) {
    if (!raw.trim()) return
    setLoading(true)
    setIssues([])
    const result = await requestDraft(nextGranularity)
    applyDraft(result)
    setGranularity(nextGranularity)
    setLoading(false)
  }

  // 确认清单 → 排期：先钉截止日，再把节点均匀铺开（用户随后可以拖）
  function toPlan() {
    const ordered = nodes.map((node, index) => ({ ...node, seq: index + 1 }))
    setNodes(ordered)
    setPlan(planEven(ordered.map((node) => ({ id: node.key, est_min: node.est_min })), today, ddl))
    setPlans(0)
    setStep('plan')
  }

  // 截止日改了：以它为准重铺一次，避免节点落在截止日之后
  useEffect(() => {
    if (step !== 'plan' || !nodes.length) return
    setPlan(planEven(nodes.map((node) => ({ id: node.key, est_min: node.est_min })), today, ddl))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ddl])

  const ordered = useMemo(() => sortBySeq(nodes), [nodes])

  const days = useMemo(() => {
    if (!ddl) return []
    // 窗口最多 5 周，避免截止日很远时日历长得离谱
    const start = diffDays(today, ddl) > 34 ? addDays(ddl, -34) : today
    const list = dayRange(start, diffDays(start, ddl) >= 0 ? ddl : start)
    return list
  }, [ddl, today])

  const cells = useMemo(() => {
    if (!days.length) return []
    const lead = fromKey(days[0]).getDay()
    return [...Array(lead).fill(null), ...days]
  }, [days])

  const dayLoad = useMemo(() => {
    const map = new Map()
    ordered.forEach((node) => {
      const date = plan.get(node.key)
      if (!date) return
      const row = map.get(date) || { count: 0, min: 0 }
      row.count += 1
      row.min += Number(node.est_min) || 0
      map.set(date, row)
    })
    return map
  }, [ordered, plan])

  // 排期里日期还没写进 node 对象（在 plan 里），所以前驱约束要按 plan 取日期
  function moveNode(key, date) {
    const index = ordered.findIndex((node) => node.key === key)
    if (index < 0) return
    const prev = ordered[index - 1]
    const next = ordered[index + 1]
    const prevDate = prev ? plan.get(prev.key) : null
    const nextDate = next ? plan.get(next.key) : null

    let target = date
    if (diffDays(today, target) < 0) target = today
    if (diffDays(target, ddl) < 0) target = ddl

    if (prevDate && diffDays(prevDate, target) < 0) {
      notify(`它前面还有「${prev.label}」（${fmtMD(prevDate)}），前驱必须排在前面`, 'warn')
      return
    }
    if (nextDate && diffDays(target, nextDate) < 0) {
      notify(`它后面还有「${next.label}」（${fmtMD(nextDate)}），不能排到它之后`, 'warn')
      return
    }
    if (target === plan.get(key)) return
    setPlan((prevPlan) => new Map(prevPlan).set(key, target))
    setPlans((n) => n + 1)
  }

  function createProject() {
    const projectId = uid('p')
    const project = {
      id: projectId,
      title: title.trim() || raw.trim(),
      category: category || '',
      tag,
      ddl,
      createdAt: new Date().toISOString(),
      status: 'active',
    }
    const tasks = ordered.map((node, index) => ({
      id: uid('n'),
      kind: 'node',
      projectId,
      seq: index + 1,
      priority: node.priority || 'mid',
      title: node.label,
      category: node.category,
      tag,
      date: plan.get(node.key) || ddl,
      est_min: node.est_min,
      done: false,
      status: 'todo',
      locked: false,
      note: '',
      noteForAI: false,
    }))
    onCreate(project, tasks)
  }

  return (
    <FullScreen
      open={open}
      title={step === 'draft' ? '确认清单' : '排进日历'}
      subtitle={step === 'draft' ? `第 1 步 / 共 2 步 · ${fmtRelative(today, today)}` : '第 2 步 / 共 2 步 · 拖动方块改日期'}
      onClose={onClose}
    >
      {step === 'draft' ? (
        <div className="stack">
          {loading ? (
            <div className="loading-card">
              <span className="pulse-dot" aria-hidden="true" />
              <p>正在把它拆成能打卡的小步…</p>
            </div>
          ) : null}

          {!loading ? (
            <>
              <Field label="目标名称" htmlFor="wiz-title">
                <input id="wiz-title" className="input" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={40} />
              </Field>

              <TagPicker
                value={tag}
                onChange={setTag}
                extraTags={state.customTags}
                onAddTag={(label) => {
                  const id = uid('tg')
                  dispatch({ type: 'add_tag', tag: { id, label, emoji: '🏷' } })
                  notify(`新分类「${label}」建好了`, 'ok')
                  return id
                }}
                label="这件事属于哪一类（AI 先猜了一个，节点会一起带上这个分类）"
              />

              <p className="ai-hint">
                <span className={`ai-badge ${source === 'model' ? 'is-model' : ''}`}>
                  {source === 'model' ? '本地模型生成' : '离线规则生成'}
                </span>
                <span className="ai-hint__text">
                  {source === 'model' ? '清单来自 DeepSeek，序号和优先级仍会被本地规则再校验一遍。' : `没连上模型${aiNote ? `（${aiNote}）` : ''}，这次用的是本地规则。`}
                </span>
              </p>

              <div className="draft-head">
                <span className="draft-head__label">子任务清单</span>
                <span className="draft-head__count">{nodes.length} 个节点 · 序号即先后顺序</span>
              </div>

              <ul className="node-editor node-editor--seq">
                {nodes.map((node, index) => (
                  <li key={node.key}>
                    <span className="node-editor__index">{index + 1}</span>
                    <div className="node-editor__main">
                      <input
                        className="input"
                        value={node.label}
                        maxLength={20}
                        aria-label={`第 ${index + 1} 个节点`}
                        onChange={(event) =>
                          setNodes((list) => list.map((item) => (item.key === node.key ? { ...item, label: event.target.value } : item)))
                        }
                      />
                      <div className="node-editor__row">
                        <div className="chips chips--tiny">
                          {['high', 'mid', 'low'].map((level) => (
                            <button
                              key={level}
                              type="button"
                              className={`chip chip--tiny ${node.priority === level ? 'is-active' : ''}`}
                              onClick={() =>
                                setNodes((list) => list.map((item) => (item.key === node.key ? { ...item, priority: level } : item)))
                              }
                            >
                              {PRIORITY_META[level].short}
                            </button>
                          ))}
                        </div>
                        <input
                          className="input input--num"
                          type="number"
                          inputMode="numeric"
                          min="10"
                          max="240"
                          step="5"
                          value={node.est_min}
                          aria-label={`第 ${index + 1} 个节点的预计分钟`}
                          onChange={(event) =>
                            setNodes((list) =>
                              list.map((item) =>
                                item.key === node.key ? { ...item, est_min: Math.max(10, Math.min(240, Number(event.target.value) || 10)) } : item,
                              ),
                            )
                          }
                        />
                        <button
                          type="button"
                          className="mini-btn"
                          aria-label="删除这个节点"
                          onClick={() => setNodes((list) => list.filter((item) => item.key !== node.key))}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className="btn btn--ghost btn--block"
                onClick={() =>
                  setNodes((list) => [
                    ...list,
                    { key: `n${list.length}_${Math.random().toString(36).slice(2, 5)}`, priority: 'mid', label: '新节点', category, est_min: 30 },
                  ])
                }
              >
                + 加一个节点
              </button>

              <div className="granularity">
                <span className="granularity__label">拆得不合适？</span>
                <div className="granularity__row">
                  {Object.entries(GRANULARITY_LABEL).map(([key, label]) => (
                    <button key={key} type="button" className={`chip ${granularity === key ? 'is-active' : ''}`} disabled={loading} onClick={() => regenerate(key)}>
                      {label}
                    </button>
                  ))}
                </div>
                <p className="hint hint--tight">重拆会覆盖当前清单；也可以直接在上面自己改。</p>
              </div>

              {issues.length ? (
                <div className="notice notice--warn">
                  {issues.map((issue) => (
                    <p key={issue}>{issue}</p>
                  ))}
                </div>
              ) : null}

              <button type="button" className="btn btn--primary btn--block" disabled={nodes.length < 1} onClick={toPlan}>
                就这样，去排期
              </button>
              <p className="hint">序号 1 是第一个要做的，后面的不能排到它前面。确认之后才会生成真正的子任务。</p>
            </>
          ) : null}
        </div>
      ) : null}

      {step === 'plan' ? (
        <div className="stack">
          <div className="ddl-row">
            <Field label="截止日" htmlFor="wiz-ddl" hint="先把它钉住。AI 不会改，节点也不能排到它之后。">
              <input
                id="wiz-ddl"
                className="input"
                type="date"
                value={ddl}
                min={today}
                onChange={(event) => {
                  const next = event.target.value
                  if (!next) return
                  if (diffDays(next, today) < 0) {
                    notify('截止日不能早于今天', 'warn')
                    return
                  }
                  setDdl(next)
                }}
              />
            </Field>
            <div className="ddl-chip">
              <span className="ddl-chip__pin" aria-hidden="true">
                📌
              </span>
              <span>{fmtMD(ddl)}</span>
              <span className="ddl-chip__hint">{fmtWeekday(ddl)} 钉住</span>
            </div>
          </div>

          <p className="hint hint--left">
            共 {ordered.length} 个节点、预计 {fmtMinutes(ordered.reduce((sum, node) => sum + node.est_min, 0))}。最长的一段是
            {' '}
            {fmtMinutes(Math.max(...ordered.map((node) => Number(node.est_min) || 0), 0))}。把方块拖到某一天，或先点方块再点日期；序号靠前的不能排到后面去。
          </p>

          <div
            className="cal"
            onPointerUp={(event) => {
              if (!dragging) return
              // 优先看松手落在哪个日期格上；拿不到坐标时再退回坐标探测
              const cell =
                (event.target instanceof Element ? event.target.closest('[data-date]') : null) ||
                document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-date]')
              if (cell) moveNode(dragging, cell.dataset.date)
              setDragging(null)
            }}
            onPointerLeave={() => setDragging(null)}
          >
            <div className="cal__weekhead" aria-hidden="true">
              {WEEK_HEAD.map((label) => (
                <span key={label} className="cal__weekhead-cell">
                  {label}
                </span>
              ))}
            </div>
            <div className="cal__grid">
              {cells.map((day, index) =>
                day ? (
                  <div
                    key={day}
                    data-date={day}
                    role="button"
                    tabIndex={0}
                    className={`cal__cell ${day === today ? 'is-today' : ''} ${day === ddl ? 'is-ddl' : ''}`}
                    onClick={() => {
                      if (selected) {
                        moveNode(selected, day)
                        setSelected(null)
                      }
                    }}
                    onKeyDown={(event) => {
                      if ((event.key === 'Enter' || event.key === ' ') && selected) {
                        moveNode(selected, day)
                        setSelected(null)
                      }
                    }}
                    aria-label={`${fmtMD(day)} ${fmtWeekday(day)}`}
                  >
                    <span className="cal__date">{fromKey(day).getDate()}</span>
                    {day === ddl ? <span className="cal__pin" aria-hidden="true">📌</span> : null}
                    {dayLoad.get(day) ? (
                      <span className="cal__load">
                        {dayLoad.get(day).count} 件 · {fmtMinutes(dayLoad.get(day).min)}
                      </span>
                    ) : null}
                    <span className="cal__blocks">
                      {ordered
                        .filter((node) => plan.get(node.key) === day)
                        .map((node) => (
                          <button
                            key={node.key}
                            type="button"
                            className={`cal-block cal-block--${node.priority} ${selected === node.key ? 'is-selected' : ''} ${dragging === node.key ? 'is-dragging' : ''}`}
                            onPointerDown={(event) => {
                              event.preventDefault()
                              setDragging(node.key)
                            }}
                            onClick={(event) => {
                              event.stopPropagation()
                              setSelected((prev) => (prev === node.key ? null : node.key))
                            }}
                            title={`${node.seq}. ${node.label} · ${fmtMinutes(node.est_min)}`}
                          >
                            <span className="cal-block__seq">{node.seq}</span>
                          </button>
                        ))}
                    </span>
                  </div>
                ) : (
                  <div key={`pad-${index}`} className="cal__cell cal__cell--pad" aria-hidden="true" />
                ),
              )}
            </div>
          </div>

          {selected ? (
            <p className="cal-pick">
              已选中 {ordered.find((node) => node.key === selected)?.seq}.{ordered.find((node) => node.key === selected)?.label} ·{' '}
              {fmtMD(plan.get(selected) || ddl)}，再点一天就能挪过去。
            </p>
          ) : (
            <p className="hint hint--left">拖一下方块，或点它选中再点日期；想回到均匀排布点「重排」。</p>
          )}

          <ul className="cal-legend">
            {ordered.map((node) => (
              <li key={node.key}>
                <span className={`cal-legend__seq cal-legend__seq--${node.priority}`}>{node.seq}</span>
                <span className="cal-legend__label">{node.label}</span>
                <span className="cal-legend__date">{fmtRelative(plan.get(node.key) || ddl, today)}</span>
                <span className="cal-legend__est">{fmtMinutes(node.est_min)}</span>
              </li>
            ))}
          </ul>
          {plans ? <p className="hint hint--left">已手动调整 {plans} 处。</p> : null}

          <div className="btn-row">
            <button type="button" className="btn btn--ghost" onClick={() => setStep('draft')}>
              改清单
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setPlan(planEven(ordered.map((node) => ({ id: node.key, est_min: node.est_min })), today, ddl))
                setPlans(0)
                notify('按规则重新均匀排了一次', 'ok')
              }}
            >
              重排
            </button>
          </div>
          <button type="button" className="btn btn--primary btn--block" onClick={createProject}>
            就按这个日期，创建目标
          </button>
          <p className="hint">创建后还能在排期页继续拖；拖动只改日期，不删任务。</p>
        </div>
      ) : null}
    </FullScreen>
  )
}
