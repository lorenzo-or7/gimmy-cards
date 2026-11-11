import { useEffect, useState } from 'react'
import { useMotionValue, useReducedMotion, useSpring } from 'motion/react'

/** Smoothed pointer position (-0.5…0.5) for parallax. Inert on touch and reduced motion. */
export function usePointer() {
  const reduce = useReducedMotion()
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, { stiffness: 70, damping: 18 })
  const sy = useSpring(my, { stiffness: 70, damping: 18 })
  useEffect(() => {
    if (reduce || !matchMedia('(pointer: fine)').matches) return
    const on = (e: PointerEvent) => {
      mx.set(e.clientX / innerWidth - 0.5)
      my.set(e.clientY / innerHeight - 0.5)
    }
    window.addEventListener('pointermove', on)
    return () => window.removeEventListener('pointermove', on)
  }, [mx, my, reduce])
  return { sx, sy }
}

/** Width of an element, kept in sync with ResizeObserver. */
export function useWidth<T extends HTMLElement>(ref: React.RefObject<T | null>) {
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(el)
    setW(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [ref])
  return w
}
