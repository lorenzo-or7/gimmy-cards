import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Database, Eye, FileLock2, HardDrive, Mail, Share2, ShieldCheck, Target, UserCheck, Users } from 'lucide-react'
import { Page } from '@/components/layout/Page'
import { cx } from '@/components/ui'
import { openCookieNotice } from '@/components/layout/CookieNotice'
import { LegalNotice } from './Rules'

type Block = { id: string; icon: typeof Eye; t: string; lead?: string; items?: string[]; text?: string[]; note?: string }

// Content preserved from the initial privacy text (pending legal review).
const BLOCKS: Block[] = [
  { id: 'quem-somos', icon: Users, t: 'Quem somos', text: ['A Gimmy Cards é uma comunidade e loja de cartas colecionáveis com sede em Curitiba/PR. Esta política explica como tratamos dados pessoais na plataforma de leilões, de acordo com os princípios da Lei Geral de Proteção de Dados (LGPD).'] },
  {
    id: 'dados', icon: Database, t: 'Dados que coletamos',
    items: [
      'Cadastro: nome, e-mail, WhatsApp e senha (armazenada de forma criptografada pelo provedor de autenticação).',
      'Participação: lances, arremates, pedidos, comprovantes de pagamento, preferências de notificação e Pokémon favoritos.',
      'Entrega: nome do destinatário, endereço e CEP, apenas quando você solicita um envio.',
    ],
  },
  {
    id: 'finalidade', icon: Target, t: 'Para que usamos',
    items: [
      'Registrar e ordenar lances, apontar vencedores e gerar pedidos (execução do serviço que você solicitou).',
      'Conferir pagamentos e combinar entregas ou retiradas.',
      'Enviar notificações sobre seus lances, pedidos, novos leilões e Pokémon favoritos, conforme suas preferências.',
      'Manter registros de auditoria das ações administrativas, para transparência e segurança.',
    ],
  },
  {
    id: 'publico', icon: Eye, t: 'O que é público', lead: 'Seu nome completo nunca aparece para outros participantes.',
    items: [
      'Nos quadros de lances e no histórico aparece apenas seu primeiro nome e a inicial do sobrenome (ex.: “Maria S.”).',
      'E-mail, WhatsApp, endereço, comprovantes e sua lista de favoritos nunca são exibidos publicamente.',
    ],
  },
  { id: 'comprovantes', icon: FileLock2, t: 'Comprovantes de pagamento', text: ['Ficam em armazenamento privado. Só você e a equipe administrativa conseguem abrir, por meio de links temporários.'] },
  {
    id: 'navegador', icon: HardDrive, t: 'Armazenamento no navegador', lead: 'Não usamos cookies de rastreamento, publicidade ou análise de audiência.',
    items: [
      'Essencial: manter sua sessão de login e lembrar sua escolha sobre armazenamento.',
      'Preferências (opcional): lembrar o tema claro/escuro e o estado do menu do painel.',
    ],
    note: 'storage',
  },
  { id: 'compartilhamento', icon: Share2, t: 'Compartilhamento', text: ['Não vendemos dados. Usamos provedores de infraestrutura (banco de dados, autenticação e armazenamento) que tratam dados em nosso nome. Dados de envio podem ser repassados à transportadora escolhida.'] },
  { id: 'direitos', icon: UserCheck, t: 'Seus direitos', text: ['Você pode pedir acesso, correção, portabilidade ou exclusão dos seus dados, e revogar consentimentos, falando com a equipe. Alguns registros (como lances e pedidos) podem precisar ser mantidos pelo tempo exigido em lei ou para resolver disputas.'] },
  { id: 'seguranca', icon: ShieldCheck, t: 'Segurança', text: ['Aplicamos controle de acesso por perfil no servidor, políticas de segurança no banco de dados, conexões criptografadas e registro de ações administrativas.'] },
  { id: 'contato', icon: Mail, t: 'Contato', text: ['Para dúvidas ou solicitações sobre seus dados: lojagimmycards@gmail.com.'] },
]

export default function Privacy() {
  const [active, setActive] = useState(BLOCKS[0].id)
  useEffect(() => {
    const io = new IntersectionObserver((es) => {
      const v = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (v) setActive(v.target.id)
    }, { rootMargin: '-25% 0px -65% 0px' })
    BLOCKS.forEach((b) => {
      const el = document.getElementById(b.id)
      if (el) io.observe(el)
    })
    return () => io.disconnect()
  }, [])
  return (
    <Page>
      <header className="max-w-3xl">
        <p className="t-eyebrow mb-2.5">Privacidade</p>
        <h1 className="t-h1">Política de privacidade</h1>
        <p className="t-lead mt-4">Quais dados usamos, por quê, o que fica público e como você controla tudo isso. Escrito para ser lido em poucos minutos.</p>
        <div className="mt-6"><LegalNotice /></div>
      </header>

      <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="Índice" className="min-w-0 lg:sticky lg:top-28 lg:self-start">
          <p className="mb-3 hidden text-[12px] font-semibold tracking-[0.12em] text-subtle uppercase lg:block">Nesta página</p>
          <ol className="-mx-[var(--gutter)] flex gap-2 overflow-x-auto px-[var(--gutter)] pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:gap-0.5 lg:px-0">
            {BLOCKS.map((b, i) => (
              <li key={b.id} className="shrink-0">
                <a
                  href={`#${b.id}`}
                  aria-current={active === b.id ? 'location' : undefined}
                  className={cx(
                    'flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] font-medium whitespace-nowrap transition-colors lg:whitespace-normal',
                    active === b.id ? 'bg-accent-soft text-accent-text' : 'border border-line text-muted hover:bg-surface-2 hover:text-ink lg:border-transparent',
                  )}
                >
                  <span className="tabular hidden w-5 text-[12px] text-subtle lg:inline">{String(i + 1).padStart(2, '0')}</span>
                  {b.t}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="min-w-0 max-w-[44rem] space-y-4">
          {BLOCKS.map((b, i) => (
            <section key={b.id} id={b.id} aria-labelledby={`${b.id}-t`} className="scroll-mt-28 rounded-[24px] border border-line bg-surface p-6 sm:p-7">
              <div className="flex items-center gap-3.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-text">
                  <b.icon aria-hidden className="size-5" />
                </span>
                <h2 id={`${b.id}-t`} className="t-h3">
                  <span className="tabular mr-2 text-subtle">{String(i + 1).padStart(2, '0')}</span>
                  {b.t}
                </h2>
              </div>
              {b.lead && <p className="mt-4 rounded-xl border-l-[3px] border-accent bg-accent-soft/50 px-4 py-2.5 text-[15px] font-medium">{b.lead}</p>}
              {b.text?.map((t) => <p key={t} className="mt-4 text-[16px] leading-[1.7] text-muted">{t}</p>)}
              {b.items && (
                <ul className="mt-4 space-y-2.5">
                  {b.items.map((t) => (
                    <li key={t} className="relative pl-5 text-[16px] leading-[1.65] text-muted before:absolute before:top-[0.68em] before:left-0 before:size-1.5 before:rounded-full before:bg-accent">{t}</li>
                  ))}
                </ul>
              )}
              {b.note === 'storage' && (
                <button type="button" onClick={openCookieNotice} className="mt-4 text-[14px] font-semibold text-accent-text underline underline-offset-2">
                  Rever minhas preferências de armazenamento
                </button>
              )}
            </section>
          ))}
          <p className="pt-4 text-[15px] text-subtle">
            Veja também as <Link to="/regras" className="font-medium text-accent-text underline">regras de participação</Link>.
          </p>
        </article>
      </div>
    </Page>
  )
}
