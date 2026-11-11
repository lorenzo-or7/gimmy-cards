import { clsx } from 'clsx'
import {
  forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode,
  type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronDown, Loader2, X } from 'lucide-react'
import { splitDuration } from '@/lib/format'
import { useNow } from '@/hooks/useNow'
import { Mascot, type MascotPose } from '@/components/brand/Mascot'

export { clsx as cx }

// ---------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold' | 'outline'
type Size = 'sm' | 'md' | 'lg'

const base =
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[transform,background-color,color,box-shadow,border-color] duration-200 ease-[cubic-bezier(.2,.8,.2,1)] active:scale-[.97] disabled:pointer-events-none disabled:opacity-50'
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-strong shadow-[inset_0_1px_0_rgb(255_255_255/.35),0_1px_2px_rgb(0_0_0/.25)]',
  secondary: 'bg-surface-2 text-ink hover:bg-surface-3 border border-line',
  outline: 'border border-line-strong text-ink hover:border-accent hover:text-accent-text bg-transparent',
  ghost: 'text-muted hover:text-ink hover:bg-surface-2',
  danger: 'bg-danger-soft text-danger border border-danger/30 hover:bg-danger hover:text-white',
  gold: 'bg-gold text-[#2b1d00] hover:brightness-105 shadow-[inset_0_1px_0_rgb(255_255_255/.4),0_1px_2px_rgb(0_0_0/.25)]',
}
const sizes: Record<Size, string> = {
  sm: 'h-9 rounded-[10px] px-3.5 text-sm',
  md: 'h-11 rounded-xl px-5 text-[15px]',
  lg: 'h-[52px] rounded-[14px] px-6 text-base',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={clsx(base, variants[variant], sizes[size], className)} {...rest}>
      {loading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  )
})

export function ButtonLink({ variant = 'primary', size = 'md', className, icon, children, ...rest }: LinkProps & { variant?: Variant; size?: Size; icon?: ReactNode }) {
  return (
    <Link className={clsx(base, variants[variant], sizes[size], className)} {...rest}>
      {icon}
      {children}
    </Link>
  )
}

// ---------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------
const fieldBase =
  'w-full rounded-2xl border border-line-strong bg-surface px-4 text-[15px] text-ink placeholder:text-subtle transition-[border-color,box-shadow] duration-200 hover:border-accent/50 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/20 disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20'

interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  children: (p: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
  className?: string
  optional?: boolean
}
export function Field({ label, hint, error, children, className, optional }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errId = error ? `${id}-err` : undefined
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label} {optional && <span className="font-normal text-subtle">(opcional)</span>}
      </label>
      {children({ id, describedBy: [hintId, errId].filter(Boolean).join(' ') || undefined, invalid: !!error })}
      {hint && !error && (
        <p id={hintId} className="text-[13px] text-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input(
  { className, invalid, ...rest },
  ref,
) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={clsx(fieldBase, 'h-12', className)} {...rest} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, ...rest }, ref) {
    return <textarea ref={ref} aria-invalid={invalid || undefined} className={clsx(fieldBase, 'min-h-28 py-3 leading-relaxed', className)} {...rest} />
  },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(function Select(
  { className, invalid, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} aria-invalid={invalid || undefined} className={clsx(fieldBase, 'h-12 appearance-none pr-11', className)} {...rest}>
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-subtle" />
    </div>
  )
})

export function Checkbox({ label, description, checked, onChange, disabled }: { label: ReactNode; description?: ReactNode; checked: boolean; onChange(v: boolean): void; disabled?: boolean }) {
  const id = useId()
  return (
    <label htmlFor={id} className={clsx('group flex cursor-pointer items-start gap-3', disabled && 'opacity-60')}>
      <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer size-5 cursor-pointer appearance-none rounded-md border-2 border-line-strong bg-surface transition-colors checked:border-accent checked:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
        <svg aria-hidden viewBox="0 0 16 16" className="pointer-events-none absolute size-3.5 text-accent-ink opacity-0 transition-opacity peer-checked:opacity-100">
          <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span>
        <span className="block text-[15px] leading-snug">{label}</span>
        {description && <span className="block text-sm text-subtle">{description}</span>}
      </span>
    </label>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange(v: boolean): void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx('relative h-7 w-12 shrink-0 rounded-full border transition-colors', checked ? 'border-accent bg-accent' : 'border-line-strong bg-surface-3')}
    >
      <span className={clsx('absolute top-0.5 left-0.5 size-5.5 rounded-full bg-white shadow transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]', checked && 'translate-x-5')} />
    </button>
  )
}

