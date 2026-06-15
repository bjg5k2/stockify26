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

export function MarketFooter() {
  const [utcTime, setUtcTime] = useState('')
  const [countdown, setCountdown] = useState('')

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const h = String(now.getUTCHours()).padStart(2, '0')
      const m = String(now.getUTCMinutes()).padStart(2, '0')
      const s = String(now.getUTCSeconds()).padStart(2, '0')
      setUtcTime(`${h}:${m}:${s} UTC`)

      const etFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      })
      const parts = etFormatter.formatToParts(now)
      const eh = parseInt(parts.find(p => p.type === 'hour').value)
      const em = parseInt(parts.find(p => p.type === 'minute').value)
      const es = parseInt(parts.find(p => p.type === 'second').value)
      const secondsNow = eh * 3600 + em * 60 + es
      const targetSeconds = 9 * 3600
      let diff = targetSeconds - secondsNow
      if (diff <= 0) diff += 24 * 3600
      const ch = String(Math.floor(diff / 3600)).padStart(2, '0')
      const cm = String(Math.floor((diff % 3600) / 60)).padStart(2, '0')
      const cs = String(diff % 60).padStart(2, '0')
      setCountdown(`${ch}:${cm}:${cs}`)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <footer style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, borderTop: '0.5px solid #1a1a1a', padding: '14px 48px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px', fontSize: '12px', color: '#666', background: '#0a0a0a', flexShrink: 0 }}>
      <span>{utcTime}</span>
      <span style={{ color: '#333' }}>·</span>
      <span>Next market update in <span style={{ color: '#4ade80', fontWeight: '600' }}>{countdown}</span></span>
    </footer>
  )
}