'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import { EQVisualizer, AnimatedNumber, Skeleton } from '../components/FX'

export default function LeaderboardPage() {
  const [myProfile, setMyProfile] = useState(null)
  const [ranked, setRanked] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('alltime')
  const [sortBy, setSortBy] = useState('networth')
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

      const getPrice = (artist) => Math.max(10, Math.round(Math.sqrt(artist.followers) / 2 + (artist.popularity * artist.popularity) / 8))
      const holdingsByUser = {}
      ;(allHoldings || []).forEach(h => {
        if (!holdingsByUser[h.user_id]) holdingsByUser[h.user_id] = []
        holdingsByUser[h.user_id].push(h)
      })

      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]
      const { data: yesterdaySnaps } = await supabase
        .from('portfolio_snapshots')
        .select('user_id, total_value, credits')
        .eq('snapshot_date', yesterdayStr)
      const yesterdayNetWorthMap = {}
      ;(yesterdaySnaps || []).forEach(s => { yesterdayNetWorthMap[s.user_id] = (s.total_value || 0) + (s.credits || 0) })

      const lastWeek = new Date()
      lastWeek.setDate(lastWeek.getDate() - 7)
      const lastWeekStr = lastWeek.toISOString().split('T')[0]
      const { data: lastWeekSnaps } = await supabase
        .from('portfolio_snapshots')
        .select('user_id, total_value, credits')
        .eq('snapshot_date', lastWeekStr)
      const lastWeekNetWorthMap = {}
      ;(lastWeekSnaps || []).forEach(s => { lastWeekNetWorthMap[s.user_id] = (s.total_value || 0) + (s.credits || 0) })

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
          yesterdayNetWorth: yesterdayNetWorthMap[p.id] ?? null,
          lastWeekNetWorth: lastWeekNetWorthMap[p.id] ?? null,
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

  const getDisplayList = () => {
    let list = [...ranked]
    if (period === 'weekly') {
      list = list
        .filter(u => u.lastWeekNetWorth !== null)
        .map(u => ({ ...u, weeklyGain: u.netWorth - u.lastWeekNetWorth }))
        .sort((a, b) => b.weeklyGain - a.weeklyGain)
    } else {
      if (sortBy === 'networth') list.sort((a, b) => b.netWorth - a.netWorth)
      if (sortBy === 'portfolio') list.sort((a, b) => {
        const aPort = a.netWorth - (a.credits || 0)
        const bPort = b.netWorth - (b.credits || 0)
        return bPort - aPort
      })
      if (sortBy === 'badges') list.sort((a, b) => b.badgesCount - a.badgesCount)
      if (sortBy === 'gain') {
        list = list.filter(u => u.yesterdayNetWorth !== null)
        list.sort((a, b) => (b.netWorth - b.yesterdayNetWorth) - (a.netWorth - a.yesterdayNetWorth))
      }
    }
    return list
  }

  const getYesterdayRanks = () => {
    const withYesterday = ranked.filter(u => u.yesterdayNetWorth !== null)
    const sorted = [...withYesterday].sort((a, b) => b.yesterdayNetWorth - a.yesterdayNetWorth)
    const rankMap = {}
    sorted.forEach((u, i) => { rankMap[u.id] = i + 1 })
    return rankMap
  }

  if (loading) return (
    <main style={{ background: '#0a0a0a', height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', color: '#fff', overflow: 'hidden' }}>
      <nav style={{ borderBottom: '0.5px solid #1a1a1a', padding: '20px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ color: '#4ade80', fontSize: '26px', fontWeight: '500' }}>Stockify</div>
          <EQVisualizer />
        </div>
      </nav>
      <div style={{ flex: 1, overflow: 'auto', padding: '32px 48px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Skeleton width="220px" height="32px" borderRadius="6px" />
          <div style={{ marginTop: '12px' }}><Skeleton width="320px" height="16px" borderRadius="4px" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginTop: '28px', marginBottom: '28px' }}>
            {[1, 2, 3].map(i => <Skeleton key={i} height="160px" borderRadius="14px" />)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} height="62px" borderRadius="12px" />)}
          </div>
        </div>
      </div>
    </main>
  )

  const myInitials = myProfile?.username?.slice(0, 2).toUpperCase() || 'U'
  const medalColors = ['#fbbf24', '#c0c0c0', '#cd7f32']
  const medalEmojis = ['🥇', '🥈', '🥉']
  const displayList = getDisplayList()
  const yesterdayRanks = getYesterdayRanks()
  const top3 = displayList.slice(0, 3)
  const rest = displayList.slice(3)

  const MovementBadge = ({ todayRank, userId }) => {
    const yRank = yesterdayRanks[userId]
    const movement = yRank ? yRank - todayRank : null
    if (movement === null) return <span style={{ fontSize: '10px', color: '#555', marginLeft: '4px' }}>NEW</span>
    if (movement === 0) return null
    return (
      <span style={{ fontSize: '10px', color: movement > 0 ? '#4ade80' : '#f87171', marginLeft: '4px' }}>
        {movement > 0 ? `▲${movement}` : `▼${Math.abs(movement)}`}
      </span>
    )
  }

  return (
    <main style={{ background: '#0a0a0a', height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', color: '#fff', overflow: 'hidden' }}>

      {/* Navbar */}
      <nav style={{ borderBottom: '0.5px solid #1a1a1a', padding: '20px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div onClick={() => router.push('/home')} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
          <div style={{ color: '#4ade80', fontSize: '26px', fontWeight: '500' }}>Stockify</div>
          <EQVisualizer />
        </div>
        <div style={{ display: 'flex', gap: '36px', alignItems: 'center' }}>
          <span onClick={() => router.push('/home')} style={{ color: '#666', fontSize: '16px', cursor: 'pointer' }}>Home</span>
          <span onClick={() => router.push('/dashboard')} style={{ color: '#666', fontSize: '16px', cursor: 'pointer' }}>Portfolio</span>
          <span onClick={() => router.push('/explore')} style={{ color: '#666', fontSize: '16px', cursor: 'pointer' }}>Explore</span>
          <span style={{ color: '#fff', fontSize: '16px', fontWeight: '500', cursor: 'pointer' }}>Leaderboard</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#0f2a18', border: '0.5px solid #1a4a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80', fontSize: '13px', fontWeight: '500' }}>{myInitials}</div>
            <span onClick={() => router.push(`/profile/${myProfile?.username}`)} style={{ color: '#aaa', fontSize: '16px', cursor: 'pointer' }}>{myProfile?.username}</span>
          </div>
          <button onClick={handleLogout} style={{ background: 'transparent', border: '0.5px solid #2a2a2a', color: '#666', fontSize: '14px', padding: '7px 16px', borderRadius: '6px', cursor: 'pointer' }}>Log out</button>
        </div>
      </nav>

      <div style={{ flex: 1, overflow: 'auto', padding: '32px 48px 74px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>

          <h1 style={{ color: '#fff', fontSize: '32px', fontWeight: '600', letterSpacing: '-0.5px', marginBottom: '8px' }}>Leaderboard</h1>
          <p style={{ color: '#555', fontSize: '14px', marginBottom: '20px' }}>Ranked by net worth — credits + portfolio value</p>

          {/* Period toggle */}
          <div style={{ display: 'flex', background: '#0a0a0a', border: '0.5px solid #1a1a1a', borderRadius: '8px', padding: '3px', marginBottom: '16px', width: 'fit-content' }}>
            {[{ id: 'alltime', label: 'All Time' }, { id: 'weekly', label: 'This Week' }].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                style={{
                  padding: '7px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  fontSize: '13px', fontWeight: '500',
                  background: period === p.id ? '#1a1a1a' : 'transparent',
                  color: period === p.id ? '#fff' : '#555',
                }}
              >{p.label}</button>
            ))}
          </div>

          {/* Sort controls (alltime only) */}
          {period === 'alltime' && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
              {[
                { id: 'networth', label: 'Net Worth' },
                { id: 'portfolio', label: 'Portfolio Value' },
                { id: 'badges', label: 'Badges' },
                { id: 'gain', label: "Yesterday's Gain" },
              ].map(s => (
                <button
                  key={s.id}
                  onClick={() => setSortBy(s.id)}
                  style={{
                    padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: '500',
                    background: sortBy === s.id ? '#4ade80' : 'transparent',
                    color: sortBy === s.id ? '#000' : '#555',
                    border: sortBy === s.id ? 'none' : '0.5px solid #2a2a2a',
                  }}
                >{s.label}</button>
              ))}
            </div>
          )}

          {period === 'weekly' ? (
            <>
              <p style={{ color: '#555', fontSize: '12px', marginBottom: '16px' }}>
                Ranked by net worth gained over the last 7 days. Only includes users with snapshot data from 7 days ago.
              </p>
              {displayList.length === 0 ? (
                <div style={{ color: '#444', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>No data available for this period yet.</div>
              ) : (
                <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', overflow: 'hidden' }}>
                  {displayList.map((u, i) => {
                    const isMe = u.id === myProfile?.id
                    const gainColor = u.weeklyGain >= 0 ? '#4ade80' : '#f87171'
                    const gainDisplay = u.weeklyGain >= 0
                      ? `+${Math.round(u.weeklyGain).toLocaleString()} CR`
                      : `${Math.round(u.weeklyGain).toLocaleString()} CR`
                    return (
                      <div
                        key={u.id}
                        onClick={() => router.push(`/profile/${u.username}`)}
                        className="card-hover"
                        style={{
                          display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 20px',
                          borderBottom: i < displayList.length - 1 ? '0.5px solid #141414' : 'none',
                          cursor: 'pointer',
                          background: isMe ? 'rgba(74,222,128,0.06)' : 'transparent',
                          borderLeft: isMe ? '3px solid #4ade80' : '3px solid transparent',
                        }}
                      >
                        <div style={{ color: '#555', fontSize: '14px', fontWeight: '500', width: '30px' }}>#{i + 1}</div>
                        <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#0f2a18', border: '0.5px solid #1a4a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80', fontSize: '12px', fontWeight: '500', flexShrink: 0 }}>
                          {u.username?.slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: '#ddd', fontSize: '14px', fontWeight: '500' }}>
                            {u.username} {isMe && <span style={{ color: '#4ade80', fontSize: '11px', fontWeight: '500' }}>(you)</span>}
                          </div>
                          <div style={{ color: '#555', fontSize: '12px', marginTop: '2px' }}>{u.holdingsCount} artists · {u.badgesCount} badges</div>
                        </div>
                        <div style={{ color: gainColor, fontSize: '15px', fontWeight: '500' }}>{gainDisplay}</div>
                      </div>
                    )
                  })}
                </div>
              )}
              {/* Pinned "not enough data" note for weekly mode if user not in list */}
              {myProfile && displayList.findIndex(u => u.id === myProfile.id) === -1 && (
                <div style={{ marginTop: '8px', borderTop: '0.5px solid #1c1c1c', paddingTop: '12px', color: '#444', fontSize: '12px', textAlign: 'center' }}>
                  You don't have snapshot data from 7 days ago — check back next week.
                </div>
              )}
            </>
          ) : (
            <>
              {/* Top 3 Podium */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '28px' }}>
                {top3.map((u, i) => {
                  const todayRank = i + 1
                  return (
                    <div
                      key={u.id}
                      onClick={() => router.push(`/profile/${u.username}`)}
                      className="card-hover"
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
                      <div style={{ fontSize: '32px', marginBottom: '4px' }}>{medalEmojis[i]}</div>
                      <div style={{ marginBottom: '8px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MovementBadge todayRank={todayRank} userId={u.id} />
                      </div>
                      <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'linear-gradient(135deg, #4ade80, #22c55e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '600', color: '#000', margin: '0 auto 10px' }}>
                        {u.username?.slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ color: '#fff', fontSize: '16px', fontWeight: '600' }}>{u.username}</div>
                      <div style={{ color: medalColors[i], fontSize: '18px', fontWeight: '600', marginTop: '6px' }}><AnimatedNumber value={Math.round(u.netWorth)} /> CR</div>
                      <div style={{ color: '#555', fontSize: '11px', marginTop: '4px' }}>{u.holdingsCount} artists · {u.badgesCount} badges</div>
                      {u.id !== myProfile?.id && (
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/compare/${u.username}`) }}
                          style={{ background: 'transparent', border: '0.5px solid #2a2a2a', color: '#555', fontSize: '11px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', marginTop: '10px' }}
                        >Compare</button>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Rest of the list */}
              <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', overflow: 'hidden' }}>
                {rest.map((u, i) => {
                  const isMe = u.id === myProfile?.id
                  const todayRank = i + 4
                  return (
                    <div
                      key={u.id}
                      onClick={() => router.push(`/profile/${u.username}`)}
                      className="card-hover"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 20px',
                        borderBottom: i < rest.length - 1 ? '0.5px solid #141414' : 'none',
                        cursor: 'pointer',
                        background: isMe ? 'rgba(74,222,128,0.06)' : 'transparent',
                        borderLeft: isMe ? '3px solid #4ade80' : '3px solid transparent',
                      }}
                    >
                      <div style={{ color: '#555', fontSize: '14px', fontWeight: '500', width: '30px', display: 'flex', alignItems: 'center' }}>
                        #{todayRank}
                        <MovementBadge todayRank={todayRank} userId={u.id} />
                      </div>
                      <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#0f2a18', border: '0.5px solid #1a4a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80', fontSize: '12px', fontWeight: '500', flexShrink: 0 }}>
                        {u.username?.slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#ddd', fontSize: '14px', fontWeight: '500' }}>
                          {u.username} {isMe && <span style={{ color: '#4ade80', fontSize: '11px', fontWeight: '500' }}>(you)</span>}
                        </div>
                        <div style={{ color: '#555', fontSize: '12px', marginTop: '2px' }}>{u.holdingsCount} artists · {u.badgesCount} badges</div>
                      </div>
                      <div style={{ color: '#fff', fontSize: '15px', fontWeight: '500' }}><AnimatedNumber value={Math.round(u.netWorth)} /> CR</div>
                      {u.id !== myProfile?.id && (
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/compare/${u.username}`) }}
                          style={{ background: 'transparent', border: '0.5px solid #2a2a2a', color: '#555', fontSize: '11px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', flexShrink: 0 }}
                        >Compare</button>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

        </div>
      </div>

    </main>
  )
}
