import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useBackend, useToast } from '@/app/providers'
import { Button, Field, Input } from '@/components/ui'
import { errorMessage } from '@/lib/errors'
import { AuthShell, authLink } from './AuthShell'

/** Reached from the recovery e-mail (Supabase signs the user in via the link). */
export default function ResetPassword() {
  const backend = useBackend()
  const { session, loading } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (pw.length < 8) return setError('Use pelo menos 8 caracteres.')
    if (pw !== pw2) return setError('As senhas não conferem.')
    setBusy(true)
    setError(null)
    try {
      await backend.auth.updatePassword(pw)
      toast({ kind: 'success', title: 'Senha atualizada' })
      nav('/conta', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  if (!loading && !session)
    return (
      <AuthShell title="Link expirado" footer={authLink('/recuperar-senha', 'Pedir um novo link')}>
        <p className="text-[15px] text-muted">Abra o link mais recente enviado ao seu e-mail. Links de recuperação valem por pouco tempo.</p>
      </AuthShell>
    )
  return (
    <AuthShell title="Nova senha">
      <form onSubmit={submit} noValidate className="space-y-5">
        <Field label="Nova senha" hint="Mínimo de 8 caracteres.">
          {(p) => <Input id={p.id} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} aria-describedby={p.describedBy} />}
        </Field>
        <Field label="Repita a senha" error={error}>
          {(p) => <Input id={p.id} type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} invalid={p.invalid} aria-describedby={p.describedBy} />}
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Salvar senha</Button>
      </form>
    </AuthShell>
  )
}
