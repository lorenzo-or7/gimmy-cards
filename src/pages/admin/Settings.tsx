import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Field, Input, Textarea } from '@/components/ui'
import { useAuth, useBackend, useSettings, useToast } from '@/app/providers'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { AdminHeader, Panel } from './AdminLayout'

export default function Settings() {
  const s = useSettings()
  const { isSuperAdmin } = useAuth()
  const backend = useBackend()
  const toast = useToast()
  const [pix, setPix] = useState('')
  const [card, setCard] = useState('')
  const [pickup, setPickup] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (s) {
      setPix(s.pix_key)
      setCard(s.card_link)
      setPickup(s.pickup_info)
    }
  }, [s])
  return (
    <>
      <AdminHeader title="Configurações" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Pagamento e retirada">
          <div className="space-y-5">
            <Field label="Chave PIX (e-mail)">{(p) => <Input id={p.id} value={pix} onChange={(e) => setPix(e.target.value)} disabled={!isSuperAdmin} />}</Field>
            <Field label="Link de pagamento por cartão">{(p) => <Input id={p.id} type="url" value={card} onChange={(e) => setCard(e.target.value)} disabled={!isSuperAdmin} />}</Field>
            <Field label="Informações de retirada">{(p) => <Textarea id={p.id} value={pickup} onChange={(e) => setPickup(e.target.value)} disabled={!isSuperAdmin} className="min-h-20" />}</Field>
            {isSuperAdmin ? (
              <Button
                loading={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await api.admin.saveSettings(pix.trim(), card.trim(), pickup.trim())
                    toast({ kind: 'success', title: 'Configurações salvas', body: 'Recarregue a página para ver em todo o site.' })
                  } catch (e) {
                    toast({ kind: 'error', title: 'Não foi possível salvar', body: errorMessage(e) })
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                Salvar
              </Button>
            ) : (
              <p className="text-[14px] text-subtle">Somente o administrador principal altera estes dados.</p>
            )}
          </div>
        </Panel>
        <Panel title="Regras do sistema">
          <ul className="space-y-2.5 text-[15px] text-muted">
            <li>• Leilões oficiais: terça e quinta, 19h, 24 horas (America/Sao_Paulo).</li>
            <li>• Sem prorrogação. Lances após o encerramento são recusados pelo servidor.</li>
            <li>• Desempate: maior valor, depois ordem de registro no servidor.</li>
            <li>• Prazo de pagamento padrão: segunda seguinte ao encerramento, 18h.</li>
            <li>• Oferta por inadimplência: 24 horas para aceitar; uma oferta ativa por lote.</li>
            <li>• Limite: 20 lances por minuto por participante.</li>
          </ul>
          <p className="mt-4 text-[14px] text-subtle">Permissões de administradores ficam em <Link to="/admin/participantes" className="font-semibold text-accent-text">Participantes</Link>.</p>
          <p className="mt-4 rounded-2xl bg-surface-2 p-3 text-[14px]">
            Ambiente: <strong>{backend.mode === 'demo' ? 'Demonstração local (PGlite)' : 'Supabase'}</strong>
          </p>
        </Panel>
      </div>
    </>
  )
}
