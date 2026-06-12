'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function Dashboard() {
  const [profile, setProfile] = useState(null)
  const [holdings, setHoldings] = useState([])
  const [artistData, setArtistData] = useState({})
  const [snapshots, setSnapshots] = useState([])
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

      const { data: snapshotData } = await supabase
        .from('portfolio_snapshots')
        .select('*')
        .eq('user_id', user.id)
        .order('snapshot_date', { ascending: true })
      setSnapshots(snapshotData || [])

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
    return Math.round(Math.sqrt(artist.followers) * (artist.popularity / 10) + (artist.popularity * artist.popularity / 200))
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

  const firstSnapshot = snapshots[0]
  const firstNetWorth = firstSnapshot ? (firstSnapshot.total_value || 0) + (firstSnapshot.credits || 0) : 1000
  const allTimeChange = firstNetWorth > 0 ? (((netWorth - firstNetWorth) / firstNetWorth) * 100).toFixed(1) : '0.0'
  const up = parseFloat(allTimeChange) >= 0

  const chartData = [
    ...snapshots.map(s => ({
      date: new Date(s.snapshot_date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
      value: Math.round((s.total_value || 0) + (s.credits || 0))
    })),
    { date: 'Now', value: Math.round(netWorth) }
  ]
  if (chartData.length < 2) chartData.unshift({ date: 'Start', value: 1000 })

  return (
    <main style={{ background: '#0a0a0a', height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', color: '#fff', overflow: 'hidden' }}>

      {/* Navbar */}
      <nav style={{ borderBottom: '0.5px solid #1a1a1a', padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ color: '#4ade80', fontSize: '20px', fontWeight: '500', letterSpacing: '-0.5px' }}>Stockify</div>
        <div style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
          <span style={{ color: '#fff', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>Portfolio</span>
          <span onClick={() => router.push('/explore')} style={{ color: '#555', fontSize: '14px', cursor: 'pointer' }}>Explore</span>
          <span style={{ color: '#555', fontSize: '14px', cursor: 'pointer' }}>Leaderboard</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#0f2a18', border: '0.5px solid #1a4a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80', fontSize: '12px', fontWeight: '500' }}>{initials}</div>
            <span style={{ color: '#aaa', fontSize: '14px' }}>{profile?.username}</span>
          </div>
          <button onClick={handleLogout} style={{ background: 'transparent', border: '0.5px solid #2a2a2a', color: '#555', fontSize: '13px', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer' }}>Log out</button>
        </div>
      </nav>

      {/* Body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', flex: 1, minHeight: 0 }}>

        {/* Main */}
        <div style={{ padding: '32px 40px', borderRight: '0.5px solid #141414', overflow: 'auto' }}>

          <div style={{ color: '#555', fontSize: '11px', letterSpacing: '1px', marginBottom: '12px' }}>PORTFOLIO OVERVIEW</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '4px' }}>
            <span style={{ color: '#fff', fontSize: '52px', fontWeight: '500', letterSpacing: '-2px' }}>{Math.round(totalValue).toLocaleString()}</span>
            <span style={{ color: '#4ade80', fontSize: '28px', fontWeight: '500' }}>CR</span>
          </div>
          <div style={{ color: '#555', fontSize: '13px', marginBottom: '20px' }}>Total portfolio value · updated live</div>

          {/* Chart */}
          <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ color: '#aaa', fontSize: '14px', fontWeight: '500' }}>{profile?.username}'s portfolio</span>
              <span style={{ color: up ? '#4ade80' : '#f87171', fontSize: '13px', fontWeight: '500' }}>
                {up ? '▲' : '▼'} {Math.abs(allTimeChange)}% all time
              </span>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={up ? '#4ade80' : '#f87171'} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={up ? '#4ade80' : '#f87171'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: '#444', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide={true} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '8px', color: '#fff', fontSize: '13px' }}
                  formatter={(val) => [`${val.toLocaleString()} CR`, 'Net worth']}
                  labelStyle={{ color: '#555' }}
                />
                <Area type="monotone" dataKey="value" stroke={up ? '#4ade80' : '#f87171'} strokeWidth={2} fill="url(#colorValue)" dot={{ fill: up ? '#4ade80' : '#f87171', r: 4 }} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '28px' }}>
            {[
              { label: 'Available credits', val: profile?.credits?.toLocaleString() },
              { label: 'Invested value', val: Math.round(totalInvested).toLocaleString() },
              { label: 'Total profit / loss', val: `${totalPL >= 0 ? '+' : ''}${Math.round(totalPL).toLocaleString()}`, color: totalPL >= 0 ? '#4ade80' : '#f87171' },
            ].map((m) => (
              <div key={m.label} style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '18px' }}>
                <div style={{ color: '#555', fontSize: '12px', marginBottom: '8px' }}>{m.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ color: m.color || '#fff', fontSize: '22px', fontWeight: '500' }}>{m.val}</span>
                  <span style={{ color: '#4ade80', fontSize: '13px', fontWeight: '500' }}>CR</span>
                </div>
              </div>
            ))}
          </div>

          {/* Holdings */}
          <div style={{ color: '#fff', fontSize: '17px', fontWeight: '500', marginBottom: '16px' }}>Your holdings</div>
          {holdings.length === 0 ? (
            <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
              <p style={{ color: '#555', fontSize: '15px', marginBottom: '16px' }}>You haven't invested in any artists yet.</p>
              <button onClick={() => router.push('/explore')} style={{ background: '#4ade80', color: '#000', fontSize: '14px', fontWeight: '500', padding: '12px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
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
                  style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 0', borderBottom: '0.5px solid #141414', cursor: 'pointer' }}
                >
                  {artist?.image ? (
                    <img src={artist.image} alt={h.artist_name} style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#1a1a1a', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#ddd', fontSize: '15px', fontWeight: '500' }}>{h.artist_name}</div>
                    <div style={{ color: '#555', fontSize: '13px', marginTop: '3px' }}>{h.shares.toFixed(2)} shares · bought at {Math.round(h.buy_price).toLocaleString()} CR</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', justifyContent: 'flex-end' }}>
                      <span style={{ color: '#fff', fontSize: '15px', fontWeight: '500' }}>{Math.round(currentValue).toLocaleString()}</span>
                      <span style={{ color: '#4ade80', fontSize: '12px' }}>CR</span>
                    </div>
                    {pl !== null && (
                      <div style={{ color: up ? '#4ade80' : '#f87171', fontSize: '13px', fontWeight: '500', marginTop: '3px' }}>
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
        <div style={{ padding: '32px 28px', overflow: 'auto' }}>

          {/* Account Summary */}
          <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
            <div style={{ color: '#888', fontSize: '11px', letterSpacing: '0.5px', marginBottom: '16px' }}>ACCOUNT SUMMARY</div>
            {[
              { label: 'Username', val: profile?.username },
              { label: 'Credits', val: `${profile?.credits?.toLocaleString()} CR`, color: '#4ade80' },
              { label: 'Holdings', val: `${holdings.length} artists` },
              { label: 'Net worth', val: `${Math.round(netWorth).toLocaleString()} CR` },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ color: '#555', fontSize: '13px' }}>{r.label}</span>
                <span style={{ color: r.color || '#fff', fontSize: '13px', fontWeight: '500' }}>{r.val}</span>
              </div>
            ))}
          </div>

          {/* Trending */}
          <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
            <div style={{ color: '#888', fontSize: '11px', letterSpacing: '0.5px', marginBottom: '16px' }}>TRENDING TODAY</div>
            {[
              { name: 'Sabrina Carpenter', price: '3,306', change: '+12.4%', up: true },
              { name: 'Zach Top', price: '432', change: '+18.6%', up: true },
              { name: 'Clairo', price: '718', change: '+7.8%', up: true },
              { name: 'Drake', price: '11,242', change: '-1.9%', up: false },
            ].map((t, i, arr) => (
              <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: i < arr.length - 1 ? '0.5px solid #111' : 'none' }}>
                <span style={{ color: '#ddd', fontSize: '13px', flex: 1 }}>{t.name}</span>
                <span style={{ color: '#888', fontSize: '12px' }}>{t.price} CR</span>
                <span style={{ color: t.up ? '#4ade80' : '#f87171', fontSize: '12px', fontWeight: '500' }}>{t.change}</span>
              </div>
            ))}
          </div>

          <button onClick={() => router.push('/explore')} style={{ width: '100%', background: '#4ade80', color: '#000', fontSize: '14px', fontWeight: '500', padding: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}>
            Explore artists
          </button>
        </div>
      </div>
    </main>
  )
}