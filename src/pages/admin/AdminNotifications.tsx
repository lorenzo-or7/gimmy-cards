import { Link } from 'react-router-dom'
import { Button, cx, ErrorState, Skeleton } from '@/components/ui'
import { useAuth } from '@/app/providers'
import { useQuery } from '@/hooks/useQuery'
import { api } from '@/lib/api'
import { dateTime, relative } from '@/lib/format'
import { AdminHeader, Panel } from './AdminLayout'

const ACTIONS: Record<string, string> = {
  insert: 'Criou', update: 'Editou', delete: 'Excluiu', buy_now: 'Arremate imediato', payment_approved: 'Pagamento confirmado',
  payment_rejected: 'Comprovante recusado', order_due_changed: 'Prazo alterado', order_defaulted: 'Inadimplência registrada',
  transfer_offered: 'Oferta a próximo colocado', transfer_accepted: 'Oferta aceita', transfer_declined: 'Oferta recusada',
  transfer_cancelled: 'Oferta cancelada', auction_published: 'Leilão publicado', auction_unpublished: 'Leilão despublicado',
  auction_cancelled: 'Leilão cancelado', lot_cancelled: 'Lote cancelado', lot_ended_early: 'Lote encerrado antes', role_changed: 'Permissão alterada',
  settings_changed: 'Configurações alteradas',
}
const ENTITY: Record<string, string> = { cards: 'carta', auctions: 'leilão', lots: 'lote', orders: 'pedido', default_transfers: 'transferência', profiles: 'perfil', app_settings: 'configurações' }

export default function AdminNotifications() {
  const { session } = useAuth()
  const n = useQuery('admin:my-notifications', () => api.notifications(100), { live: { topic: 'notifications', id: session?.userId } })
  const audit = useQuery('admin:audit', () => api.admin.audit(150))
  return (
    <>
      <AdminHeader title="Notificações e auditoria">Alertas operacionais (comprovantes, atrasos, ofertas) e o registro de todas as ações administrativas.</AdminHeader>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Alertas" action={(n.data?.unread ?? 0) > 0 && <Button size="sm" variant="ghost" onClick={() => void api.markRead().then(n.reload)}>Marcar como lidas</Button>}>
          {n.error && <ErrorState message={n.error} />}
          {n.loading ? <Skeleton className="h-64" /> : (
            <ul className="max-h-[70dvh] divide-y divide-line overflow-y-auto">
              {(n.data?.items ?? []).length === 0 && <li className="py-6 text-center text-muted">Nenhum alerta.</li>}
              {(n.data?.items ?? []).map((x) => (
                <li key={x.id}>
                  <Link to={x.link || '#'} onClick={() => !x.read_at && void api.markRead([x.id]).then(n.reload)} className="flex gap-3 py-3">
                    <span aria-hidden className={cx('mt-2 size-2 shrink-0 rounded-full', x.read_at ? 'bg-line-strong' : 'bg-accent')} />
                    <span className="min-w-0 flex-1"><span className="block font-medium">{x.title}</span><span className="block text-[14px] text-muted">{x.body}</span></span>
                    <span className="shrink-0 text-[12px] text-subtle">{relative(x.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Auditoria">
          {audit.error && <ErrorState message={audit.error} />}
          {audit.loading ? <Skeleton className="h-64" /> : (
            <ol className="max-h-[70dvh] space-y-3 overflow-y-auto">
              {(audit.data ?? []).map((a) => (
                <li key={a.id} className="rounded-2xl border border-line p-3 text-[14px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{ACTIONS[a.action] ?? a.action} {ENTITY[a.entity] && <span className="font-normal text-subtle">· {ENTITY[a.entity]}</span>}</span>
                    <time className="tabular text-[12px] text-subtle" dateTime={a.created_at}>{dateTime(a.created_at)}</time>
                  </div>
                  <p className="text-subtle">por {a.actor ?? 'sistema'}{typeof a.data.reason === 'string' && a.data.reason ? ` · motivo: ${a.data.reason}` : ''}{typeof a.data.title === 'string' ? ` · ${a.data.title}` : ''}</p>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </>
  )
}
