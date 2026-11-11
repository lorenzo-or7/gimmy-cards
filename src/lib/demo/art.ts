/**
 * Procedural illustrations for DEMO cards only. They are deliberately
 * abstract and stamped "DEMO" so they can never be mistaken for real lots.
 */
const PALETTES = [
  ['#0f3b4a', '#40d9d0', '#fff1d6'],
  ['#3a1f4f', '#e59bd2', '#fff1d6'],
  ['#4a2a10', '#f5c76b', '#fff6e6'],
  ['#12324a', '#7fb8ff', '#eaf4ff'],
  ['#1d3b26', '#83e6ce', '#f2fff9'],
  ['#4a1420', '#ff8a7a', '#fff0ec'],
]

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!)

function glyph(seed: number, accent: string, light: string) {
  const kind = seed % 4
  if (kind === 0) // crescent + star
    return `<circle cx="150" cy="170" r="70" fill="${accent}" opacity=".9"/><circle cx="178" cy="150" r="62" fill="url(#bg)"/><path d="M205 120l8 18 19 2-14 13 4 19-17-10-17 10 4-19-14-13 19-2z" fill="${light}"/>`
  if (kind === 1) // flame
    return `<path d="M150 90c30 40 62 60 62 104a62 62 0 0 1-124 0c0-28 18-40 28-62 8 22 18 30 30 30-10-24-6-48 4-72z" fill="${accent}"/><path d="M150 168c14 14 26 22 26 38a26 26 0 0 1-52 0c0-14 14-22 26-38z" fill="${light}" opacity=".85"/>`
  if (kind === 2) // wave
    return `<g fill="none" stroke="${accent}" stroke-width="12" stroke-linecap="round"><path d="M72 150c26-30 52-30 78 0s52 30 78 0"/><path d="M72 190c26-30 52-30 78 0s52 30 78 0" opacity=".7"/><path d="M72 230c26-30 52-30 78 0s52 30 78 0" opacity=".45"/></g><circle cx="150" cy="104" r="16" fill="${light}"/>`
  return `<path d="M150 86l70 120H80z" fill="${accent}"/><circle cx="150" cy="176" r="26" fill="${light}"/><path d="M150 236l40-30H110z" fill="${accent}" opacity=".6"/>` // crystal
}

export function demoCardFront(title: string, collection: string, lang: string) {
  const h = hash(title)
  const [bg, accent, light] = PALETTES[h % PALETTES.length]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="#0b1218"/></linearGradient>
<radialGradient id="glow" cx=".5" cy=".38" r=".5"><stop offset="0" stop-color="${accent}" stop-opacity=".45"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient></defs>
<rect width="300" height="420" rx="18" fill="${light}"/>
<rect x="12" y="12" width="276" height="396" rx="12" fill="url(#bg)"/>
<rect x="24" y="52" width="252" height="226" rx="8" fill="url(#bg)" stroke="${accent}" stroke-opacity=".5"/>
<rect x="24" y="52" width="252" height="226" rx="8" fill="url(#glow)"/>
<g transform="translate(0 -6)">${glyph(h >> 3, accent, light)}</g>
<text x="26" y="38" font-family="Fredoka, sans-serif" font-weight="700" font-size="19" fill="${light}">${esc(title.slice(0, 22))}</text>
<text x="274" y="38" text-anchor="end" font-family="Fredoka, sans-serif" font-weight="600" font-size="13" fill="${accent}">${esc(lang)}</text>
<rect x="24" y="290" width="252" height="86" rx="8" fill="${light}" fill-opacity=".08"/>
<text x="36" y="318" font-family="Fredoka, sans-serif" font-size="13" fill="${light}" fill-opacity=".8">${esc(collection.slice(0, 30))}</text>
<g fill="${light}" fill-opacity=".35"><rect x="36" y="332" width="170" height="6" rx="3"/><rect x="36" y="346" width="130" height="6" rx="3"/></g>
<g transform="rotate(-18 150 210)"><rect x="70" y="190" width="160" height="40" rx="8" fill="none" stroke="${light}" stroke-opacity=".55" stroke-width="3"/>
<text x="150" y="219" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="24" letter-spacing="6" fill="${light}" fill-opacity=".6">DEMO</text></g>
<text x="150" y="398" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="10" fill="${light}" fill-opacity=".5">Ilustração de demonstração · não é um lote real</text>
</svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

export function demoCardBack() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420">
<defs><pattern id="p" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="28" height="28" fill="#14242c"/><path d="M14 4l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#40d9d0" fill-opacity=".22"/></pattern></defs>
<rect width="300" height="420" rx="18" fill="#fff1d6"/><rect x="12" y="12" width="276" height="396" rx="12" fill="url(#p)"/>
<ellipse cx="150" cy="210" rx="92" ry="120" fill="#0b1218" stroke="#40d9d0" stroke-width="4"/>
<text x="150" y="204" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="30" fill="#40d9d0">GIMMY</text>
<text x="150" y="236" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="30" fill="#83e6ce">CARDS</text>
<text x="150" y="268" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="12" letter-spacing="4" fill="#fff1d6" fill-opacity=".6">DEMO</text></svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}
