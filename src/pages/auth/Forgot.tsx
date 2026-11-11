import { useState, type FormEvent } from 'react'
import { useBackend } from '@/app/providers'
import { Button, Field, Input } from '@/components/ui'
import { errorMessage } from '@/lib/errors'
import { AuthShell, authLink } from './AuthShell'

export default function Forgot() {
  const backend = useBackend()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) return setError('Informe um e-mail válido.')
    setBusy(true)
    setError(null)
    try {
      await backend.auth.resetPassword(email.trim())
      setDone(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <AuthShell title="Recuperar senha" subtitle="Enviamos um link para você criar uma nova senha." footer={<>Lembrou? {authLink('/entrar', 'Voltar ao login')}</>}>
      {done ? (
        <p role="status" className="rounded-2xl bg-success-soft p-4 text-[15px]">
          Se existir uma conta com <strong>{email}</strong>, o link chega em alguns minutos. Confira também o spam.
          {backend.mode === 'demo' && <span className="mt-2 block text-gold-text">Modo demonstração: nenhum e-mail é enviado.</span>}
        </p>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5">
          <Field label="E-mail da conta" error={error}>
            {(p) => <Input id={p.id} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} invalid={p.invalid} aria-describedby={p.describedBy} />}
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>Enviar link</Button>
        </form>
      )}
    </AuthShell>
  )
}
