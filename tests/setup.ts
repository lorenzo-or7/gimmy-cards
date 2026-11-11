import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

// globals are off, so Testing Library cannot register its own auto-cleanup
afterEach(async () => {
  if (typeof document !== 'undefined') {
    const { cleanup } = await import('@testing-library/react')
    cleanup()
  }
})
