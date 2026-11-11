import { Link } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { ACCOUNT_TABS, Page, PageHeader, Tabs } from '@/components/layout/Page'
import { Button, EmptyState, ErrorState, Skeleton } from '@/components/ui'
import { useAuth } from '@/app/providers'
import { NotificationItem } from '@/components/layout/NotificationItem'
import { useQuery } from '@/hooks/useQuery'
import { api } from '@/lib/api'

export default function Notifications() {
  const { session } = useAuth()
  const q = useQuery('notifications', () => api.notifications(200), { live: { topic: 'notifications', id: session?.userId }, poll: 45_000 })
  const items = q.data?.items ?? []
  return (
    <Page>
      <PageHeader
        eyebrow="Minha conta"
        title="Notificações"
        action={(q.data?.unread ?? 0) > 0 ? <Button variant="secondary" icon={<CheckCheck className="size-4" />} onClick={() => void api.markRead().then(q.reload)}>Marcar todas como lidas</Button> : undefined}
      >
        Ajuste quais avisos opcionais receber em <Link to="/conta" className="font-semibold text-accent-text underline">Minha conta</Link>.
      </PageHeader>
      <Tabs label="Seções da conta" items={ACCOUNT_TABS} />
      {q.error && <ErrorState message={q.error} onRetry={q.reload} />}
      {q.loading ? (
        <Skeleton className="h-64" />
      ) : items.length === 0 ? (
        <EmptyState icon={<Bell className="size-6" />} title="Tudo em dia">Avisos sobre lances, vitórias, pagamentos e entregas aparecem aqui.</EmptyState>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
          {items.map((n) => (
            <li key={n.id}>
              <NotificationItem n={n} onRead={q.reload} />
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}