/** Accessible chip radio group (used for language, condition, filters). */
export function ChipGroup<T extends string>({
  label, options, value, onChange, name, size = 'md', allowEmpty,
}: {
  label: string
  name?: string
  options: { value: NoInfer<T>; label: ReactNode; title?: string }[]
  value: T | null
  onChange(v: NoInfer<T> | null): void
  size?: 'sm' | 'md'
  allowEmpty?: boolean
}) {
  const gid = useId()
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value === o.value
          return (
            <label
              key={o.value}
              title={o.title}
              className={clsx(
                'relative inline-flex cursor-pointer items-center gap-1.5 rounded-xl border font-medium transition-[background-color,border-color,color] duration-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
                size === 'sm' ? 'h-9 px-3 text-sm' : 'h-11 px-4 text-[15px]',
                on ? 'border-accent bg-accent-soft text-accent-text' : 'border-line-strong bg-surface text-muted hover:border-accent/50 hover:text-ink',
              )}
            >
              <input
                type="radio"
                name={name ?? gid}
                value={o.value}
                checked={on}
                onChange={() => onChange(o.value)}
                onClick={() => allowEmpty && on && onChange(null)}
                className="sr-only"
              />
              {o.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

// ---------------------------------------------------------------------
// Modal (native <dialog>: focus trap, Esc, inert background for free)
// ---------------------------------------------------------------------
export function Modal({
  open, onClose, title, description, children, footer, size = 'md', dismissable = true,
}: {
  open: boolean
  onClose(): void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  dismissable?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        if (dismissable) onClose()
      }}
      onClick={(e) => {
        if (dismissable && e.target === ref.current) onClose()
      }}
      className={clsx(
        'm-auto max-h-[min(92dvh,900px)] w-[calc(100%-1.5rem)] overflow-visible bg-transparent p-0 text-ink backdrop:bg-scrim backdrop:backdrop-blur-sm open:animate-[dialog-in_.28s_cubic-bezier(.2,.8,.2,1)]',
        { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size],
      )}
    >
      {open && (
        <div className="flex max-h-[min(92dvh,900px)] flex-col overflow-hidden rounded-[1.75rem] border border-line-strong bg-bg-elevated shadow-pop">
          <div className="flex items-start gap-4 px-6 pt-6 pb-4">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-xl font-bold">
                {title}
              </h2>
              {description && <div className="mt-1 text-[15px] text-muted">{description}</div>}
            </div>
            {dismissable && (
              <button type="button" onClick={onClose} aria-label="Fechar" className="-mt-1 -mr-2 rounded-full p-2 text-subtle hover:bg-surface-2 hover:text-ink">
                <X className="size-5" />
              </button>
            )}
          </div>
          {children && <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2">{children}</div>}
          {footer && <div className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-end">{footer}</div>}
        </div>
      )}
      <style>{`@keyframes dialog-in{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}`}</style>
    </dialog>
  )
}

/** Confirm dialog for destructive / irreversible actions. */
export function ConfirmDialog({
  open, onClose, onConfirm, title, description, confirmLabel = 'Confirmar', tone = 'primary', loading, requireReason, reasonLabel = 'Motivo',
}: {
  open: boolean
  onClose(): void
  onConfirm(reason: string): void
  title: ReactNode
  description?: ReactNode
  confirmLabel?: string
  tone?: 'primary' | 'danger' | 'gold'
  loading?: boolean
  requireReason?: boolean
  reasonLabel?: string
}) {
  const [reason, setReason] = useState('')
  useEffect(() => {
    if (open) setReason('')
  }, [open])
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Voltar
          </Button>
          <Button variant={tone} loading={loading} disabled={requireReason && reason.trim().length < 3} onClick={() => onConfirm(reason.trim())}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {requireReason && (
        <Field label={reasonLabel} className="pb-4">
          {(p) => <Textarea id={p.id} value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-20" autoFocus />}
        </Field>
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------------
// Tooltip (hover + focus)
// ---------------------------------------------------------------------
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.span
            id={id}
            role="tooltip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-60 -translate-x-1/2 rounded-xl bg-ink px-3 py-1.5 text-center text-[13px] font-medium text-bg shadow-pop"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}

// ---------------------------------------------------------------------
// Small display pieces
// ---------------------------------------------------------------------
type Tone = 'accent' | 'mint' | 'gold' | 'danger' | 'neutral' | 'success' | 'warning'
const tones: Record<Tone, string> = {
  accent: 'bg-accent-soft text-accent-text border-accent/25',
  mint: 'bg-mint-soft text-ink border-mint/30',
  gold: 'bg-gold-soft text-gold-text border-gold/30',
  danger: 'bg-danger-soft text-danger border-danger/25',
  warning: 'bg-warning-soft text-warning border-warning/30',
  success: 'bg-success-soft text-success border-success/25',
  neutral: 'bg-surface-2 text-muted border-line',
}
export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={clsx('inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[13px] font-medium whitespace-nowrap', tones[tone], className)}>
      {dot && <span aria-hidden className="live-dot size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx('skeleton rounded-2xl', className)} />
}

export function Spinner({ label = 'Carregando' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-10 text-muted">
      <Loader2 aria-hidden className="size-5 animate-spin" />
      <span>{label}…</span>
    </div>
  )
}

/**
 * "Ao vivo" indicator — red is reserved for this state only. Always carries
 * text (never colour alone). Callers must only render it for auctions that
 * are actually live.
 */
export function LiveBadge({ className, size = 'md', label = 'Ao vivo' }: { className?: string; size?: 'sm' | 'md'; label?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full bg-live font-bold tracking-[0.06em] text-white uppercase shadow-[0_0_0_1px_rgb(255_255_255/.08)_inset]',
        size === 'sm' ? 'h-6 px-2 text-[11px]' : 'h-7 px-2.5 text-[12px]',
        className,
      )}
    >
      <span aria-hidden className="relative grid size-2 place-items-center">
        <span className="live-ring absolute inset-0 rounded-full bg-white" />
        <span className="relative size-2 rounded-full bg-white" />
      </span>
      {label}
    </span>
  )
}

/**
 * Empty lists use the sleeping mascot ("nothing yet"); pass `mascot="confused"`
 * for "no results / not found", or `false` to show the icon instead.
 */
export function EmptyState({ icon, title, children, action, mascot = 'sleeping' }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; mascot?: MascotPose | false }) {
  return (
    <div className="flex flex-col items-center rounded-[1.75rem] border border-dashed border-line-strong px-6 py-12 text-center">
      {mascot ? (
        <Mascot pose={mascot} width={112} motion="rise" className="mb-4" />
      ) : (
        icon && <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent-text">{icon}</div>
      )}
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="mt-1.5 max-w-md text-[15px] text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-4 rounded-2xl border border-danger/30 bg-danger-soft p-5">
      <Mascot pose="sad" width={56} className="hidden sm:block" />
      <div className="min-w-0">
        <p className="font-semibold text-danger">Não foi possível carregar.</p>
        <p className="mt-1 text-sm text-muted">{message}</p>
        {onRetry && (
          <Button size="sm" variant="secondary" className="mt-3" onClick={onRetry}>
            Tentar de novo
          </Button>
        )}
      </div>
    </div>
  )
}

export function SectionTitle({ eyebrow, title, children, action, as: As = 'h2' }: { eyebrow?: string; title: ReactNode; children?: ReactNode; action?: ReactNode; as?: 'h1' | 'h2' }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <p className="mb-2 text-sm font-semibold tracking-[0.14em] text-accent-text uppercase">{eyebrow}</p>}
        <As className={As === 'h1' ? 'text-4xl leading-[1.05] sm:text-5xl' : 'text-3xl leading-tight sm:text-4xl'}>{title}</As>
        {children && <div className="mt-3 text-[17px] text-muted">{children}</div>}
      </div>
      {action}
    </div>
  )
}

// ---------------------------------------------------------------------
// Countdown — tabular digits, urgency tone in the last hour
// ---------------------------------------------------------------------
export function Countdown({ to, compact, onEnd, label = 'Encerra em' }: { to: string; compact?: boolean; onEnd?: () => void; label?: string }) {
  const now = useNow()
  const ms = new Date(to).getTime() - now
  const fired = useRef(false)
  useEffect(() => {
    if (ms <= 0 && !fired.current) {
      fired.current = true
      onEnd?.()
    }
  }, [ms, onEnd])
  const { d, h, m, s } = splitDuration(ms)
  const urgent = ms > 0 && ms < 3600_000
  const p = (n: number) => String(n).padStart(2, '0')
  if (ms <= 0) return <span className="font-semibold text-muted">Encerrado</span>
  if (compact)
    return (
      <span className={clsx('tabular font-semibold', urgent ? 'text-danger' : 'text-ink')} aria-label={`${label} ${d ? d + ' dias, ' : ''}${h} horas e ${m} minutos`}>
        {d > 0 && `${d}d `}
        {p(h)}:{p(m)}:{p(s)}
      </span>
    )
  const units = [
    ...(d > 0 ? [{ v: d, l: d === 1 ? 'dia' : 'dias' }] : []),
    { v: h, l: 'h' },
    { v: m, l: 'min' },
    { v: s, l: 's' },
  ]
  return (
    <div role="timer" aria-live="off" aria-label={`${label} ${d ? d + ' dias, ' : ''}${h} horas, ${m} minutos`} className="flex items-end gap-1.5">
      {units.map((u, i) => (
        <div key={i} className="flex items-baseline gap-0.5">
          <span className={clsx('tabular text-3xl leading-none font-bold sm:text-4xl', urgent ? 'text-danger' : 'text-ink')}>{u.l === 'dia' || u.l === 'dias' ? u.v : p(u.v)}</span>
          <span className="text-sm font-medium text-subtle">{u.l}</span>
        </div>
      ))}
    </div>
  )
}

/** Animated number that rolls when the value changes. */
export function RollingPrice({ value, className }: { value: string; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <span className={clsx('relative inline-flex overflow-hidden tabular', className)} aria-live="polite">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={reduce ? false : { y: '70%', opacity: 0, filter: 'blur(4px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          exit={reduce ? undefined : { y: '-70%', opacity: 0, filter: 'blur(4px)' }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="inline-block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'danger' | 'accent' }) {
  return (
    <div>
      <p className="text-sm text-subtle">{label}</p>
      <p className={clsx('tabular mt-1 text-2xl font-bold', tone === 'danger' && 'text-danger', tone === 'accent' && 'text-accent-text')}>{value}</p>
      {hint && <p className="mt-0.5 text-[13px] text-subtle">{hint}</p>}
    </div>
  )
}
