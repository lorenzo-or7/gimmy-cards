import { useEffect, useState } from 'react'
import { MessageCircle, Search } from 'lucide-react'
import { Badge, ConfirmDialog, ErrorState, Input, Select, Skeleton } from '@/components/ui'
import { useAuth, useToast } from '@/app/providers'
import { useQuery } from '@/hooks/useQuery'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { dateOnly, formatPhone, whatsappLink } from '@/lib/format'
import type { Participant, Role } from '@/lib/types'
import { AdminHeader, Pager, usePaged } from './AdminLayout'

const ROLE_LABEL: Record<Role, string> = { participant: 'Participante', admin: 'Administrador', super_admin: 'Admin principal' }

export default function Participants() {
  const { isSuperAdmin, profile } = useAuth()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [deb, setDeb] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDeb(search), 300)
    return () => clearTimeout(t)
  }, [search])
  const q = useQuery(`admin:people:${deb}`, () => api.admin.participants(deb))
  const [change, setChange] = useState<{ p: Participant; role: Role } | null>(null)
  const [busy, setBusy] = useState(false)
  const paged = usePaged(q.data ?? [], 25)
  return (
    <>
      <AdminHeader title="Participantes">{isSuperAdmin ? 'Você pode alterar permissões administrativas.' : 'Somente o administrador principal altera permissões.'}</AdminHeader>
      <div className="relative mb-6 max-w-md">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-subtle" />
        <label htmlFor="ppl-search" className="sr-only">Buscar participante</label>
        <Input id="ppl-search" type="search" placeholder="Nome, e-mail ou WhatsApp" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-12" />
      </div>
      {q.error && <ErrorState message={q.error} onRetry={q.reload} />}
      {q.loading ? <Skeleton className="h-80" /> : (
        <div className="bg-surface/85 overflow-x-auto rounded-[1.75rem] border border-line-strong">
          <table className="w-full min-w-[860px] text-left text-[15px]">
            <caption className="sr-only">Participantes</caption>
            <thead className="bg-surface-2/60 text-[13px] text-subtle">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Nome</th>
                <th scope="col" className="px-5 py-3 font-medium">Contato</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Lances</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Vitórias</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Em aberto</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Guardadas</th>
                <th scope="col" className="px-5 py-3 font-medium">Permissão</th>
              </tr>
            </thead>
            <tbody>
              {paged.slice.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="px-5 py-3.5">
                    <p className="font-semibold">{p.full_name}</p>
                    <p className="text-[13px] text-subtle">desde {dateOnly(p.created_at)}{p.defaults > 0 && <Badge tone="danger" className="ml-2 h-6">{p.defaults} inadimpl.</Badge>}</p>
                  </td>
                  <td className="px-5 py-3.5 text-[14px]">
                    <p className="text-muted">{p.email}</p>
                    {p.whatsapp && <a href={whatsappLink(p.whatsapp, `Oi, ${p.full_name.split(' ')[0]}! Aqui é da Gimmy Cards.`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent-text hover:underline"><MessageCircle className="size-3.5" /> {formatPhone(p.whatsapp)}</a>}
                  </td>
                  <td className="tabular px-5 py-3.5 text-right">{p.bid_count}</td>
                  <td className="tabular px-5 py-3.5 text-right">{p.wins}</td>
                  <td className="tabular px-5 py-3.5 text-right">{p.orders_open}</td>
                  <td className="tabular px-5 py-3.5 text-right">{p.stored}</td>
                  <td className="px-5 py-3.5">
                    {isSuperAdmin && p.id !== profile?.id ? (
                      <Select aria-label={`Permissão de ${p.full_name}`} value={p.role} onChange={(e) => setChange({ p, role: e.target.value as Role })} className="h-10 min-w-44 text-[14px]">
                        {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </Select>
                    ) : (
                      <Badge tone={p.role === 'participant' ? 'neutral' : 'accent'}>{ROLE_LABEL[p.role]}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager {...paged} />
        </div>
      )}
      <ConfirmDialog
        open={!!change}
        onClose={() => setChange(null)}
        loading={busy}
        title="Alterar permissão?"
        description={change && `${change.p.full_name}: ${ROLE_LABEL[change.p.role]} → ${ROLE_LABEL[change.role]}. A alteração fica registrada na auditoria.`}
        onConfirm={async () => {
          setBusy(true)
          try {
            await api.admin.setRole(change!.p.id, change!.role)
            toast({ kind: 'success', title: 'Permissão atualizada' })
            setChange(null)
            void q.reload()
          } catch (e) {
            toast({ kind: 'error', title: 'Não foi possível alterar', body: errorMessage(e) })
          } finally {
            setBusy(false)
          }
        }}
      />
    </>
  )
}
