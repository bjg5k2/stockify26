'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

const ARTIST_POOL = [
  { id: '74KM79TiuVKeVCqs8QtB0B', name: 'Sabrina Carpenter' },
  { id: '4q3ewBCX7sLwd24euuV69X', name: 'Bad Bunny' },
  { id: '3l0CmX0FuQjFxr8SK7Vqag', name: 'Clairo' },
  { id: '3TVXtAsR1Inumwj472S9r4', name: 'Drake' },
  { id: '4lxfqrEsLX6N1N4OCSkILp', name: 'Phil Collins' },
  { id: '6yJCxee7QumYr820xdIsjo', name: 'Zach Top' },
]

function timeAgo(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay > 0) return `${diffDay}d ago`
  if (diffHour > 0) return `${diffHour}h ago`
  if (diffMin > 0) return `${diffMin}m ago`
  return 'just now'
}

export default function HomePage() {
  const [myProfile, setMyProfile] = useState(null)
  const [artistOfDay, setArtistOfDay] = useState(null)
  const [bio, setBio] = useState(null)
  const [stats, setStats] = useState({ totalInvested: 0, totalUsers: 0, totalBadges: 0, totalArtists: 0 })
  const [winner, setWinner] = useState(null)
  const [loser, setLoser] = useState(null)
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const getPrice = (artist) => {
    return Math.round((Math.sqrt(artist.followers) * (artist.popularity / 10) + (artist.popularity * artist.popularity / 200)) / 10)
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      const { data: myProfileData } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setMyProfile(myProfileData)

      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000)
      const pick = ARTIST_POOL[dayOfYear % ARTIST_POOL.length]
      const res = await fetch(`/api/artist?id=${pick.id}`)
      const data = await res.json()
      if (data.artist) {
        setArtistOfDay(data.artist)
        const bioRes = await fetch(`/api/bio?artist=${encodeURIComponent(data.artist.name)}`)
        const bioData = await bioRes.json()
        setBio(bioData.bio)
      }

      const { data: allProfiles } = await supabase.from('profiles').select('id')
      const { data: allHoldings } = await supabase.from('holdings').select('artist_id, shares, buy_price')
      const { data: allBadges } = await supabase.from('badges').select('id')
      const { data: snapshotsAll } = await supabase
        .from('artist_snapshots')
        .select('*')
        .order('snapshot_date', { ascending: true })

      const totalInvested = (allHoldings || []).reduce((sum, h) => sum + h.shares * h.buy_price, 0)
      const uniqueArtists = new Set((snapshotsAll || []).map(s => s.artist_id))

      setStats({
        totalInvested,
        totalUsers: (allProfiles || []).length,
        totalBadges: (allBadges || []).length,
        totalArtists: uniqueArtists.size,
      })

      const byArtist = {}
      ;(snapshotsAll || []).forEach(s => {
        if (!byArtist[s.artist_id]) byArtist[s.artist_id] = []
        byArtist[s.artist_id].push(s)
      })

      const growthList = Object.entries(byArtist)
        .filter(([, snaps]) => snaps.length >= 2)
        .map(([id, snaps]) => {
          const first = snaps[0]
          const last = snaps[snaps.length - 1]
          const growth = first.monthly_listeners > 0
            ? ((last.monthly_listeners - first.monthly_listeners) / first.monthly_listeners) * 100
            : 0
          return { artist_id: id, artist_name: last.artist_name, growth }
        })
        .sort((a, b) => b.growth - a.growth)

      if (growthList.length > 0) {
        const topGainer = growthList[0]
        const topLoser = growthList[growthList.length - 1]

        const [gainerRes, loserRes] = await Promise.all([
          fetch(`/api/artist?id=${topGainer.artist_id}`).then(r => r.json()),
          fetch(`/api/artist?id=${topLoser.artist_id}`).then(r => r.json()),
        ])

        setWinner({ ...topGainer, image: gainerRes.artist?.image || null, price: gainerRes.artist ? getPrice(gainerRes.artist) : null })
        if (topLoser.artist_id !== topGainer.artist_id) {
          setLoser({ ...topLoser, image: loserRes.artist?.image || null, price: loserRes.artist ? getPrice(loserRes.artist) : null })
        }
      }

      const { data: txData } = await supabase
        .from('transactions').select('*')
        .order('created_at', { ascending: false }).limit(15)

      const { data: badgeData } = await supabase
        .from('badges').select('*')
        .order('awarded_at', { ascending: false }).limit(15)

      const userIds = [...new Set([...(txData || []).map(t => t.user_id), ...(badgeData || []).map(b => b.user_id)])]
      const { data: profilesData } = await supabase
        .from('profiles').select('id, username').in('id', userIds)

      const usernameMap = {}
      ;(profilesData || []).forEach(p => { usernameMap[p.id] = p.username })

      const txItems = (txData || []).map(tx => ({
        type: tx.type,
        username: usernameMap[tx.user_id] || 'unknown',
        artist_name: tx.artist_name,
        shares: tx.shares,
        total: tx.total,
        timestamp: tx.created_at,
      }))
      const badgeItems = (badgeData || []).map(b => ({
        type: 'badge',
        username: usernameMap[b.user_id] || 'unknown',
        artist_name: b.artist_name,
        timestamp: b.awarded_at,
      }))
      const merged = [...txItems, ...badgeItems]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10)
      setFeed(merged)

      setLoading(false)
    }
    init()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <p style={{ color: '#555' }}>Loading...</p>
    </main>
  )

  const myInitials = myProfile?.username?.slice(0, 2).toUpperCase() || 'U'
  const aodPrice = artistOfDay ? getPrice(artistOfDay) : null

  return (
    <main style={{ background: '#0a0a0a', height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', color: '#fff', overflow: 'hidden' }}>

      {/* Navbar */}
      <nav style={{ borderBottom: '0.5px solid #1a1a1a', padding: '20px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ color: '#4ade80', fontSize: '26px', fontWeight: '500', cursor: 'pointer' }} onClick={() => router.push('/dashboard')}>Stockify</div>
        <div style={{ display: 'flex', gap: '36px', alignItems: 'center' }}>
          <span style={{ color: '#fff', fontSize: '16px', fontWeight: '500', cursor: 'pointer' }}>Home</span>
          <span onClick={() => router.push('/dashboard')} style={{ color: '#666', fontSize: '16px', cursor: 'pointer' }}>Portfolio</span>
          <span onClick={() => router.push('/explore')} style={{ color: '#666', fontSize: '16px', cursor: 'pointer' }}>Explore</span>
          <span onClick={() => router.push('/leaderboard')} style={{ color: '#666', fontSize: '16px', cursor: 'pointer' }}>Leaderboard</span>
          <span onClick={() => router.push(`/profile/${myProfile?.username}`)} style={{ color: '#666', fontSize: '16px', cursor: 'pointer' }}>Profile</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#0f2a18', border: '0.5px solid #1a4a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80', fontSize: '13px', fontWeight: '500' }}>{myInitials}</div>
            <span style={{ color: '#aaa', fontSize: '16px' }}>{myProfile?.username}</span>
          </div>
          <button onClick={handleLogout} style={{ background: 'transparent', border: '0.5px solid #2a2a2a', color: '#666', fontSize: '14px', padding: '7px 16px', borderRadius: '6px', cursor: 'pointer' }}>Log out</button>
        </div>
      </nav>

      {/* Main 3-column grid: 20% / 60% / 20% */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 3fr 1fr', gap: '20px', padding: '24px 48px', overflow: 'hidden', minHeight: 0 }}>

        {/* Col 1 (20%): Artist of the Day */}
        {artistOfDay && (
          <div
            onClick={() => router.push(`/artist/${artistOfDay.id}`)}
            style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', height: '100%', background: '#111' }}
          >
            {artistOfDay.image && (
              <img src={artistOfDay.image} alt={artistOfDay.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }} />
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,10,10,0.97) 30%, rgba(10,10,10,0.3) 100%)' }} />
            <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(0,0,0,0.6)', color: '#fbbf24', fontSize: '11px', fontWeight: '600', letterSpacing: '1px', padding: '4px 10px', borderRadius: '6px' }}>⭐ ARTIST OF THE DAY</div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '18px' }}>
              <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: '600', letterSpacing: '-0.5px', marginBottom: '8px' }}>{artistOfDay.name}</h1>
              {bio && <p style={{ color: '#fff', fontSize: '12px', lineHeight: '1.6', marginBottom: '14px' }}>{bio.length > 140 ? bio.slice(0, 140) + '...' : bio}</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <span style={{ color: '#fff', fontSize: '18px', fontWeight: '600' }}>{aodPrice?.toLocaleString()}</span>
                  <span style={{ color: '#4ade80', fontSize: '12px', fontWeight: '500' }}> CR / share</span>
                </div>
                <button style={{ background: '#4ade80', color: '#000', fontSize: '13px', fontWeight: '500', padding: '9px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
                  View & Invest
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Col 2 (60%): Stats + Heating Up / Cooling Off side by side */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'hidden' }}>

          {/* Platform Stats row of 4 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {[
              { label: 'Total CR Invested', val: `${Math.round(stats.totalInvested).toLocaleString()} CR`, color: '#4ade80' },
              { label: 'Total Users', val: stats.totalUsers.toLocaleString(), color: '#fff' },
              { label: 'Badges Awarded', val: stats.totalBadges.toLocaleString(), color: '#fbbf24' },
              { label: 'Artists Tracked', val: stats.totalArtists.toLocaleString(), color: '#fff' },
            ].map(s => (
              <div key={s.label} style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '18px', textAlign: 'center' }}>
                <div style={{ color: s.color, fontSize: '24px', fontWeight: '600' }}>{s.val}</div>
                <div style={{ color: '#555', fontSize: '11px', marginTop: '6px', letterSpacing: '0.5px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Heating Up / Cooling Off side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', flex: 1, minHeight: 0 }}>
            {winner && (
              <div
                onClick={() => router.push(`/artist/${winner.artist_id}`)}
                style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', height: '100%', background: '#111' }}
              >
                {winner.image && (
                  <img src={winner.image} alt={winner.artist_name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />
                )}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)' }} />
                <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(0,0,0,0.6)', color: '#4ade80', fontSize: '11px', fontWeight: '600', letterSpacing: '1px', padding: '4px 10px', borderRadius: '6px' }}>HEATING UP</div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px' }}>
                  <div style={{ color: '#fff', fontSize: '18px', fontWeight: '600' }}>{winner.artist_name}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                    <span style={{ color: '#4ade80', fontSize: '20px', fontWeight: '600' }}>▲ {winner.growth.toFixed(1)}%</span>
                    {winner.price && <span style={{ color: '#fff', fontSize: '14px' }}>{winner.price.toLocaleString()} CR</span>}
                  </div>
                </div>
              </div>
            )}

            {loser && (
              <div
                onClick={() => router.push(`/artist/${loser.artist_id}`)}
                style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', height: '100%', background: '#111' }}
              >
                {loser.image && (
                  <img src={loser.image} alt={loser.artist_name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />
                )}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)' }} />
                <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(0,0,0,0.6)', color: '#f87171', fontSize: '11px', fontWeight: '600', letterSpacing: '1px', padding: '4px 10px', borderRadius: '6px' }}>COOLING OFF</div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px' }}>
                  <div style={{ color: '#fff', fontSize: '18px', fontWeight: '600' }}>{loser.artist_name}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                    <span style={{ color: loser.growth >= 0 ? '#4ade80' : '#f87171', fontSize: '20px', fontWeight: '600' }}>
                      {loser.growth >= 0 ? '▲' : '▼'} {Math.abs(loser.growth).toFixed(1)}%
                    </span>
                    {loser.price && <span style={{ color: '#fff', fontSize: '14px' }}>{loser.price.toLocaleString()} CR</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Col 3 (20%): Live Activity Feed */}
        <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '14px', padding: '18px', height: '100%', overflow: 'auto' }}>
          <div style={{ color: '#888', fontSize: '11px', letterSpacing: '1px', marginBottom: '14px' }}>LIVE ACTIVITY</div>
          {feed.length === 0 ? (
            <p style={{ color: '#444', fontSize: '13px' }}>No activity yet.</p>
          ) : (
            feed.map((a, i) => {
              let icon, iconBg, iconColor, text
              if (a.type === 'buy') {
                icon = '↑'; iconBg = '#0f2a18'; iconColor = '#4ade80'
                text = <><b style={{ color: '#fff' }}>{a.username}</b> bought <b style={{ color: '#fff' }}>{a.shares.toFixed(2)} shares</b> of <b style={{ color: '#fff' }}>{a.artist_name}</b></>
              } else if (a.type === 'sell') {
                icon = '↓'; iconBg = '#1a0a0a'; iconColor = '#f87171'
                text = <><b style={{ color: '#fff' }}>{a.username}</b> sold <b style={{ color: '#fff' }}>{a.shares.toFixed(2) } shares</b> of <b style={{ color: '#fff' }}>{a.artist_name}</b></>
              } else {
                icon = '🏆'; iconBg = '#1a1a0a'; iconColor = '#fbbf24'
                text = <><b style={{ color: '#fff' }}>{a.username}</b> earned <b style={{ color: '#fff' }}>First Investor</b> for <b style={{ color: '#fff' }}>{a.artist_name}</b></>
              }
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: i < feed.length - 1 ? '0.5px solid #141414' : 'none' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '500', flexShrink: 0 }}>
                    {icon}
                  </div>
                  <div style={{ color: '#999', fontSize: '12px', flex: 1, lineHeight: '1.4' }}>{text}</div>
                  <div style={{ color: '#444', fontSize: '10px', flexShrink: 0 }}>{timeAgo(a.timestamp)}</div>
                </div>
              )
            })
          )}
        </div>

      </div>
    </main>
  )
}