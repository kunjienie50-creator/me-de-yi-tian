import { useMemo, useState } from 'react'
import { Badge, DemoTag, Empty, Field, FullScreen, Pips } from '../components/ui.jsx'
import { GRANULARITY_LABEL, decompose, fakeLatency, validateDraft } from '../lib/decompose.js'
import { addDays, diffDays, fmtMinutes, fmtRelative, todayKey } from '../lib/dates.js'
import { detectConflicts, planEven } from '../lib/schedule.js'
import { projectNodes, projectProgress, uid, useStore } from '../store.jsx'

export default function Goals({ navigate }) {
  const { state, dispatch, notify } = useStore()
  const [wizardOpen, setWizardOpen] = useState(false)

  const projects = state.projects.filter((project) => project.status !== 'archived')

  return (
    <main className="screen">
      <header className="topbar">
        <div>
          <p className="topbar__date">把想做成的事拆开</p>
          <h1 className="topbar__title">长期目标</h1>
        </div>
        <button type="button" className="icon-btn" onClick={() => setWizardOpen(true)} aria-label="新建目标">
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
            const conflicts = detectConflicts(nodes, project.ddl, todayKey())
            return (
              <li key={project.id} className="project-card">
                <button type="button" className="project-card__main" onClick={() => navigate('schedule', { projectId: project.id })}>
                  <div className="project-card__head">
                    <h2>{project.title}</h2>
                    <Badge tone="soft">{project.category}</Badge>
                  </div>
                  <Pips done={progress.done} total={progress.total} />
                  <p className="project-card__meta">
                    截止 {fmtRelative(project.ddl)}
                    {diffDays(todayKey(), project.ddl) >= 0 ? ` · 还剩 ${diffDays(todayKey(), project.ddl)} 天` : ' · 已过期'}
                  </p>
                  {conflicts.length ? (
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

      <button type="button" className="btn btn--primary btn--block" onClick={() => setWizardOpen(true)}>
        新建长期目标
      </button>

      <GoalWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreate={(project, tasks) => {
          dispatch({ type: 'add_project', project, tasks })
          setWizardOpen(false)
          notify('目标建好了，节点已排进日程', 'ok')
          navigate('schedule', { projectId: project.id })
        }}
      />
    </main>
  )
}

const STEPS = ['input', 'draft', 'ddl', 'plan']

function GoalWizard({ open, onClose, onCreate }) {
  const today = todayKey()
  const [step, setStep] = useState('input')
  const [raw, setRaw] = useState('')
  const [loading, setLoading] = useState(false)
  const [granularity, setGranularity] = useState('default')
  const [issues, setIssues] = useState([])
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [nodes, setNodes] = useState([])
  const [ddl, setDdl] = useState(addDays(today, 6))

  function resetAll() {
    setStep('input')
    setRaw('')
    setNodes([])
    setIssues([])
    setTitle('')
    setCategory('')
    setDdl(addDays(today, 6))
    setGranularity('default')
  }

  async function generate(nextGranularity = 'default') {
    if (!raw.trim()) return
    setLoading(true)
    setIssues([])
    await fakeLatency(680)
    const draft = decompose(raw, nextGranularity)
    const checked = validateDraft(draft)
    if (checked.draft && checked.draft.kind === 'chat') {
      setIssues([checked.draft.short_reply || '再多说一点'])
      setLoading(false)
      return
    }
    setTitle(checked.draft.title || raw.trim())
    setCategory(checked.draft.category || '日常')
    setNodes(
      (checked.draft.nodes || []).map((node, index) => ({
        key: `n${index}_${Math.random().toString(36).slice(2, 5)}`,
        label: node.label,
        category: node.category,
        est_min: node.est_min,
      })),
    )
    setIssues(checked.issues || [])
    setGranularity(nextGranularity)
    setLoading(false)
    setStep('draft')
  }

  const plan = useMemo(() => {
    if (!nodes.length) return new Map()
    return planEven(
      nodes.map((node) => ({ id: node.key, est_min: node.est_min })),
      today,
      ddl,
    )
  }, [nodes, ddl, today])

  const grouped = useMemo(() => {
    const map = new Map()
    nodes.forEach((node) => {
      const date = plan.get(node.key) || ddl
      if (!map.has(date)) map.set(date, [])
      map.get(date).push(node)
    })
    return [...map.entries()].sort((a, b) => diffDays(b[0], a[0]))
  }, [nodes, plan, ddl])

  function createProject() {
    const projectId = uid('p')
    const project = {
      id: projectId,
      title: title.trim() || raw.trim(),
      category: category || '日常',
      ddl,
      createdAt: new Date().toISOString(),
      status: 'active',
    }
    const tasks = nodes.map((node) => ({
      id: uid('n'),
      kind: 'node',
      projectId,
      title: node.label,
      category: node.category,
      date: plan.get(node.key) || ddl,
      est_min: node.est_min,
      done: false,
      status: 'todo',
      locked: false,
      note: '',
      noteForAI: false,
    }))
    onCreate(project, tasks)
    resetAll()
  }

  return (
    <FullScreen
      open={open}
      title="新建长期目标"
      subtitle={`第 ${STEPS.indexOf(step) + 1} 步 / 共 4 步`}
      onClose={() => {
        resetAll()
        onClose()
      }}
    >
      <ol className="steps" aria-hidden="true">
        {['描述目标', '确认清单', '设截止日', '确认排期'].map((label, index) => (
          <li key={label} className={index <= STEPS.indexOf(step) ? 'is-on' : ''}>
            {label}
          </li>
        ))}
      </ol>

      {step === 'input' ? (
        <div className="stack">
          <Field label="你想做成什么" hint="一次写一件事。不用写日期，日期稍后再定。">
            <textarea
              className="input input--area"
              rows={3}
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
              placeholder="比如：准备下周的比赛路演"
              maxLength={80}
            />
          </Field>
          <button type="button" className="btn btn--primary btn--block" disabled={!raw.trim() || loading} onClick={() => generate('default')}>
            {loading ? '正在拆解…' : '生成拆解草案'}
          </button>
          <p className="hint">
            <DemoTag children="演示拆解" /> 原型用本地规则和预置样例模拟模型输出，不会真的调用模型。
          </p>
        </div>
      ) : null}

      {step === 'draft' ? (
        <div className="stack">
          <Field label="目标名称" htmlFor="wiz-title">
            <input id="wiz-title" className="input" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={40} />
          </Field>

          <div className="draft-head">
            <span className="draft-head__label">子任务清单（可改）</span>
            <span className="draft-head__count">{nodes.length} 个节点</span>
          </div>

          <ul className="node-editor">
            {nodes.map((node, index) => (
              <li key={node.key}>
                <span className="node-editor__index">{index + 1}</span>
                <input
                  className="input"
                  value={node.label}
                  maxLength={20}
                  aria-label={`第 ${index + 1} 个节点`}
                  onChange={(event) =>
                    setNodes((list) => list.map((item) => (item.key === node.key ? { ...item, label: event.target.value } : item)))
                  }
                />
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
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="btn btn--ghost btn--block"
            onClick={() =>
              setNodes((list) => [
                ...list,
                { key: `n${list.length}_${Math.random().toString(36).slice(2, 5)}`, label: '新节点', category, est_min: 30 },
              ])
            }
          >
            + 加一个节点
          </button>

          <div className="granularity">
            <span className="granularity__label">拆得不合适？</span>
            <div className="granularity__row">
              {Object.entries(GRANULARITY_LABEL).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`chip ${granularity === key ? 'is-active' : ''}`}
                  disabled={loading}
                  onClick={() => generate(key)}
                >
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

          <button type="button" className="btn btn--primary btn--block" disabled={nodes.length < 1} onClick={() => setStep('ddl')}>
            就这样，下一步
          </button>
          <p className="hint">确认之后才会生成真正的子任务，重复查看不会重复创建。</p>
        </div>
      ) : null}

      {step === 'ddl' ? (
        <div className="stack">
          <Field label="截止日期" hint="这是硬约束。AI 不会改动它，之后的调整也都由你确认。">
            <input className="input" type="date" value={ddl} min={today} onChange={(event) => setDdl(event.target.value)} />
          </Field>
          <div className="notice">
            <p>
              共 {nodes.length} 个节点，预计 {fmtMinutes(nodes.reduce((sum, node) => sum + node.est_min, 0))}。下一步会按规则均匀铺到
              {' '}
              {fmtRelative(today)} 到 {fmtRelative(ddl)} 之间，之后可以自己拖动。
            </p>
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn--ghost" onClick={() => setStep('draft')}>
              上一步
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setStep('plan')}>
              均匀排期
            </button>
          </div>
        </div>
      ) : null}

      {step === 'plan' ? (
        <div className="stack">
          <p className="hint hint--left">下面是规则的初始安排：能拖动、能堆叠，现在只是预览。</p>
          <ul className="plan-list">
            {grouped.map(([date, items]) => (
              <li key={date}>
                <div className="plan-list__day">
                  <span>{fmtRelative(date)}</span>
                  <span className="plan-list__sum">{fmtMinutes(items.reduce((sum, item) => sum + item.est_min, 0))}</span>
                </div>
                <ul>
                  {items.map((item) => (
                    <li key={item.key} className="plan-list__node">
                      <span>{item.label}</span>
                      <span>{fmtMinutes(item.est_min)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <div className="btn-row">
            <button type="button" className="btn btn--ghost" onClick={() => setStep('ddl')}>
              改日期
            </button>
            <button type="button" className="btn btn--primary" onClick={createProject}>
              创建目标与节点
            </button>
          </div>
        </div>
      ) : null}
    </FullScreen>
  )
}
