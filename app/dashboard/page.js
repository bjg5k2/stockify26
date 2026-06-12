'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

function PerformanceChart({ totalValue, startValue }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    const start = startValue || 1000
    const end = totalValue || 1000
    const points = 9
    const data = Array.from({ length: points }, (_, i) => {
      const progress = i / (points - 1)
      const noise = (Math.random() - 0.4) * Math.abs(end - start) * 0.15
      return start + (end - start) * progress + (i > 0 && i < points - 1 ? noise : 0)
    })
    data[0] = start
    data[points - 1] = end

    const min = Math.min(...data) * 0.95
    const max = Math.max(...data) * 1.05
    const pts = data.map((v, i) => ({
      x: (i / (data.length - 1)) * W,
      y: H - ((v - min) / (max - min)) * H
    }))

    const up = end >= start
    const color = up ? '#4ade80' : '#f87171'
    const fillColor = up ? 'rgba(74,222,128,0.07)' : 'rgba(248,113,113,0.07)'

    ctx.beginPath()
    ctx.moveTo(pts[0].x, H)
    pts.forEach(p => ctx.lineTo(p.x, p.y))
    ctx.lineTo(pts[pts.length - 1].x, H)
    ctx.closePath()
    ctx.fillStyle = fillColor
    ctx.fill()

    ctx.beginPath()
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.stroke()

    const last = pts[pts.length - 1]
    ctx.beginPath()
    ctx.arc(last.x, last.y, 4, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  }, [totalValue, startValue])

  return <canvas ref={canvasRef} width={600} height={110} style={{ width: '100%', height: '110px' }} />
}

