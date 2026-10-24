import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export function Badge({ tone = 'soft', children }) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}

export function DemoTag({ children = '演示数据' }) {
  return (
    <span className="demo-tag" title="当前原型不接真实模型，内容由本地规则与样例生成">
      <span aria-hidden="true">◆</span>
      {children}
    </span>
  )
}

/** 进度只用节点数，不用百分比 */
export function Pips({ done = 0, total = 0, animate = false }) {
  return (
    <span className={`pips ${animate ? 'pips--animate' : ''}`} aria-label={`已完成 ${done} 个，共 ${total} 个节点`}>
      {Array.from({ length: total }).map((_, index) => (
        <span key={index} className={`pips__dot ${index < done ? 'is-on' : ''}`} />
      ))}
      <span className="pips__text">
        {done} / {total} 个节点
      </span>
    </span>
  )
}

export function Sheet({ open, title, subtitle, onClose, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="sheet-layer" role="dialog" aria-modal="true" aria-label={title || '弹层'}>
      <button type="button" className="sheet-layer__backdrop" aria-label="关闭" onClick={onClose} />
      <div className={`sheet ${wide ? 'sheet--wide' : ''}`}>
        <div className="sheet__grip" aria-hidden="true" />
        {title ? (
          <header className="sheet__head">
            <div>
              <h2 className="sheet__title">{title}</h2>
              {subtitle ? <p className="sheet__subtitle">{subtitle}</p> : null}
            </div>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
              ✕
            </button>
          </header>
        ) : null}
        <div className="sheet__body">{children}</div>
        {footer ? <footer className="sheet__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  )
}

export function FullScreen({ open, title, subtitle, onClose, children, footer, tone = 'plain' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className={`fullscreen fullscreen--${tone}`} role="dialog" aria-modal="true" aria-label={title}>
      <header className="fullscreen__head">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="返回">
          ←
        </button>
        <div className="fullscreen__titles">
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <span className="fullscreen__spacer" aria-hidden="true" />
      </header>
      <div className="fullscreen__body">{children}</div>
      {footer ? <footer className="fullscreen__footer">{footer}</footer> : null}
    </div>,
    document.body,
  )
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`segmented__item ${value === option.value ? 'is-active' : ''}`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Chips({ options, value, onChange, allowEmpty = true }) {
  return (
    <div className="chips">
      {options.map((option) => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            className={`chip ${active ? 'is-active' : ''}`}
            aria-pressed={active}
            onClick={() => onChange(active && allowEmpty ? null : option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function Empty({ title, hint, action }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {hint ? <p className="empty__hint">{hint}</p> : null}
      {action}
    </div>
  )
}

export function Field({ label, hint, htmlFor, children }) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="field__hint">{hint}</p> : null}
    </div>
  )
}

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="toggle__track" aria-hidden="true">
        <span className="toggle__thumb" />
      </span>
      <span className="toggle__text">
        <span>{label}</span>
        {hint ? <small>{hint}</small> : null}
      </span>
    </label>
  )
}

export function SectionTitle({ children, action }) {
  return (
    <div className="section-title">
      <h3>{children}</h3>
      {action}
    </div>
  )
}
