'use client'
import { useEffect, useRef, useState } from 'react'

export function EQVisualizer({ size = 18, color = '#4ade80', bars = 4 }) {
  const durations = [0.7, 0.9, 0.6, 1.0, 0.8]
  const delays = [0, 0.15, 0.3, 0.05, 0.2]
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: size, width: size * 0.8 }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div key={i} style={{
          flex: 1,
          height: '100%',
          background: color,
          borderRadius: '1px',
          transformOrigin: 'bottom',
          animation: `eqBounce ${durations[i % durations.length]}s ease-in-out infinite`,
          animationDelay: `${delays[i % delays.length]}s`,
        }} />
      ))}
    </div>
  )
}

export function LiveDot({ color = '#4ade80', size = 8 }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', background: color, animation: 'pulseGlow 2s ease-in-out infinite', flexShrink: 0 }} />
}

export function AnimatedNumber({ value, duration = 800, decimals = 0 }) {
  const [display, setDisplay] = useState(0)
  const prevValue = useRef(0)
  const raf = useRef(null)

  useEffect(() => {
    const start = prevValue.current
    const end = value || 0
    const startTime = performance.now()

    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(start + (end - start) * eased)
      if (progress < 1) {
        raf.current = requestAnimationFrame(tick)
      } else {
        prevValue.current = end
      }
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value])

  return <>{display.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}</>
}

export function Skeleton({ width = '100%', height = '20px', borderRadius = '8px' }) {
  return <div className="skeleton-shimmer" style={{ width, height, borderRadius }} />
}

export function useFlash(value) {
  const [flashClass, setFlashClass] = useState('')
  const prevValue = useRef(value)

  useEffect(() => {
    if (prevValue.current !== value && prevValue.current !== undefined) {
      if (value > prevValue.current) setFlashClass('flash-green')
      else if (value < prevValue.current) setFlashClass('flash-red')
      const timer = setTimeout(() => setFlashClass(''), 600)
      prevValue.current = value
      return () => clearTimeout(timer)
    }
    prevValue.current = value
  }, [value])

  return flashClass
}