'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function LeaderboardPage() {
  const [myProfile, setMyProfile] = useState(null)
  const [ranked, setRanked] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      const { data: myProfileData } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setMyProfile(myProfileData)

      const { data: allProfiles } = await supabase
        .from('profiles').select('id, username, credits, is_admin')

      const realProfiles = (allProfiles || []).filter(p => !p.is_admin)

      const { data: allHoldings } = await supabase
        .from('holdings').select('user_id, artist_id, shares, buy_price')

      const { data: allBadges } = await supabase
        .from('badges').select('user_id')

      const badgeCountMap = {}
      ;(allBadges || []).forEach(b => {
        badgeCountMap[b.user_id] = (badgeCountMap[b.user_id] || 0) + 1
      })

      const uniqueArtistIds = [...new Set((allHoldings || []).map(h => h.artist_id))]
      const artistMap = {}
      await Promise.all(
        uniqueArtistIds.map(async id => {
          const res = await fetch(`/api/artist?id=${id}`)
          const data = await res.json()
          if (data.artist) artistMap[id] = data.artist
        })
      )

      const getPrice = (artist) => Math.round((Math.sqrt(artist.followers) * (artist.popularity / 10) + (artist.popularity * artist.popularity / 200)) / 10)

      const holdingsByUser = {}
      ;(allHoldings || []).forEach(h => {
        if (!holdingsByUser[h.user_id]) holdingsByUser[h.user_id] = []
        holdingsByUser[h.user_id].push(h)
      })

      const rankedList = realProfiles.map(p => {
        const userHoldings = holdingsByUser[p.id] || []
        const portfolioValue = userHoldings.reduce((sum, h) => {
          const artist = artistMap[h.artist_id]
          return sum + (artist ? h.shares * getPrice(artist) : 0)
        }, 0)
        return {
          ...p,
          netWorth: (p.credits || 0) + portfolioValue,
          holdingsCount: userHoldings.length,
          badgesCount: badgeCountMap[p.id] || 0,
        }
      }).sort((a, b) => b.netWorth - a.netWorth)

      setRanked(rankedList)
      setLoading(false)
    }
    getData()
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
  const top3 = ranked.slice(0, 3)
  const rest = ranked.slice(3)

  const medalColors = ['#fbbf24', '#c0c0c0', '#cd7f32']
  const medalEmojis = ['🥇', '🥈', '🥉']

  return (
    <main style={{ background: '#0a0a0a', height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', color: '#fff', overflow: 'hidden' }}>

      {/* Navbar */}
      <nav style={{ borderBottom: '0.5px solid #1a1a1a', padding: '20px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ color: '#4ade80', fontSize: '26px', fontWeight: '500', cursor: 'pointer' }} onClick={() => router.push('/home')}>Stockify</div>
        <div style={{ display: 'flex', gap: '36px', alignItems: 'center' }}>
          <span onClick={() => router.push('/home')} style={{ color: '#666', fontSize: '16px', cursor: 'pointer' }}>Home</span>
          <span onClick={() => router.push('/dashboard')} style={{ color: '#666', fontSize: '16px', cursor: 'pointer' }}>Portfolio</span>
          <span onClick={() => router.push('/explore')} style={{ color: '#666', fontSize: '16px', cursor: 'pointer' }}>Explore</span>
          <span style={{ color: '#fff', fontSize: '16px', fontWeight: '500', cursor: 'pointer' }}>Leaderboard</span>
          <span onClick={() => router.push(`/profile/${myProfile?.username}`)} style={{ color: '#666', fontSize: '16px', cursor: 'pointer' }}>Profile</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#0f2a18', border: '0.5px solid #1a4a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80', fontSize: '13px', fontWeight: '500' }}>{myInitials}</div>
            <span style={{ color: '#aaa', fontSize: '16px' }}>{myProfile?.username}</span>
          </div>
          <button onClick={handleLogout} style={{ background: 'transparent', border: '0.5px solid #2a2a2a', color: '#666', fontSize: '14px', padding: '7px 16px', borderRadius: '6px', cursor: 'pointer' }}>Log out</button>
        </div>
      </nav>

      <div style={{ flex: 1, overflow: 'auto', padding: '32px 48px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>

          <h1 style={{ color: '#fff', fontSize: '32px', fontWeight: '600', letterSpacing: '-0.5px', marginBottom: '8px' }}>Leaderboard</h1>
          <p style={{ color: '#555', fontSize: '14px', marginBottom: '28px' }}>Ranked by net worth — credits + portfolio value</p>

          {/* Top 3 Podium */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '28px' }}>
            {top3.map((u, i) => (
              <div
                key={u.id}
                onClick={() => router.push(`/profile/${u.username}`)}
                style={{
                  background: i === 0 ? 'linear-gradient(135deg, #1a1a0a, #0f0f0a)' : '#0f0f0f',
                  border: `0.5px solid ${i === 0 ? '#3a3a0a' : '#1c1c1c'}`,
                  borderRadius: '14px',
                  padding: '22px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transform: i === 0 ? 'scale(1.04)' : 'none',
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>{medalEmojis[i]}</div>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'linear-gradient(135deg, #4ade80, #22c55e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '600', color: '#000', margin: '0 auto 10px' }}>
                  {u.username?.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ color: '#fff', fontSize: '16px', fontWeight: '600' }}>{u.username}</div>
                <div style={{ color: medalColors[i], fontSize: '18px', fontWeight: '600', marginTop: '6px' }}>{Math.round(u.netWorth).toLocaleString()} CR</div>
                <div style={{ color: '#555', fontSize: '11px', marginTop: '4px' }}>{u.holdingsCount} artists · {u.badgesCount} badges</div>
              </div>
            ))}
          </div>

          {/* Rest of the list */}
          <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', overflow: 'hidden' }}>
            {rest.map((u, i) => {
              const isMe = u.id === myProfile?.id
              return (
                <div
                  key={u.id}
                  onClick={() => router.push(`/profile/${u.username}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 20px',
                    borderBottom: i < rest.length - 1 ? '0.5px solid #141414' : 'none',
                    cursor: 'pointer',
                    background: isMe ? 'rgba(74,222,128,0.06)' : 'transparent',
                    borderLeft: isMe ? '3px solid #4ade80' : '3px solid transparent',
                  }}
                >
                  <div style={{ color: '#555', fontSize: '14px', fontWeight: '500', width: '30px' }}>#{i + 4}</div>
                  <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#0f2a18', border: '0.5px solid #1a4a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80', fontSize: '12px', fontWeight: '500', flexShrink: 0 }}>
                    {u.username?.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#ddd', fontSize: '14px', fontWeight: '500' }}>
                      {u.username} {isMe && <span style={{ color: '#4ade80', fontSize: '11px', fontWeight: '500' }}>(you)</span>}
                    </div>
                    <div style={{ color: '#555', fontSize: '12px', marginTop: '2px' }}>{u.holdingsCount} artists · {u.badgesCount} badges</div>
                  </div>
                  <div style={{ color: '#fff', fontSize: '15px', fontWeight: '500' }}>{Math.round(u.netWorth).toLocaleString()} CR</div>
                </div>
              )
            })}
          </div>

        </div>
      </div>
    </main>
  )
}