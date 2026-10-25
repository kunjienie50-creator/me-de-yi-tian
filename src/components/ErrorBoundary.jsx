import { Component } from 'react'

/**
 * 兜底边界：任何一次渲染抛错，都不要变成「整页空白 + 刷新也没用」。
 * 这里给两条出路：重试（重新挂载整棵树）和导出一份当前数据（抢救用）。
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
    this.retry = this.retry.bind(this)
    this.download = this.download.bind(this)
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // 留在控制台里，方便下次排查；不要在这里做任何写入
    console.error('[app] 渲染出错', error, info)
  }

  retry() {
    this.setState({ error: null })
  }

  download() {
    try {
      const raw = localStorage.getItem('me-de-yi-tian.state.v1') || '{}'
      const blob = new Blob([raw], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `me的一天-备份-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.warn('[app] 导出失败', error)
    }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <main className="screen" role="alert">
        <div className="panel">
          <p className="panel__eyebrow">出了点问题</p>
          <h1 className="panel__title">这一页没能显示出来</h1>
          <p className="hint hint--left">
            你的数据还在本地，没有被删掉。可以先「再试一次」；如果还是不行，先导出一份备份，再重置本地数据。
          </p>
          <p className="hint hint--left" style={{ fontFamily: 'monospace', fontSize: '11px', opacity: 0.7 }}>
            {String(error && error.message ? error.message : error)}
          </p>
          <div className="btn-row" style={{ marginTop: '12px' }}>
            <button type="button" className="btn btn--primary" onClick={this.retry}>
              再试一次
            </button>
            <button type="button" className="btn btn--ghost" onClick={this.download}>
              导出备份
            </button>
          </div>
          <p className="footnote">还是不行的话：清掉本站数据会重置为演示数据，但会丢掉你自己的任务。</p>
        </div>
      </main>
    )
  }
}
