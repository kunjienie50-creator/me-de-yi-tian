/**
 * 小猫：目前是占位形象，纯 SVG，不依赖图片资源。
 *
 * 想换成自己画的形象时，只改这一个文件：
 * 1) 画好三张不同状态的图（待着 / 开心 / 困），放到 public/ 下，例如 public/cat/mine-idle.png …
 * 2) 在 CAT_SKINS 里加一项 { id, name, kind: 'image', idle, happy, sleepy }
 * 3) 设置页的「小猫形象」会自动多出一个选项，其它页面不用动
 *
 * mood: idle | happy | sleepy
 * poke: 每次点猫传一个递增的数字，用来重播「跳一下」的动画
 */
export const CAT_SKINS = [
  {
    id: 'orange',
    name: '小橘',
    kind: 'svg',
    fur: '#ffc98b',
    furDeep: '#f2b072',
    belly: '#fff6ec',
    ear: '#ff9da6',
    blush: '#ff9da6',
    whisker: '#e0a675',
  },
  {
    id: 'cream',
    name: '奶糖',
    kind: 'svg',
    fur: '#fbe8d3',
    furDeep: '#e3c3a0',
    belly: '#fffaf2',
    ear: '#f7b3a8',
    blush: '#f3a79c',
    whisker: '#d8b795',
  },
  {
    id: 'grey',
    name: '芝麻',
    kind: 'svg',
    fur: '#cfd4dc',
    furDeep: '#98a0ac',
    belly: '#f4f6f9',
    ear: '#e5a7b4',
    blush: '#d99aa6',
    whisker: '#9aa2ae',
  },
]

export function skinById(id) {
  return CAT_SKINS.find((skin) => skin.id === id) || CAT_SKINS[0]
}

export default function Cat({ mood = 'idle', skin: skinId = 'orange', className = '', label, poke, onPoke }) {
  const skin = skinById(skinId)
  const name =
    label ||
    (mood === 'happy' ? '一只开心的小猫' : mood === 'sleepy' ? '一只准备睡的小猫' : '一只在等你的小猫')

  // 以后换成自己的图：skin.kind === 'image' 时直接渲染图片，动画类照样生效
  if (skin.kind === 'image') {
    const src = skin[mood] || skin.idle
    return (
      <img
        className={`cat cat--${mood} ${poke ? 'is-poke' : ''} ${className}`}
        src={src}
        alt={skin.name || name}
        onClick={onPoke}
      />
    )
  }

  return (
    <svg
      className={`cat cat--${mood} ${poke ? 'is-poke' : ''} ${className}`}
      viewBox="0 0 200 210"
      role="img"
      aria-label={name}
      onClick={onPoke}
    >
      <path
        className="cat__tail"
        d="M148 186c22-4 34-20 30-38-3-14-16-20-25-13"
        fill="none"
        stroke={skin.furDeep}
        strokeWidth="11"
        strokeLinecap="round"
      />
      <ellipse cx="100" cy="172" rx="52" ry="34" fill={skin.fur} />
      <ellipse cx="100" cy="182" rx="30" ry="20" fill={skin.belly} />
      <ellipse cx="76" cy="196" rx="15" ry="10" fill={skin.belly} stroke={skin.furDeep} strokeWidth="2" />
      <ellipse cx="124" cy="196" rx="15" ry="10" fill={skin.belly} stroke={skin.furDeep} strokeWidth="2" />

      <path d="M50 58 42 16 86 44Z" fill={skin.fur} stroke={skin.furDeep} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M150 58 158 16 114 44Z" fill={skin.fur} stroke={skin.furDeep} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M57 50 53 28 76 43Z" fill={skin.ear} />
      <path d="M143 50 147 28 124 43Z" fill={skin.ear} />

      <ellipse cx="100" cy="92" rx="59" ry="49" fill={skin.fur} stroke={skin.furDeep} strokeWidth="2.5" />
      <path d="M92 52v9M100 49v11M108 52v9" stroke={skin.furDeep} strokeWidth="3" strokeLinecap="round" />

      <ellipse cx="62" cy="106" rx="11" ry="7" fill={skin.blush} opacity="0.5" />
      <ellipse cx="138" cy="106" rx="11" ry="7" fill={skin.blush} opacity="0.5" />

      <g className="cat__eye-open">
        <ellipse cx="80" cy="90" rx="7.5" ry="9.5" fill="#4a362b" />
        <ellipse cx="120" cy="90" rx="7.5" ry="9.5" fill="#4a362b" />
        <circle cx="82.6" cy="86" r="2.6" fill="#ffffff" />
        <circle cx="122.6" cy="86" r="2.6" fill="#ffffff" />
      </g>

      <g className="cat__eye-happy">
        <path d="M70 92q10-13 20 0" fill="none" stroke="#4a362b" strokeWidth="4" strokeLinecap="round" />
        <path d="M110 92q10-13 20 0" fill="none" stroke="#4a362b" strokeWidth="4" strokeLinecap="round" />
      </g>

      <path d="M100 103l-5 5h10z" fill="#ff8f9b" stroke="#ff8f9b" strokeLinejoin="round" />
      <path
        d="M100 110v4M100 114c-2.5 4-7 4-9 1M100 114c2.5 4 7 4 9 1"
        fill="none"
        stroke="#4a362b"
        strokeWidth="2.6"
        strokeLinecap="round"
      />

      <g stroke={skin.whisker} strokeWidth="2.2" strokeLinecap="round">
        <path d="M50 96 22 89M50 105 20 105M50 114 24 122" />
        <path d="M150 96 178 89M150 105 180 105M150 114 176 122" />
      </g>
    </svg>
  )
}
