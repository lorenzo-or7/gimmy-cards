import type { CSSProperties, ReactNode } from 'react'
import { cx } from '@/components/ui'

/**
 * A card with physical thickness: the face sits on a stack of thin edge
 * layers (CSS 3D, no WebGL), plus a light gradient and a holographic sheen.
 * The parent must provide `perspective`.
 */
export function Card3D({ children, className, style, depth = 6, edge = '#c9b99a', radius = 16 }: { children: ReactNode; className?: string; style?: CSSProperties; depth?: number; edge?: string; radius?: number }) {
  return (
    <div className={cx('[transform-style:preserve-3d]', className)} style={style}>
      {Array.from({ length: depth }).map((_, i) => (
        <div
          key={i}
          aria-hidden
          className="absolute inset-0"
          style={{ transform: `translateZ(${-(i + 1)}px)`, borderRadius: radius, background: edge, filter: `brightness(${0.92 - i * 0.07})` }}
        />
      ))}
      <div className="holo relative overflow-hidden" style={{ borderRadius: radius, ['--holo-opacity' as string]: 0.22 }}>
        {children}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgb(255_255_255/.22),transparent_38%,transparent_62%,rgb(0_0_0/.28))]" />
      </div>
    </div>
  )
}

/** Brand card back illustration (decorative, never a lot). */
export function BrandBack({ hue = 0, id }: { hue?: number; id: string }) {
  return (
    <svg viewBox="0 0 250 350" className="block size-full" style={{ filter: hue ? `hue-rotate(${hue}deg)` : undefined }} aria-hidden>
      <defs>
        <pattern id={`pp${id}`} width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="22" height="22" fill="#14242C" />
          <path d="M11 3l2.2 5.8L19 11l-5.8 2.2L11 19l-2.2-5.8L3 11l5.8-2.2z" fill="#40D9D0" fillOpacity=".2" />
        </pattern>
        <linearGradient id={`rim${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF1D6" />
          <stop offset=".5" stopColor="#E8DCC0" />
          <stop offset="1" stopColor="#FFF1D6" />
        </linearGradient>
        <radialGradient id={`glow${id}`} cx=".5" cy=".45" r=".5">
          <stop offset="0" stopColor="#40D9D0" stopOpacity=".35" />
          <stop offset="1" stopColor="#40D9D0" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="250" height="350" rx="16" fill={`url(#rim${id})`} />
      <rect x="9" y="9" width="232" height="332" rx="11" fill={`url(#pp${id})`} />
      <rect x="9" y="9" width="232" height="332" rx="11" fill={`url(#glow${id})`} />
      <ellipse cx="125" cy="175" rx="72" ry="100" fill="#0B1218" stroke="#40D9D0" strokeWidth="3" />
      <ellipse cx="125" cy="175" rx="62" ry="90" fill="none" stroke="#83E6CE" strokeOpacity=".35" strokeWidth="1.5" strokeDasharray="3 6" />
      <path d="M125 128l8 21 21 8-21 8-8 21-8-21-21-8 21-8z" fill="#FFF1D6" />
      <circle cx="125" cy="226" r="4" fill="#40D9D0" />
    </svg>
  )
}
