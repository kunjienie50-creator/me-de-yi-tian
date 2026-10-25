import { useEffect, useState } from 'react'
import { Badge, DemoTag, Field, SectionTitle } from '../components/ui.jsx'
import Cat from '../components/Cat.jsx'
import { aiStatus } from '../lib/ai.js'
import { fmtBytes, storageBytes } from '../lib/storage.js'
import { countImages, clearImages } from '../lib/images.js'
import { useStore } from '../store.jsx'

export default function Settings({ navigate }) {
  const { state, dispatch, notify, resetAll } = useStore()
  const [size, setSize] = useState(null)
  const [photos, setPhotos] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [ai, setAi] = useState(null)

  useEffect(() => {
    setSize(storageBytes(state))
    countImages().then(setPhotos)
  }, [state])

  useEffect(() => {
    let alive = true
    aiStatus().then((status) => {
      if (alive) setAi(status)
    })
    return () => {
      alive = false
    }
  }, [])

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
        <SectionTitle>模型</SectionTitle>
        <ul className="kv-list">
          <li>
            <span>状态</span>
            <span>
              {ai === null ? '检测中…' : ai.available ? `已连接 · ${ai.model}` : '未连接（用离线规则）'}
              {ai?.mock ? ' · mock' : ''}
              {ai?.mode === 'direct' ? ' · 直连' : ''}
            </span>
          </li>
        </ul>
        <p className="hint hint--left">
          {ai?.mode === 'direct'
            ? '这版把模型请求直接发到 DeepSeek，密钥随页面下发。只用于演示，请勿放真实额度不限的密钥。'
            : '密钥只在本机 .env 里，由 server/ai.js 使用，不会发到浏览器。线上静态版没有这个代理，会自动回退到离线规则。'}
        </p>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={async () => {
              const status = await aiStatus({ force: true })
              setAi(status)
              notify(status.available ? '模型连上了' : '还是没连上，看看 .env 和 dev server', status.available ? 'ok' : 'warn')
            }}
          >
            重新检测
          </button>
        </div>
      </section>

      <section className="panel">
        <SectionTitle>小猫陪伴</SectionTitle>
        <p className="hint hint--left">点击界面，小猫会动一动；每点亮一件任务，它会翻滚一次庆祝。</p>
        <Cat mood="idle" className="cat--settings" />
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
            <Badge tone="soft">演示模式</Badge> 拆解与重启支持连接本地模型代理；未连接时由离线规则生成建议。
          </li>
          <li>
            <Badge tone="soft">你确认才生效</Badge> 草案先展示、再校验、勾选后才写入；截止日与锁定节点不会被改动。
          </li>
          <li>
            <Badge tone="soft">不评价</Badge> 没回答＝未知，不推断为失败；没做完的事不进分享。
          </li>
          <li>
            <Badge tone="soft">纯本地</Badge> 任务与记录保存在当前浏览器；使用模型时，生成请求经本地代理发送。
          </li>
        </ul>
      </section>

      <section className="panel panel--soft">
        <SectionTitle>暂未包含</SectionTitle>
        <p className="hint hint--left">
          登录与多端同步 · 系统级浮窗 · 长期子任务的永久删除入口 · 图片导出文件。
          这些都在后续阶段处理，不在这次原型里假装做了。
        </p>
      </section>

      <p className="footnote">
        <DemoTag children="原型 v0.2" /> 技术栈：Vite + React + 普通 CSS。数据保存在 localStorage 与 IndexedDB。
      </p>
    </main>
  )
}
