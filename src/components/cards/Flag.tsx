import type { CardLanguage } from '@/lib/types'

/** Small SVG flags (emoji flags don't render on Windows). Decorative: callers provide text. */
export function Flag({ lang, className = 'h-3 w-[18px]' }: { lang: CardLanguage; className?: string }) {
  const common = { className: `${className} shrink-0 rounded-[2px] ring-1 ring-black/10`, viewBox: '0 0 18 12', 'aria-hidden': true as const }
  switch (lang) {
    case 'BR':
      return (
        <svg {...common}>
          <rect width="18" height="12" fill="#009C3B" />
          <path d="M9 1.4 16.4 6 9 10.6 1.6 6z" fill="#FFDF00" />
          <circle cx="9" cy="6" r="2.6" fill="#002776" />
        </svg>
      )
    case 'ING':
      return (
        <svg {...common}>
          <rect width="18" height="12" fill="#fff" />
          {[0, 2, 4, 6, 8, 10].map((y) => <rect key={y} y={y} width="18" height="1" fill="#B22234" />)}
          <rect width="8" height="6.5" fill="#3C3B6E" />
        </svg>
      )
    case 'JAP':
      return (
        <svg {...common}>
          <rect width="18" height="12" fill="#fff" />
          <circle cx="9" cy="6" r="3.4" fill="#BC002D" />
        </svg>
      )
    case 'CNH':
      return (
        <svg {...common}>
          <rect width="18" height="12" fill="#DE2910" />
          <path d="M3.6 1.6l.6 1.8h1.9l-1.5 1.1.6 1.8-1.6-1.1-1.5 1.1.6-1.8L1.5 3.4h1.9z" fill="#FFDE00" />
        </svg>
      )
  }
}
