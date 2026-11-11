import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth, useBackend, useToast } from '@/app/providers'
import { Button, Field, Input } from '@/components/ui'
import { errorMessage } from '@/lib/errors'
import { AuthShell, DemoAccounts, authLink } from './AuthShell'

export function safeNext(v: string | null) {
  return v && v.startsWith('/') && !v.startsWith('//') ? v : '/conta'
}

export default function Login() {
  const backend = useBackend()
  const { session } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const next = safeNext(params.get('voltar'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (session && !busy) return <Navigate to={next} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.includes('@')) return setError('Informe um e-mail válido.')
    if (!password) return setError('Informe sua senha.')
    setBusy(true)
    try {
      await backend.auth.signIn(email.trim(), password)
      toast({ kind: 'success', title: 'Bem-vindo de volta!' })
      nav(next, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Entrar" subtitle={<>Ainda não tem conta? {authLink(`/cadastro${params.get('voltar') ? `?voltar=${encodeURIComponent(next)}` : ''}`, 'Cadastre-se')}</>}>
      <form onSubmit={submit} noValidate className="space-y-5">
        <Field label="E-mail">
          {(p) => <Input id={p.id} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} invalid={p.invalid} required />}
        </Field>
        <Field label="Senha">
          {(p) => (
            <div className="relative">
              <Input id={p.id} type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-12" required />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-2 text-subtle hover:text-ink">
                {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          )}
        </Field>
        {error && <p role="alert" className="rounded-2xl bg-danger-soft p-3 text-[15px] text-danger">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>Entrar</Button>
        <p className="text-center">
          <Link to="/recuperar-senha" className="text-[15px] font-medium text-muted hover:text-ink">Esqueci minha senha</Link>
        </p>
      </form>
      <DemoAccounts onDone={() => nav(next, { replace: true })} />
    </AuthShell>
  )
}
