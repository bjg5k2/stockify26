'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Portfolio() {
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

  const getProfitLoss = (holding) => {
    const artist = artistData[holding.artist_id]
    if (!artist) return null
    const currentValue = holding.shares * getPrice(artist)
    const buyValue = holding.shares * holding.buy_price
    return currentValue - buyValue
  }

  const getTotalValue = () => {
    return holdings.reduce((total, h) => {
      const artist = artistData[h.artist_id]
      if (!artist) return total
      return total + h.shares * getPrice(artist)
    }, 0)
  }

  if (loading) return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <p style={{ color: '#555' }}>Loading portfolio...</p>
    </main>
  )

  const totalValue = getTotalValue()
  const totalInvested = holdings.reduce((t, h) => t + h.shares * h.buy_price, 0)
  const totalPL = totalValue - totalInvested

  return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh', fontFamily: 'sans-serif', color: '#fff' }}>

      {/* Navbar */}
      <nav style={{ borderBottom: '0.5px solid #1a1a1a', padding: '14px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: '#4ade80', fontSize: '18px', fontWeight: '500', cursor: 'pointer' }} onClick={() => router.push('/dashboard')}>Stockify</div>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <span onClick={() => router.push('/dashboard')} style={{ color: '#555', fontSize: '13px', cursor: 'pointer' }}>Portfolio</span>
          <span onClick={() => router.push('/explore')} style={{ color: '#555', fontSize: '13px', cursor: 'pointer' }}>Explore</span>
          <span style={{ color: '#555', fontSize: '13px', cursor: 'pointer' }}>Leaderboard</span>
        </div>
      </nav>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px' }}>

        <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: '500', letterSpacing: '-0.5px', marginBottom: '28px' }}>Your Portfolio</h1>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '28px' }}>
          {[
            { label: 'Credits Available', val: profile?.credits?.toLocaleString(), color: '#fff' },
            { label: 'Portfolio Value', val: Math.round(totalValue).toLocaleString(), color: '#fff' },
            { label: 'Total Profit / Loss', val: `${totalPL >= 0 ? '+' : ''}${Math.round(totalPL).toLocaleString()}`, color: totalPL >= 0 ? '#4ade80' : '#f87171' },
          ].map(m => (
            <div key={m.label} style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '20px' }}>
              <div style={{ color: '#555', fontSize: '11px', marginBottom: '8px' }}>{m.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ color: m.color, fontSize: '22px', fontWeight: '500' }}>{m.val}</span>
                <span style={{ color: '#4ade80', fontSize: '13px', fontWeight: '500' }}>CR</span>
              </div>
            </div>
          ))}
        </div>

        {/* Holdings */}
        {holdings.length === 0 ? (
          <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
            <p style={{ color: '#555', fontSize: '14px', marginBottom: '16px' }}>You haven't invested in any artists yet.</p>
            <button onClick={() => router.push('/explore')} style={{ background: '#4ade80', color: '#000', fontSize: '13px', fontWeight: '500', padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
              Explore Artists
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {holdings.map(h => {
              const artist = artistData[h.artist_id]
              const currentPrice = artist ? getPrice(artist) : h.buy_price
              const currentValue = h.shares * currentPrice
              const pl = getProfitLoss(h)
              const plPct = artist ? (((currentPrice - h.buy_price) / h.buy_price) * 100).toFixed(1) : '0.0'
              const up = pl >= 0

              return (
                <div
                  key={h.id}
                  onClick={() => router.push(`/artist/${h.artist_id}`)}
                  style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}
                >
                  {artist?.image ? (
                    <img src={artist.image} alt={h.artist_name} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#1a1a1a', flexShrink: 0 }} />
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#ddd', fontSize: '15px', fontWeight: '500', marginBottom: '3px' }}>{h.artist_name}</div>
                    <div style={{ color: '#555', fontSize: '12px' }}>
                      {h.shares.toFixed(2)} shares · bought at {Math.round(h.buy_price).toLocaleString()} <span style={{ color: '#4ade80', fontSize: '11px' }}>CR</span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', justifyContent: 'flex-end', marginBottom: '3px' }}>
                      <span style={{ color: '#fff', fontSize: '16px', fontWeight: '500' }}>{Math.round(currentValue).toLocaleString()}</span>
                      <span style={{ color: '#4ade80', fontSize: '12px', fontWeight: '500' }}>CR</span>
                    </div>
                    {pl !== null && (
                      <div style={{ color: up ? '#4ade80' : '#f87171', fontSize: '12px', fontWeight: '500' }}>
                        {up ? '+' : ''}{Math.round(pl).toLocaleString()} CR ({up ? '+' : ''}{plPct}%)
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <button
          onClick={() => router.push('/explore')}
          style={{ width: '100%', marginTop: '20px', background: '#4ade80', color: '#000', fontSize: '14px', fontWeight: '500', padding: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}
        >
          Explore More Artists
        </button>

      </div>
    </main>
  )
}