/** 手绘风小猫：纯 SVG，不依赖任何图片资源。mood: idle | happy | sleepy */
export default function Cat({ mood = 'idle', className = '', label }) {
  const name = label || (mood === 'happy' ? '一只开心的小猫' : mood === 'sleepy' ? '一只准备睡的小猫' : '一只在等你的小猫')
  return (
    <svg
      className={`cat cat--${mood} ${className}`}
      viewBox="0 0 200 210"
      role="img"
      aria-label={name}
    >
      <path
        className="cat__tail"
        d="M148 186c22-4 34-20 30-38-3-14-16-20-25-13"
        fill="none"
        stroke="#f2b072"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <ellipse cx="100" cy="172" rx="52" ry="34" fill="#ffc98b" />
      <ellipse cx="100" cy="182" rx="30" ry="20" fill="#fff6ec" />
      <ellipse cx="76" cy="196" rx="15" ry="10" fill="#fff6ec" stroke="#f2b072" strokeWidth="2" />
      <ellipse cx="124" cy="196" rx="15" ry="10" fill="#fff6ec" stroke="#f2b072" strokeWidth="2" />

      <path d="M50 58 42 16 86 44Z" fill="#ffc98b" stroke="#f2b072" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M150 58 158 16 114 44Z" fill="#ffc98b" stroke="#f2b072" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M57 50 53 28 76 43Z" fill="#ff9da6" />
      <path d="M143 50 147 28 124 43Z" fill="#ff9da6" />

      <ellipse cx="100" cy="92" rx="59" ry="49" fill="#ffc98b" stroke="#f2b072" strokeWidth="2.5" />
      <path d="M92 52v9M100 49v11M108 52v9" stroke="#f2b072" strokeWidth="3" strokeLinecap="round" />

      <ellipse cx="62" cy="106" rx="11" ry="7" fill="#ff9da6" opacity="0.5" />
      <ellipse cx="138" cy="106" rx="11" ry="7" fill="#ff9da6" opacity="0.5" />

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

      <g stroke="#e0a675" strokeWidth="2.2" strokeLinecap="round">
        <path d="M50 96 22 89M50 105 20 105M50 114 24 122" />
        <path d="M150 96 178 89M150 105 180 105M150 114 176 122" />
      </g>
    </svg>
  )
}
