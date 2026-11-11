import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Gavel, LayoutDashboard, Package, Trophy, Warehouse } from 'lucide-react'
import { ACCOUNT_TABS, Page, PageHeader, Tabs } from '@/components/layout/Page'
import { Badge, Button, Field, Input, Switch } from '@/components/ui'
import { useAuth, useBackend, useToast } from '@/app/providers'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { dateOnly, formatPhone, onlyDigits } from '@/lib/format'

export default function Account() {
  const { profile, refreshProfile, isAdmin } = useAuth()
  const backend = useBackend()
  const toast = useToast()
  const [name, setName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(formatPhone(profile?.whatsapp ?? ''))
  const [prefs, setPrefs] = useState(profile?.notify_prefs ?? {})
  const [busy, setBusy] = useState(false)
  const [pw, setPw] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  useEffect(() => {
    if (profile) {
      setName(profile.full_name)
      setPhone(formatPhone(profile.whatsapp))
      setPrefs(profile.notify_prefs ?? {})
    }
  }, [profile])
  if (!profile) return null

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.updateMe(name, onlyDigits(phone), prefs)
      await refreshProfile()
      toast({ kind: 'success', title: 'Dados atualizados' })
    } catch (err) {
      toast({ kind: 'error', title: 'Não foi possível salvar', body: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }
  const changePw = async (e: FormEvent) => {
    e.preventDefault()
    if (pw.length < 8) return toast({ kind: 'error', title: 'A senha precisa de 8 caracteres ou mais' })
    setPwBusy(true)
    try {
      await backend.auth.updatePassword(pw)
      setPw('')
      toast({ kind: 'success', title: 'Senha alterada' })
    } catch (err) {
      toast({ kind: 'error', title: 'Não foi possível alterar', body: errorMessage(err) })
    } finally {
      setPwBusy(false)
    }
  }
  const shortcuts = [
    { to: '/conta/lances', icon: Gavel, t: 'Meus lances', d: 'Acompanhe sua posição em cada lote' },
    { to: '/conta/arremates', icon: Trophy, t: 'Arremates', d: 'Lotes vencidos e ofertas para você' },
    { to: '/conta/pedidos', icon: Package, t: 'Pedidos', d: 'Pagamento e comprovantes' },
    { to: '/conta/armazenadas', icon: Warehouse, t: 'Cartas armazenadas', d: 'Peça envio ou retirada' },
  ]
  return (
    <Page>
      <PageHeader eyebrow="Minha conta" title={`Olá, ${profile.full_name.split(' ')[0]}!`}>
        Participante desde {dateOnly(profile.created_at)}{' '}
        {profile.role !== 'participant' && <Badge tone="accent" className="ml-2">{profile.role === 'super_admin' ? 'Administrador principal' : 'Administrador'}</Badge>}
      </PageHeader>
      <Tabs label="Seções da conta" items={ACCOUNT_TABS} />
      {isAdmin && (
        <Link to="/admin" className="mb-8 flex items-center gap-4 rounded-3xl border border-accent/40 bg-accent-soft p-5 hover:border-accent">
          <LayoutDashboard aria-hidden className="size-6 text-accent-text" />
          <span>
            <span className="block font-semibold">Painel administrativo</span>
            <span className="block text-[15px] text-muted">Leilões, cartas, pagamentos e entregas</span>
          </span>
        </Link>
      )}
      <ul className="mb-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {shortcuts.map((s) => (
          <li key={s.to}>
            <Link to={s.to} className="block h-full rounded-3xl border border-line bg-surface p-5 transition-colors hover:border-accent/50">
              <s.icon aria-hidden className="size-6 text-accent-text" />
              <span className="mt-4 block font-semibold">{s.t}</span>
              <span className="block text-[14px] text-muted">{s.d}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="grid gap-8 lg:grid-cols-2">
        <form onSubmit={save} className="rounded-[1.75rem] border border-line bg-surface p-6">
          <h2 className="text-xl">Seus dados</h2>
          <div className="mt-5 space-y-5">
            <Field label="Nome completo">{(p) => <Input id={p.id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}</Field>
            <Field label="E-mail" hint="Para trocar o e-mail, fale com a equipe.">{(p) => <Input id={p.id} value={profile.email} disabled aria-describedby={p.describedBy} />}</Field>
            <Field label="WhatsApp">{(p) => <Input id={p.id} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={() => setPhone(formatPhone(phone))} />}</Field>
          </div>
          <h3 className="mt-8 text-lg">Notificações opcionais</h3>
          <ul className="mt-3 divide-y divide-line">
            {([
              ['outbid', 'Lance superado', 'Quando alguém passar seu lance'],
              ['ending_soon', 'Encerramento próximo', '1 hora antes dos lotes em que você deu lance'],
              ['new_auction', 'Novos leilões', 'Quando um leilão for publicado'],
              ['favorites', 'Pokémon favoritos', 'Quando uma carta de um favorito entrar em leilão'],
            ] as const).map(([k, t, d]) => (
              <li key={k} className="flex items-center justify-between gap-4 py-3">
                <span>
                  <span className="block font-medium">{t}</span>
                  <span className="block text-[14px] text-subtle">{d}</span>
                </span>
                <Switch label={t} checked={prefs[k] !== false} onChange={(v) => setPrefs({ ...prefs, [k]: v })} />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[13px] text-subtle">Avisos de vitória, pagamento e entrega são sempre enviados.</p>
          <Button type="submit" className="mt-6" loading={busy}>Salvar alterações</Button>
        </form>
        <form onSubmit={changePw} className="h-fit rounded-[1.75rem] border border-line bg-surface p-6">
          <h2 className="text-xl">Senha</h2>
          <Field label="Nova senha" hint="Mínimo de 8 caracteres." className="mt-5">
            {(p) => <Input id={p.id} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} aria-describedby={p.describedBy} />}
          </Field>
          <Button type="submit" variant="secondary" className="mt-5" loading={pwBusy}>Alterar senha</Button>
        </form>
      </div>
    </Page>
  )
}
