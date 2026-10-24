import { useEffect, useState } from 'react'
import { Badge, DemoTag, Field, SectionTitle } from '../components/ui.jsx'
import Cat, { CAT_SKINS } from '../components/Cat.jsx'
import { fmtBytes, storageBytes } from '../lib/storage.js'
import { countImages, clearImages } from '../lib/images.js'
import { useStore } from '../store.jsx'

export default function Settings({ navigate }) {
  const { state, dispatch, notify, resetAll } = useStore()
  const [size, setSize] = useState(null)
  const [photos, setPhotos] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => {
    setSize(storageBytes(state))
    countImages().then(setPhotos)
  }, [state])

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `me的一天-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    notify('已导出当前数据（不含照片）', 'ok')
  }

  async function reset() {
    await clearImages().catch(() => {})
    resetAll()
    setConfirmReset(false)
    notify('已恢复到初始演示数据', 'ok')
    navigate('home')
  }

  return (
    <main className="screen">
      <header className="topbar">
        <div>
          <button type="button" className="link-btn link-btn--back" onClick={() => navigate('home')}>
            ← 今天
          </button>
          <h1 className="topbar__title">设置与说明</h1>
        </div>
      </header>

      <section className="panel">
        <SectionTitle>小猫形象</SectionTitle>
        <p className="hint hint--left">现在是占位形象，之后换成你自己画的就行（见 Cat.jsx 顶部说明）。</p>
        <div className="skin-row">
          {CAT_SKINS.map((skin) => (
            <button
              key={skin.id}
              type="button"
              className={`skin-card ${(state.settings.catSkin || 'orange') === skin.id ? 'is-active' : ''}`}
              onClick={() => {
                dispatch({ type: 'update_settings', patch: { catSkin: skin.id } })
                notify(`换成「${skin.name}」了`, 'ok')
              }}
              aria-pressed={(state.settings.catSkin || 'orange') === skin.id}
            >
              <Cat mood="idle" skin={skin.id} className="cat--skin" />
              <span className="skin-card__name">{skin.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <SectionTitle>睡前时间</SectionTitle>
        <Field label="我通常几点睡" hint="只用来提醒结算，不参与任何评分或排名。">
          <input
            className="input"
            type="time"
            value={state.settings.sleepTime}
            onChange={(event) => dispatch({ type: 'update_settings', patch: { sleepTime: event.target.value } })}
          />
        </Field>
      </section>

      <section className="panel panel--soft">
        <SectionTitle>本地数据</SectionTitle>
        <ul className="kv-list">
          <li>
            <span>任务与记录</span>
            <span>{size === null ? '计算中…' : fmtBytes(size)}</span>
          </li>
          <li>
            <span>纪念照片</span>
            <span>{photos === null ? '计算中…' : `${photos} 张`}</span>
          </li>
          <li>
            <span>存储位置</span>
            <span>这台设备的浏览器</span>
          </li>
        </ul>
        <div className="btn-row">
          <button type="button" className="btn btn--ghost" onClick={exportJson}>
            导出数据（JSON）
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setConfirmReset(true)}>
            重置演示数据
          </button>
        </div>
        {confirmReset ? (
          <div className="notice notice--danger">
            <p>重置会清空本机上的任务、记录与照片，恢复成初始演示数据。这一步不能撤销。</p>
            <div className="btn-row">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmReset(false)}>
                取消
              </button>
              <button type="button" className="btn btn--danger btn--sm" onClick={reset}>
                确认重置
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <SectionTitle>这个原型做了什么</SectionTitle>
        <ul className="about-list">
          <li>
            <Badge tone="soft">演示模式</Badge> 拆解与重启草案由本地规则和预置样例生成，没有调用任何模型。
          </li>
          <li>
            <Badge tone="soft">你确认才生效</Badge> 草案先展示、再校验、勾选后才写入；截止日与锁定节点不会被改动。
          </li>
          <li>
            <Badge tone="soft">不评价</Badge> 没回答＝未知，不推断为失败；没做完的事不进分享。
          </li>
          <li>
            <Badge tone="soft">纯本地</Badge> 没有登录、后端或数据库，数据只在当前浏览器。
          </li>
        </ul>
      </section>

      <section className="panel panel--soft">
        <SectionTitle>暂未包含</SectionTitle>
        <p className="hint hint--left">
          登录与多端同步 · 真实模型调用 · 系统级浮窗 · 长期子任务的永久删除入口 · 图片导出文件。
          这些都在后续阶段处理，不在这次原型里假装做了。
        </p>
      </section>

      <p className="footnote">
        <DemoTag children="原型 v0.2" /> 技术栈：Vite + React + 普通 CSS。数据保存在 localStorage 与 IndexedDB。
      </p>
    </main>
  )
}
