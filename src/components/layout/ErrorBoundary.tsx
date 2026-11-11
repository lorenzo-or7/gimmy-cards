import { Component, type ReactNode } from 'react'
import { Mascot } from '@/components/brand/Mascot'

/** Keeps a render failure in one page from blanking the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }
  componentDidCatch(error: Error) {
    console.error('[gimmy] erro de interface', error)
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="mx-auto max-w-xl px-5 pt-32 pb-20 text-center">
        <Mascot pose="sad" width={150} motion="rise" eager className="mx-auto mb-6" />
        <p className="text-2xl font-bold">Algo saiu do lugar nesta página.</p>
        <p className="mt-2 text-muted">Seus dados estão seguros. Tente recarregar; se continuar, avise a equipe.</p>
        <button type="button" onClick={() => location.reload()} className="mt-6 h-11 rounded-2xl bg-accent px-5 font-semibold text-accent-ink">
          Recarregar
        </button>
      </div>
    )
  }
}
