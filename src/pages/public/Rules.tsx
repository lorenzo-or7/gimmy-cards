import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  BadgeCheck, CalendarClock, ChevronDown, CreditCard, FileText, Gavel, HandCoins, MessageCircle, RefreshCw, Scale, Truck, UserPlus, Users, Zap,
} from 'lucide-react'
import { Page } from '@/components/layout/Page'
import { cx } from '@/components/ui'
import { useSettings } from '@/app/providers'
import { GROUP_RULES, WHATSAPP_GROUP_URL } from '@/lib/community'

export function LegalNotice() {
  return (
    <p className="rounded-2xl border border-warning/40 bg-warning-soft p-4 text-[14px] text-warning">
      <strong>Texto inicial para revisão jurídica.</strong> Este conteúdo descreve o funcionamento da plataforma e não substitui a análise de um profissional. Não representa certificação de conformidade legal.
    </p>
  )
}

interface Topic {
  id: string
  icon: typeof Gavel
  t: string
  summary: string
  keys: string[]
  full: ReactNode
  example?: ReactNode
}

export default function Rules() {
  const s = useSettings()
  const pix = s?.pix_key ?? 'lojagimmycards@gmail.com'
  const card = s?.card_link ?? 'https://mpago.la/2QfsRQH'
  const topics: Topic[] = [
    {
      id: 'participar', icon: UserPlus, t: 'Como participar', summary: 'Crie sua conta, confira os lotes e dê seu lance dentro do horário.',
      keys: ['Terças e quintas, 19h', '24 horas', 'Sem prorrogação'],
      full: (
        <ul>
          <li>Os leilões oficiais começam às <strong>terças e quintas, às 19h</strong> (horário de Brasília) e duram <strong>24 horas</strong>, encerrando quarta e sexta às 19h.</li>
          <li><strong>Não existe prorrogação.</strong> Vale o relógio do servidor: lances recebidos depois do encerramento são recusados.</li>
          <li>A equipe pode marcar datas especiais, sempre informadas na página do leilão antes de abrir.</li>
          <li>Uma conta por pessoa, com dados verdadeiros. O WhatsApp cadastrado é usado para combinar pagamento e entrega.</li>
        </ul>
      ),
    },
    {
      id: 'lances', icon: Gavel, t: 'Regras de lances', summary: 'O primeiro lance parte do valor inicial; para passar o maior lance, some o incremento.',
      keys: ['Lance inicial', 'Incremento', 'Confirmação obrigatória'],
      full: (
        <ul>
          <li>Cada lote tem lance inicial, incremento e, às vezes, valor de arremate imediato.</li>
          <li>Para passar o maior lance, ofereça pelo menos o maior lance + o incremento.</li>
          <li>Também é possível oferecer um valor menor que o maior lance (acima do lance inicial): você entra na classificação como reserva.</li>
          <li>Cada pessoa vale pelo seu maior lance; um novo lance seu precisa ser maior que o anterior.</li>
          <li>Todo lance pede confirmação. <strong>Lance é compromisso: depois de confirmado, não pode ser retirado.</strong></li>
        </ul>
      ),
    },
    {
      id: 'empates', icon: Scale, t: 'Empates', summary: 'Valores iguais são permitidos. No empate, lidera quem registrou primeiro no servidor.',
      keys: ['Ordem do servidor', 'Valor igual é permitido'],
      full: (
        <ul>
          <li>Classificação: maior valor primeiro; em caso de empate, quem registrou antes no servidor.</li>
          <li>O horário do celular não conta: cada lance recebe um número de registro sequencial.</li>
          <li>Quem empata fica logo atrás e pode receber a carta se o primeiro não pagar.</li>
        </ul>
      ),
      example: (
        <ol className="space-y-1.5 text-[14px]">
          {[['1º', 'João', 'R$ 100,00', '#2'], ['2º', 'Maria', 'R$ 100,00', '#3'], ['3º', 'Pedro', 'R$ 95,00', '#1']].map(([p, n, v, r], i) => (
            <li key={n} className={cx('grid grid-cols-[2rem_1fr_auto] items-center gap-2 rounded-xl border px-3 py-2', i === 0 ? 'border-accent/40 bg-accent-soft' : 'border-line bg-bg')}>
              <span className="tabular font-bold">{p}</span>
              <span>{n} <span className="tabular text-[12px] text-subtle">registro {r}</span></span>
              <span className="tabular font-semibold">{v}</span>
            </li>
          ))}
          <li className="pt-1 text-[13px] text-muted">João e Maria ofereceram R$ 100,00. João registrou antes, então lidera.</li>
        </ol>
      ),
    },
    {
      id: 'arremate', icon: Zap, t: 'Arremate imediato', summary: 'Quem confirmar primeiro o valor de arremate leva na hora, e o lote fecha para todos.',
      keys: ['Duas confirmações', 'Fecha o lote'],
      full: (
        <ul>
          <li>Nem todo lote tem arremate imediato; quando tem, o valor aparece em destaque.</li>
          <li>Lances comuns não podem chegar ao valor de arremate. Para pagar esse valor, use o botão de arremate.</li>
          <li>A compra pede duas confirmações e é registrada para apenas uma pessoa.</li>
        </ul>
      ),
    },
    {
      id: 'pagamento', icon: CreditCard, t: 'Pagamentos', summary: 'Um pedido por leilão. Pague até a segunda-feira seguinte, às 18h (Brasília).',
      keys: ['Segunda, até 18h', 'PIX ou cartão', 'Comprovante pelo site'],
      full: (
        <ul>
          <li>Cada leilão gera um pedido separado com todos os lotes que você venceu.</li>
          <li>Prazo: <strong>segunda-feira seguinte ao encerramento, até 18h</strong> (horário de Brasília).</li>
          <li>PIX: <strong>{pix}</strong> · Cartão: <a href={card} target="_blank" rel="noopener noreferrer">{card}</a></li>
          <li>Envie o comprovante na página do pedido. O pagamento só é confirmado depois da conferência da equipe.</li>
          <li><strong>Relatórios:</strong> às quartas e sextas, depois do encerramento, a equipe prepara o relatório do leilão e fala em particular com os vencedores.</li>
        </ul>
      ),
    },
    {
      id: 'inadimplencia', icon: RefreshCw, t: 'Inadimplência', summary: 'Sem pagamento no prazo, a carta é oferecida ao próximo colocado pelo valor do lance dele.',
      keys: ['24 h para aceitar', 'Ordem da classificação'],
      full: (
        <ul>
          <li>Depois do prazo, a equipe verifica a situação e pode registrar a inadimplência.</li>
          <li>A carta é oferecida ao próximo colocado pelo valor do <strong>próprio lance</strong> dele, respeitando a classificação.</li>
          <li>O participante tem <strong>24 horas</strong> para aceitar. Se recusar ou não responder, a equipe pode oferecer ao seguinte.</li>
          <li>Aceitar a oferta gera um novo pedido com prazo próprio; não equivale a pagamento confirmado.</li>
        </ul>
      ),
    },
    {
      id: 'entrega', icon: Truck, t: 'Entrega e armazenamento', summary: 'Receba em casa, retire em Curitiba ou deixe suas cartas guardadas sem custo.',
      keys: ['Envio', 'Retirada em Curitiba', 'Guarda sem prazo'],
      full: (
        <ul>
          <li><strong>Envio</strong> por Correios ou transportadora. O frete é informado pela equipe depois da solicitação.</li>
          <li><strong>Retirada</strong> em eventos, feiras ou local indicado em Curitiba/PR. {s?.pickup_info}</li>
          <li><strong>Armazenamento</strong>: cartas pagas ficam guardadas sem prazo e sem taxa. Junte itens de vários leilões e peça um único envio.</li>
        </ul>
      ),
    },
  ]
  const [active, setActive] = useState(topics[0].id)
  useEffect(() => {
    const els = [...topics.map((t) => t.id), 'comunidade'].map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    const io = new IntersectionObserver((es) => {
      const v = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (v) setActive(v.target.id)
    }, { rootMargin: '-30% 0px -60% 0px' })
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const nav = [...topics.map((t) => ({ id: t.id, t: t.t })), { id: 'comunidade', t: 'Regras da comunidade' }]

  return (
    <Page>
      <header className="max-w-3xl">
        <p className="mb-2 text-[13px] font-semibold tracking-[0.14em] text-accent-text uppercase">Regras de participação</p>
        <h1 className="text-[clamp(2.2rem,calc(1.5rem_+_2.6vw),3.4rem)] leading-[1.04]">Como funciona a Gimmy Cards</h1>
        <p className="mt-4 text-lg text-muted">O essencial de cada regra em um olhar. Abra “Regra completa” quando quiser todos os detalhes.</p>
      </header>

      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="Tópicos" className="min-w-0 lg:sticky lg:top-28 lg:self-start">
          <ul className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:gap-0.5 lg:px-0">
            {nav.map((n) => (
              <li key={n.id} className="shrink-0">
                <a
                  href={`#${n.id}`}
                  aria-current={active === n.id ? 'location' : undefined}
                  className={cx(
                    'block rounded-xl px-3.5 py-2 text-[14px] font-medium whitespace-nowrap transition-colors lg:whitespace-normal',
                    active === n.id ? 'bg-accent-soft text-accent-text' : 'text-muted hover:bg-surface-2 hover:text-ink',
                  )}
                >
                  {n.t}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              [CalendarClock, 'Ter. e qui., 19h', '24 horas, sem prorrogação'],
              [HandCoins, 'Segunda, até 18h', 'prazo de pagamento'],
              [BadgeCheck, 'Lance é compromisso', 'confirmado, não se retira'],
            ].map(([I, a, b]) => {
              const Icon = I as typeof Gavel
              return (
                <div key={a as string} className="flex items-center gap-3 rounded-2xl border border-accent/25 bg-accent-soft/60 p-4">
                  <Icon aria-hidden className="size-6 shrink-0 text-accent-text" />
                  <p className="leading-tight"><span className="block font-semibold">{a as string}</span><span className="text-[13px] text-muted">{b as string}</span></p>
                </div>
              )
            })}
          </div>

          {topics.map((t, i) => (
            <TopicCard key={t.id} topic={t} index={i} />
          ))}

          <section id="comunidade" aria-labelledby="comunidade-t" className="scroll-mt-28 rounded-[1.75rem] border border-line bg-surface p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#25D366] text-[#0b1218]"><MessageCircle aria-hidden className="size-6" /></span>
                <div>
                  <p className="text-[12px] font-semibold tracking-[0.12em] text-subtle uppercase">Grupo do WhatsApp</p>
                  <h2 id="comunidade-t" className="text-2xl">Regras da comunidade</h2>
                  <p className="mt-1 max-w-xl text-[15px] text-muted">Valem para o grupo oficial, não para os leilões do site. O limite de anúncios, por exemplo, é só para o grupo.</p>
                </div>
              </div>
              <a href={WHATSAPP_GROUP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-4 font-semibold text-bg">
                <Users aria-hidden className="size-4" /> Entrar no grupo <span className="sr-only">(abre em nova aba)</span>
              </a>
            </div>
            <ol className="mt-6 grid gap-3 sm:grid-cols-2">
              {GROUP_RULES.map((r, i) => (
                <li key={r.t} className="flex gap-3 rounded-2xl border border-line bg-bg p-4">
                  <span className="tabular grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-[14px] font-bold text-accent-text">{i + 1}</span>
                  <span><span className="block font-semibold">{r.t}</span><span className="mt-0.5 block text-[14px] leading-relaxed text-muted">{r.d}</span></span>
                </li>
              ))}
            </ol>
          </section>

          <div className="pt-4"><LegalNotice /></div>
          <p className="flex items-center gap-2 text-[15px] text-subtle">
            <FileText aria-hidden className="size-4" /> Leia também a <Link to="/privacidade" className="font-medium text-accent-text underline">política de privacidade</Link>.
          </p>
        </div>
      </div>
    </Page>
  )
}

function TopicCard({ topic: t, index }: { topic: Topic; index: number }) {
  const [open, setOpen] = useState(false)
  const id = `full-${t.id}`
  return (
    <section id={t.id} aria-labelledby={`${t.id}-t`} className="scroll-mt-28 rounded-[1.75rem] border border-line bg-surface p-5 transition-colors hover:border-line-strong sm:p-7">
      <div className={cx('grid gap-5', t.example && 'xl:grid-cols-[1fr_20rem]')}>
        <div>
          <div className="flex items-start gap-4">
            <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-text">
              <t.icon aria-hidden className="size-6" />
              <span className="tabular absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-ink text-[11px] font-bold text-bg">{index + 1}</span>
            </span>
            <div>
              <h2 id={`${t.id}-t`} className="text-xl sm:text-2xl">{t.t}</h2>
              <p className="mt-1 text-[16px] leading-relaxed text-muted">{t.summary}</p>
            </div>
          </div>
          <ul className="mt-4 flex flex-wrap gap-2">
            {t.keys.map((k) => (
              <li key={k} className="rounded-full border border-line-strong px-3 py-1 text-[13px] font-medium">{k}</li>
            ))}
          </ul>
        </div>
        {t.example && <div className="rounded-2xl border border-line bg-bg-elevated p-3.5"><p className="mb-2 text-[12px] font-semibold tracking-[0.1em] text-subtle uppercase">Exemplo</p>{t.example}</div>}
      </div>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-semibold text-accent-text">
        {open ? 'Ocultar regra completa' : 'Regra completa'}
        <ChevronDown aria-hidden className={cx('size-4 transition-transform duration-300', open && 'rotate-180')} />
      </button>
      <div
        id={id}
        className={cx('grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
      >
        <div className="overflow-hidden" inert={!open}>
          <div className="pt-4 text-[16px] leading-relaxed text-muted [&_a]:font-medium [&_a]:break-all [&_a]:text-accent-text [&_a]:underline [&_li]:relative [&_li]:pl-5 [&_li]:before:absolute [&_li]:before:top-[0.65em] [&_li]:before:left-0 [&_li]:before:size-1.5 [&_li]:before:rounded-full [&_li]:before:bg-accent [&_li]:before:content-[''] [&_strong]:text-ink [&_ul]:space-y-2.5">
            {t.full}
          </div>
        </div>
      </div>
    </section>
  )
}
