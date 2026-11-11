import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { useAuth, useBackend, useToast } from '@/app/providers'
import { Button, Checkbox, Field, Input } from '@/components/ui'
import { errorMessage } from '@/lib/errors'
import { formatPhone, onlyDigits } from '@/lib/format'
import { AuthShell, authLink } from './AuthShell'
import { Mascot } from '@/components/brand/Mascot'
import { safeNext } from './Login'

export function validateSignup(v: { name: string; email: string; phone: string; password: string; accepted: boolean }) {
  const e: Record<string, string> = {}
  if (v.name.trim().split(/\s+/).length < 2) e.name = 'Informe nome e sobrenome.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) e.email = 'E-mail inválido.'
  const d = onlyDigits(v.phone)
  if (d.length < 10 || d.length > 13) e.phone = 'WhatsApp com DDD, por exemplo (41) 99999-0000.'
  if (v.password.length < 8) e.password = 'Use pelo menos 8 caracteres.'
  if (!v.accepted) e.accepted = 'É preciso aceitar as regras e a política de privacidade.'
  return e
}

export default function Signup() {
  const backend = useBackend()
  const { session } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const next = safeNext(params.get('voltar'))
  const [v, setV] = useState({ name: '', email: '', phone: '', password: '', accepted: false })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  if (session && !busy && !sent) return <Navigate to={next} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs = validateSignup(v)
    setErrors(errs)
    setError(null)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      const r = await backend.auth.signUp({ email: v.email.trim(), password: v.password, full_name: v.name.trim(), whatsapp: onlyDigits(v.phone) })
      if (r.needsConfirmation) setSent(true)
      else {
        toast({ kind: 'success', title: 'Conta criada!', body: 'Você já pode dar lances.' })
        nav(next, { replace: true })
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (sent)
    return (
      <AuthShell title="Confirme seu e-mail">
        <div className="text-center">
          <Mascot pose="waving" width={132} motion="wave" eager className="mx-auto" />
          <p className="mt-5 flex items-center justify-center gap-2 font-semibold text-accent-text">
            <MailCheck aria-hidden className="size-5" /> Conta criada
          </p>
          <p className="mt-2 text-[17px]">Enviamos um link para <strong>{v.email}</strong>. Abra o e-mail e confirme para ativar sua conta.</p>
          <p className="mt-3 text-[15px] text-muted">Não chegou? Confira o spam ou aguarde alguns minutos.</p>
          <Link to="/entrar" className="mt-6 inline-block font-semibold text-accent-text hover:underline">Ir para o login</Link>
        </div>
      </AuthShell>
    )

  return (
    <AuthShell title="Criar conta" subtitle={<>Já participa? {authLink('/entrar', 'Entrar')}</>}>
      <form onSubmit={submit} noValidate className="space-y-5">
        <Field label="Nome completo" error={errors.name}>
          {(p) => <Input id={p.id} autoComplete="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} invalid={p.invalid} aria-describedby={p.describedBy} />}
        </Field>
        <Field label="E-mail" error={errors.email}>
          {(p) => <Input id={p.id} type="email" inputMode="email" autoComplete="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} invalid={p.invalid} aria-describedby={p.describedBy} />}
        </Field>
        <Field label="WhatsApp" hint="Usado só para combinar pagamento e entrega." error={errors.phone}>
          {(p) => (
            <Input
              id={p.id}
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="(41) 99999-0000"
              value={v.phone}
              onChange={(e) => setV({ ...v, phone: e.target.value })}
              onBlur={() => setV((x) => ({ ...x, phone: formatPhone(x.phone) }))}
              invalid={p.invalid}
              aria-describedby={p.describedBy}
            />
          )}
        </Field>
        <Field label="Senha" hint="Mínimo de 8 caracteres." error={errors.password}>
          {(p) => <Input id={p.id} type="password" autoComplete="new-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} invalid={p.invalid} aria-describedby={p.describedBy} />}
        </Field>
        <div>
          <Checkbox
            checked={v.accepted}
            onChange={(c) => setV({ ...v, accepted: c })}
            label={<>Li e aceito as <Link to="/regras" target="_blank" className="font-semibold text-accent-text underline">regras</Link> e a <Link to="/privacidade" target="_blank" className="font-semibold text-accent-text underline">política de privacidade</Link>.</>}
          />
          {errors.accepted && <p role="alert" className="mt-1.5 text-[13px] font-medium text-danger">{errors.accepted}</p>}
        </div>
        {error && <p role="alert" className="rounded-2xl bg-danger-soft p-3 text-[15px] text-danger">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>Criar conta</Button>
      </form>
    </AuthShell>
  )
}
