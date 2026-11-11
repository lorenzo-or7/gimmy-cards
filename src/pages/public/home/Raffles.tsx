import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Gift, Users } from 'lucide-react'
import { cx } from '@/components/ui'
import { RAFFLES, WHATSAPP_GROUP_URL } from '@/lib/community'

const fmt = new Intl.NumberFormat('pt-BR')

/** Official prizes per WhatsApp-group milestone. No counts, dates or winners are invented. */
export function RaffleGrid({ large }: { large?: boolean }) {
  const reduce = useReducedMotion()
  return (
    <ol className={cx('relative grid gap-4 min-[480px]:grid-cols-2 md:grid-cols-3', large ? 'xl:grid-cols-3' : 'lg:grid-cols-5')}>
      {RAFFLES.map((r, i) => (
        <motion.li
          key={r.members}
          initial={reduce ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5, delay: i * 0.07, ease: [0.2, 0.8, 0.2, 1] }}
          className="group flex flex-col overflow-hidden rounded-[1.4rem] border border-line bg-surface transition-[border-color,transform,box-shadow] duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-pop"
        >
          <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[13px] font-semibold text-accent-text">
              <Users aria-hidden className="size-3.5" /> {fmt.format(r.members)} membros
            </span>
            <span className="tabular text-[12px] font-semibold text-subtle">Marco {i + 1}</span>
          </div>
          {/* official art is square and carries its own title: shown whole, never cropped */}
          <div className="relative mx-3 overflow-hidden rounded-[1rem] bg-[#0b1218]">
            <img
              src={r.image}
              alt={`Arte oficial do sorteio: ${r.prize} ${r.language}`}
              width={800}
              height={800}
              loading="lazy"
              decoding="async"
              className="aspect-square w-full object-contain transition-transform duration-700 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-[1.03]"
            />
          </div>
          <div className="flex flex-1 flex-col px-4 pt-3.5 pb-4">
            <p className="text-[12px] font-semibold tracking-[0.1em] text-subtle uppercase">Prêmio</p>
            <p className="mt-0.5 text-[17px] leading-snug font-semibold">{r.prize}</p>
            <p className="text-[14px] text-muted">{r.language}</p>
          </div>
        </motion.li>
      ))}
    </ol>
  )
}

export function Raffles() {
  return (
    <section aria-labelledby="raffle-title" className="border-y border-line bg-bg-elevated">
      <div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 lg:py-20">
        <div className="mb-9 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-2.5 inline-flex items-center gap-2 text-[13px] font-semibold tracking-[0.14em] text-accent-text uppercase">
              <Gift aria-hidden className="size-4" /> Sorteios da comunidade
            </p>
            <h2 id="raffle-title" className="text-[clamp(2rem,calc(1.3rem_+_2.4vw),3.1rem)] leading-[1.05]">Cada marco do grupo vale um prêmio.</h2>
            <p className="mt-3 text-[17px] text-muted">Prêmios oficiais da coleção de 30 anos, por número de membros no grupo do WhatsApp.</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <a href={WHATSAPP_GROUP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-4 font-semibold text-bg transition-transform active:scale-[.98]">
              Entrar no grupo <span className="sr-only">(abre o WhatsApp em nova aba)</span>
            </a>
            <Link to="/sorteios" className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-line-strong px-4 font-semibold hover:border-accent">
              Ver sorteios <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
        <RaffleGrid />
      </div>
    </section>
  )
}
