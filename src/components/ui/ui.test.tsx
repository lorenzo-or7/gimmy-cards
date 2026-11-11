import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { ChipGroup, Countdown, Field, Input, Switch } from './index'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'

describe('ChipGroup', () => {
  function Harness() {
    const [v, setV] = useState<'BR' | 'JAP' | null>(null)
    return <ChipGroup label="Idioma" allowEmpty value={v} onChange={setV} options={[{ value: 'BR', label: 'BR' }, { value: 'JAP', label: 'JAP' }]} />
  }
  it('is an accessible radio group with a legend', () => {
    render(<Harness />)
    expect(screen.getByRole('group', { name: 'Idioma' })).toBeInTheDocument()
    const br = screen.getByRole('radio', { name: 'BR' })
    fireEvent.click(br)
    expect(br).toBeChecked()
    fireEvent.click(screen.getByRole('radio', { name: 'JAP' }))
    expect(screen.getByRole('radio', { name: 'JAP' })).toBeChecked()
    expect(br).not.toBeChecked()
  })
})

describe('Field', () => {
  it('links label, hint and error to the input', () => {
    render(<Field label="E-mail" hint="Seu melhor e-mail" error="E-mail inválido.">{(p) => <Input id={p.id} invalid={p.invalid} aria-describedby={p.describedBy} />}</Field>)
    const input = screen.getByLabelText('E-mail')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('E-mail inválido.')
    expect(screen.getByRole('alert')).toHaveTextContent('E-mail inválido.')
  })
})

describe('Switch', () => {
  it('exposes switch role and toggles', () => {
    const fn = vi.fn()
    render(<Switch label="Avisos" checked={false} onChange={fn} />)
    fireEvent.click(screen.getByRole('switch', { name: 'Avisos' }))
    expect(fn).toHaveBeenCalledWith(true)
  })
})

describe('Countdown', () => {
  it('shows "Encerrado" once the deadline has passed', () => {
    render(<Countdown to={new Date(Date.now() - 1000).toISOString()} />)
    expect(screen.getByText('Encerrado')).toBeInTheDocument()
  })
  it('renders a timer before the deadline', () => {
    render(<Countdown to={new Date(Date.now() + 3 * 3600_000).toISOString()} />)
    expect(screen.getByRole('timer')).toBeInTheDocument()
  })
})

describe('ErrorBoundary', () => {
  it('shows a recovery message instead of a blank screen', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const Boom = () => {
      throw new Error('boom')
    }
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByRole('alert')).toHaveTextContent('Algo saiu do lugar')
    spy.mockRestore()
  })
})