export default function Dashboard() {
  const [profile, setProfile] = useState(null)
  const [holdings, setHoldings] = useState([])
  const [artistData, setArtistData] = useState({})
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      const { data: profileData } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(profileData)

      const { data: holdingsData } = await supabase
        .from('holdings').select('*').eq('user_id', user.id)
      setHoldings(holdingsData || [])

      const artistMap = {}
      await Promise.all(
        (holdingsData || []).map(async (h) => {
          const res = await fetch(`/api/artist?id=${h.artist_id}`)
          const data = await res.json()
          if (data.artist) artistMap[h.artist_id] = data.artist
        })
      )
      setArtistData(artistMap)
      setLoading(false)
    }
    getData()
  }, [])

  const getPrice = (artist) => {
    const followers = artist.followers
    const popularity = artist.popularity
    return Math.round(Math.sqrt(followers) * (popularity / 10) + (popularity * popularity / 200))
  }

  const getTotalValue = () => holdings.reduce((total, h) => {
    const artist = artistData[h.artist_id]
    if (!artist) return total
    return total + h.shares * getPrice(artist)
  }, 0)

  const getTotalInvested = () => holdings.reduce((t, h) => t + h.shares * h.buy_price, 0)

  const getPL = (h) => {
    const artist = artistData[h.artist_id]
    if (!artist) return null
    const current = getPrice(artist)
    return (((current - h.buy_price) / h.buy_price) * 100).toFixed(1)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <p style={{ color: '#555' }}>Loading...</p>
    </main>
  )

  const totalValue = getTotalValue()
  const totalInvested = getTotalInvested()
  const totalPL = totalValue - totalInvested
  const netWorth = (profile?.credits || 0) + totalValue
  const initials = profile?.username?.slice(0, 2).toUpperCase() || 'U'
  const allTimeChange = totalInvested > 0 ? (((totalValue - totalInvested) / totalInvested) * 100).toFixed(1) : '0.0'
  const startValue = profile?.credits || 1000

  return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', color: '#fff' }}>

      {/* Navbar */}
      <nav style={{ borderBottom: '0.5px solid #1a1a1a', padding: '14px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: '#4ade80', fontSize: '18px', fontWeight: '500', letterSpacing: '-0.5px' }}>Stockify</div>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <span style={{ color: '#fff', fontSize: '13px', cursor: 'pointer' }}>Portfolio</span>
          <span onClick={() => router.push('/explore')} style={{ color: '#555', fontSize: '13px', cursor: 'pointer' }}>Explore</span>
          <span style={{ color: '#555', fontSize: '13px', cursor: 'pointer' }}>Leaderboard</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#0f2a18', border: '0.5px solid #1a4a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80', fontSize: '11px', fontWeight: '500' }}>{initials}</div>
            <span style={{ color: '#aaa', fontSize: '13px' }}>{profile?.username}</span>
          </div>
          <button onClick={handleLogout} style={{ background: 'transparent', border: '0.5px solid #2a2a2a', color: '#555', fontSize: '12px', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer' }}>Log out</button>
        </div>
      </nav>

      {/* Body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', flex: 1 }}>

        {/* Main */}
        <div style={{ padding: '28px 32px', borderRight: '0.5px solid #141414' }}>

          <div style={{ color: '#555', fontSize: '10px', letterSpacing: '1px', marginBottom: '10px' }}>PORTFOLIO OVERVIEW</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '2px' }}>
            <span style={{ color: '#fff', fontSize: '40px', fontWeight: '500', letterSpacing: '-1px' }}>{Math.round(totalValue).toLocaleString()}</span>
            <span style={{ color: '#4ade80', fontSize: '22px', fontWeight: '500' }}>CR</span>
          </div>
          <div style={{ color: '#555', fontSize: '12px', marginBottom: '16px' }}>Total portfolio value · updated live</div>

          {/* Chart */}
          <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ color: '#888', fontSize: '12px', fontWeight: '500' }}>{profile?.username}'s portfolio</span>
              <span style={{ color: totalPL >= 0 ? '#4ade80' : '#f87171', fontSize: '12px', fontWeight: '500' }}>
                {totalPL >= 0 ? '▲' : '▼'} {allTimeChange}% all time
              </span>
            </div>
            <PerformanceChart totalValue={netWorth} startValue={startValue} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
              {['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Today'].map(l => (
                <span key={l} style={{ color: '#333', fontSize: '10px' }}>{l}</span>
              ))}
            </div>
          </div>

          {/* Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
            {[
              { label: 'Available credits', val: profile?.credits?.toLocaleString() },
              { label: 'Invested value', val: Math.round(totalInvested).toLocaleString() },
              { label: 'Total profit / loss', val: `${totalPL >= 0 ? '+' : ''}${Math.round(totalPL).toLocaleString()}`, color: totalPL >= 0 ? '#4ade80' : '#f87171' },
            ].map((m) => (
              <div key={m.label} style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '10px', padding: '14px' }}>
                <div style={{ color: '#555', fontSize: '11px', marginBottom: '6px' }}>{m.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                  <span style={{ color: m.color || '#fff', fontSize: '18px', fontWeight: '500' }}>{m.val}</span>
                  <span style={{ color: '#4ade80', fontSize: '11px', fontWeight: '500' }}>CR</span>
                </div>
              </div>
            ))}
          </div>

          {/* Holdings */}
          <div style={{ color: '#fff', fontSize: '15px', fontWeight: '500', marginBottom: '12px' }}>Your holdings</div>
          {holdings.length === 0 ? (
            <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '10px', padding: '32px', textAlign: 'center' }}>
              <p style={{ color: '#555', fontSize: '14px', marginBottom: '16px' }}>You haven't invested in any artists yet.</p>
              <button onClick={() => router.push('/explore')} style={{ background: '#4ade80', color: '#000', fontSize: '13px', fontWeight: '500', padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
                Explore Artists
              </button>
            </div>
          ) : (
            holdings.map(h => {
              const artist = artistData[h.artist_id]
              const currentPrice = artist ? getPrice(artist) : h.buy_price
              const currentValue = h.shares * currentPrice
              const pl = getPL(h)
              const up = parseFloat(pl) >= 0

              return (
                <div
                  key={h.id}
                  onClick={() => router.push(`/artist/${h.artist_id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '0.5px solid #141414', cursor: 'pointer' }}
                >
                  {artist?.image ? (
                    <img src={artist.image} alt={h.artist_name} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#1a1a1a', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#ddd', fontSize: '13px', fontWeight: '500' }}>{h.artist_name}</div>
                    <div style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>{h.shares.toFixed(2)} shares · bought at {Math.round(h.buy_price).toLocaleString()} CR</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', justifyContent: 'flex-end' }}>
                      <span style={{ color: '#fff', fontSize: '13px', fontWeight: '500' }}>{Math.round(currentValue).toLocaleString()}</span>
                      <span style={{ color: '#4ade80', fontSize: '11px' }}>CR</span>
                    </div>
                    {pl !== null && (
                      <div style={{ color: up ? '#4ade80' : '#f87171', fontSize: '11px', fontWeight: '500', marginTop: '2px' }}>
                        {up ? '+' : ''}{pl}%
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Sidebar */}
        <div style={{ padding: '24px 20px' }}>

          {/* Account Summary */}
          <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '10px', padding: '16px', marginBottom: '12px' }}>
            <div style={{ color: '#888', fontSize: '10px', letterSpacing: '0.5px', marginBottom: '12px' }}>ACCOUNT SUMMARY</div>
            {[
              { label: 'Username', val: profile?.username },
              { label: 'Credits', val: `${profile?.credits?.toLocaleString()} CR`, color: '#4ade80' },
              { label: 'Holdings', val: `${holdings.length} artists` },
              { label: 'Net worth', val: `${Math.round(netWorth).toLocaleString()} CR` },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ color: '#555', fontSize: '12px' }}>{r.label}</span>
                <span style={{ color: r.color || '#fff', fontSize: '12px', fontWeight: '500' }}>{r.val}</span>
              </div>
            ))}
          </div>

          {/* Trending */}
          <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '10px', padding: '16px', marginBottom: '12px' }}>
            <div style={{ color: '#888', fontSize: '10px', letterSpacing: '0.5px', marginBottom: '12px' }}>TRENDING TODAY</div>
            {[
              { name: 'Sabrina Carpenter', price: '3,306', change: '+12.4%', up: true },
              { name: 'Zach Top', price: '432', change: '+18.6%', up: true },
              { name: 'Clairo', price: '718', change: '+7.8%', up: true },
              { name: 'Drake', price: '11,242', change: '-1.9%', up: false },
            ].map((t, i, arr) => (
              <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: i < arr.length - 1 ? '0.5px solid #111' : 'none' }}>
                <span style={{ color: '#ddd', fontSize: '12px', flex: 1 }}>{t.name}</span>
                <span style={{ color: '#888', fontSize: '11px' }}>{t.price} CR</span>
                <span style={{ color: t.up ? '#4ade80' : '#f87171', fontSize: '11px', fontWeight: '500' }}>{t.change}</span>
              </div>
            ))}
          </div>

          <button onClick={() => router.push('/explore')} style={{ width: '100%', background: '#4ade80', color: '#000', fontSize: '13px', fontWeight: '500', padding: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
            Explore artists
          </button>
        </div>
      </div>
    </main>
  )
}