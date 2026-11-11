import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import { AuthProvider, BackendProvider, ThemeProvider, ToastProvider, useAuth } from '@/app/providers'
import { BottomNav, DemoBar, SiteFooter, SiteHeader } from '@/components/layout/Chrome'
import { CookieNotice } from '@/components/layout/CookieNotice'
import { Spinner } from '@/components/ui'
import { Splash } from '@/components/layout/Splash'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import Home from '@/pages/public/Home'

const Auctions = lazy(() => import('@/pages/public/Auctions'))
const AuctionDetail = lazy(() => import('@/pages/public/AuctionDetail'))
const LotDetail = lazy(() => import('@/pages/public/LotDetail'))
const Catalog = lazy(() => import('@/pages/public/Catalog'))
const HistoryPage = lazy(() => import('@/pages/public/History'))
const Rules = lazy(() => import('@/pages/public/Rules'))
const Privacy = lazy(() => import('@/pages/public/Privacy'))
const RafflesPage = lazy(() => import('@/pages/public/RafflesPage'))
const Favorites = lazy(() => import('@/pages/account/Favorites'))
const NotFound = lazy(() => import('@/pages/public/NotFound'))
const Login = lazy(() => import('@/pages/auth/Login'))
const Signup = lazy(() => import('@/pages/auth/Signup'))
const Forgot = lazy(() => import('@/pages/auth/Forgot'))
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'))
const Account = lazy(() => import('@/pages/account/Account'))
const MyBids = lazy(() => import('@/pages/account/MyBids'))
const MyWins = lazy(() => import('@/pages/account/MyWins'))
const MyOrders = lazy(() => import('@/pages/account/MyOrders'))
const OrderDetail = lazy(() => import('@/pages/account/OrderDetail'))
const Stored = lazy(() => import('@/pages/account/Stored'))
const Notifications = lazy(() => import('@/pages/account/Notifications'))
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'))
const AdminOverview = lazy(() => import('@/pages/admin/Overview'))
const AdminAuctions = lazy(() => import('@/pages/admin/Auctions'))
const AdminAuctionEdit = lazy(() => import('@/pages/admin/AuctionEdit'))
const AdminCards = lazy(() => import('@/pages/admin/Cards'))
const AdminParticipants = lazy(() => import('@/pages/admin/Participants'))
const AdminBids = lazy(() => import('@/pages/admin/Bids'))
const AdminOrders = lazy(() => import('@/pages/admin/Orders'))
const AdminPayments = lazy(() => import('@/pages/admin/Payments'))
const AdminStorage = lazy(() => import('@/pages/admin/Storage'))
const AdminNotifications = lazy(() => import('@/pages/admin/AdminNotifications'))
const AdminSettings = lazy(() => import('@/pages/admin/Settings'))

function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

function PublicLayout() {
  return (
    <>
      <a href="#conteudo" className="sr-only z-[100] rounded-xl bg-accent px-4 py-2 font-semibold text-accent-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Pular para o conteúdo
      </a>
      <SiteHeader />
      <main id="conteudo" className="min-h-[70dvh]">
        <ErrorBoundary resetKey={useLocation().pathname}>
          <Suspense fallback={<div className="pt-32"><Spinner /></div>}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <SiteFooter />
      <BottomNav />
      <DemoBar />
      <CookieNotice />
    </>
  )
}

export function RequireAuth({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { session, loading, isAdmin, profile } = useAuth()
  const loc = useLocation()
  if (loading || (session && !profile)) return <div className="pt-32"><Spinner /></div>
  if (!session) return <Navigate to={`/entrar?voltar=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  if (admin && !isAdmin) return <Navigate to="/conta" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <BackendProvider fallback={(leaving) => <Splash leaving={leaving} />}>
          <AuthProvider>
            <ToastProvider>
              <BrowserRouter basename={import.meta.env.BASE_URL}>
                <ScrollToTop />
                <Routes>
                  <Route element={<PublicLayout />}>
                    <Route index element={<Home />} />
                    <Route path="leiloes" element={<Auctions scope="live" />} />
                    <Route path="leiloes/proximos" element={<Auctions scope="upcoming" />} />
                    <Route path="leiloes/:id" element={<AuctionDetail />} />
                    <Route path="lote/:id" element={<LotDetail />} />
                    <Route path="catalogo" element={<Catalog />} />
                    <Route path="historico" element={<HistoryPage />} />
                    <Route path="regras" element={<Rules />} />
                    <Route path="privacidade" element={<Privacy />} />
                    <Route path="sorteios" element={<RafflesPage />} />
                    <Route path="entrar" element={<Login />} />
                    <Route path="cadastro" element={<Signup />} />
                    <Route path="recuperar-senha" element={<Forgot />} />
                    <Route path="nova-senha" element={<ResetPassword />} />
                    <Route path="conta" element={<RequireAuth><Account /></RequireAuth>} />
                    <Route path="conta/lances" element={<RequireAuth><MyBids /></RequireAuth>} />
                    <Route path="conta/arremates" element={<RequireAuth><MyWins /></RequireAuth>} />
                    <Route path="conta/pedidos" element={<RequireAuth><MyOrders /></RequireAuth>} />
                    <Route path="conta/pedidos/:id" element={<RequireAuth><OrderDetail /></RequireAuth>} />
                    <Route path="conta/armazenadas" element={<RequireAuth><Stored /></RequireAuth>} />
                    <Route path="conta/favoritos" element={<RequireAuth><Favorites /></RequireAuth>} />
                    <Route path="notificacoes" element={<RequireAuth><Notifications /></RequireAuth>} />
                    <Route path="*" element={<NotFound />} />
                  </Route>
                  <Route
                    path="admin"
                    element={
                      <Suspense fallback={<Spinner />}>
                        <RequireAuth admin>
                          <AdminLayout />
                        </RequireAuth>
                      </Suspense>
                    }
                  >
                    <Route index element={<AdminOverview />} />
                    <Route path="leiloes" element={<AdminAuctions />} />
                    <Route path="leiloes/novo" element={<AdminAuctionEdit />} />
                    <Route path="leiloes/:id" element={<AdminAuctionEdit />} />
                    <Route path="cartas" element={<AdminCards />} />
                    <Route path="participantes" element={<AdminParticipants />} />
                    <Route path="lances" element={<AdminBids />} />
                    <Route path="pedidos" element={<AdminOrders />} />
                    <Route path="pagamentos" element={<AdminPayments />} />
                    <Route path="armazenamento" element={<AdminStorage />} />
                    <Route path="notificacoes" element={<AdminNotifications />} />
                    <Route path="configuracoes" element={<AdminSettings />} />
                  </Route>
                </Routes>
              </BrowserRouter>
            </ToastProvider>
          </AuthProvider>
        </BackendProvider>
      </MotionConfig>
    </ThemeProvider>
  )
}
