const WHITE_PINK = { background: '#fff8fc', surface: '#ffffff', text: '#352330' }

function rgb(hex) {
  return hex.match(/[a-f\d]{2}/gi).map((part) => parseInt(part, 16))
}

function mix(first, second, amount) {
  const a = rgb(first)
  const b = rgb(second)
  return `#${a.map((value, index) => Math.round(value + (b[index] - value) * amount).toString(16).padStart(2, '0')).join('')}`
}

function createTheme() {
  const { background, surface, text } = WHITE_PINK
  const foreground = rgb(text).join(', ')
  const pink = '#ff9bc9'
  const panel = mix(surface, pink, 0.2)
  const raised = mix(surface, text, 0.012)
  return {
    '--cream': background,
    '--cream-deep': mix(background, text, 0.035),
    '--surface': surface,
    '--surface-soft': mix(surface, background, 0.65),
    '--surface-raised': raised,
    '--surface-input': mix(surface, background, 0.4),
    '--ink': text,
    '--ink-soft': mix(text, surface, 0.28),
    '--peach': pink,
    '--peach-deep': '#b81763',
    '--on-accent': '#260d1d',
    '--line': `rgba(${foreground}, 0.1)`,
    '--line-strong': `rgba(${foreground}, 0.22)`,
    '--neutral-fill': `rgba(${foreground}, 0.055)`,
    '--neutral-track': `rgba(${foreground}, 0.16)`,
    '--neutral-dot': `rgba(${foreground}, 0.13)`,
    '--nav-background': `rgba(${rgb(background).join(', ')}, 0.95)`,
    '--accent-panel-gradient': `linear-gradient(135deg, ${panel}, ${mix(surface, pink, 0.075)})`,
    '--accent-hover': mix(surface, pink, 0.22),
    '--night-gradient': `linear-gradient(180deg, ${background}, ${mix(background, pink, 0.08)})`,
    '--card-shadow': `0 18px 40px -28px rgba(84, 25, 60, ${0.16})`,
    '--mint': '#28684d',
    '--mint-soft': mix(surface, '#a2d8c1', 0.18),
    '--lav': '#80499a',
    '--lav-soft': mix(surface, '#dcb4ed', 0.22),
    '--warn': '#8f561c',
    '--warn-soft': mix(surface, '#efc28e', 0.2),
    '--danger': '#b8204b',
    '--danger-soft': mix(surface, '#ff9dad', 0.2),
    '--night': background,
    '--night-soft': mix(surface, background, 0.5),
    '--color-scheme': 'light',
    '--trail-ink': '#4b4b4b',
  }
}

export function applyTheme() {
  const root = document.documentElement
  const theme = createTheme()
  Object.entries(theme).forEach(([key, color]) => root.style.setProperty(key, color))
  root.style.colorScheme = theme['--color-scheme']
}
