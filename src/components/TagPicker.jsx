import { useState } from 'react'
import { DEFAULT_TAGS } from '../lib/tags.js'

/**
 * 分类选择器：AI 先猜一个（父组件负责），这里负责让用户改或新建。
 * extraTags 是用户之前自建的分类；onAddTag(label) 返回新分类 id。
 */
export default function TagPicker({ value, onChange, extraTags = [], onAddTag, label = '分类' }) {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const tags = [...DEFAULT_TAGS, ...extraTags]

  function submit(event) {
    event.preventDefault()
    const clean = text.trim()
    if (!clean) return
    const id = onAddTag?.(clean)
    if (id) onChange?.(id)
    setText('')
    setAdding(false)
  }

  return (
    <div className="tag-picker">
      <span className="tag-picker__label">{label}</span>
      <div className="tag-picker__row">
        {tags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            className={`tag-chip ${value === tag.id ? 'is-active' : ''}`}
            aria-pressed={value === tag.id}
            onClick={() => onChange?.(tag.id)}
          >
            <span aria-hidden="true">{tag.emoji}</span> {tag.label}
          </button>
        ))}
        <button type="button" className="tag-chip tag-chip--add" onClick={() => setAdding((prev) => !prev)}>
          + 新分类
        </button>
      </div>

      {adding ? (
        <form className="tag-add" onSubmit={submit}>
          <input
            className="input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="比如：副业 / 排练"
            maxLength={8}
            aria-label="新分类名称"
          />
          <button type="submit" className="btn btn--primary btn--sm">
            加进去
          </button>
        </form>
      ) : null}
    </div>
  )
}
