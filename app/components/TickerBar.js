'use client'
import { useEffect, useState } from 'react'

export default function TickerBar() {
  const [movers, setMovers] = useState([])

  useEffect(() => {
    fetch('/api/movers').then(r => r.json()).then(data => setMovers(data.movers || []))
  }, [])

  const items = movers.length > 0 ? [...movers, ...movers] : []

  return (
    <div style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', position: 'relative', height: '32px', minWidth: 0 }}>
      {items.length > 0 ? (
        <div style={{ display: 'inline-flex', alignItems: 'center', height: '100%', animation: 'tickerScroll 45s linear infinite' }}>
          {items.map((m, i) => (
            <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0 24px', fontSize: '12px', whiteSpace: 'nowrap' }}>
              <span style={{ color: '#aaa', fontWeight: '500' }}>{m.artist_name}</span>
              <span style={{ color: '#fff' }}>{m.price?.toLocaleString()} CR</span>
              <span style={{ color: m.growth >= 0 ? '#4ade80' : '#f87171', fontWeight: '600' }}>
                {m.growth >= 0 ? '▲' : '▼'} {Math.abs(m.growth).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: '12px', color: '#444', lineHeight: '32px', paddingLeft: '24px' }}>Market data updating soon...</div>
      )}
    </div>
  )
}