'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { EQVisualizer, LiveDot, AnimatedNumber, Skeleton } from '../../components/FX'

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

export default function ProfilePage() {
  const [profile, setProfile] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [myProfile, setMyProfile] = useState(null)
  const [holdings, setHoldings] = useState([])
  const [artistData, setArtistData] = useState({})
  const [badges, setBadges] = useState([])
  const [activity, setActivity] = useState([])
  const [rank, setRank] = useState(null)
  const [totalUsers, setTotalUsers] = useState(0)
  const [firstInvestorMap, setFirstInvestorMap] = useState({})
  const [largestInvestorMap, setLargestInvestorMap] = useState({})
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { username } = useParams()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setCurrentUser(user)

      const { data: myProfileData } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setMyProfile(myProfileData)

      const { data: profileData, error } = await supabase
        .from('profiles').select('*').eq('username', username).single()

      if (error || !profileData) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setProfile(profileData)

      const { data: holdingsData } = await supabase
        .from('holdings').select('*').eq('user_id', profileData.id)
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

      const { data: badgeData } = await supabase
        .from('badges').select('*').eq('user_id', profileData.id)
        .order('awarded_at', { ascending: false })
      setBadges(badgeData || [])

      const firstMap = {}
      ;(badgeData || []).forEach(b => {
        if (b.badge_type === 'first_investor') firstMap[b.artist_id] = true
      })
      setFirstInvestorMap(firstMap)

      const largestMap = {}
      await Promise.all(
        (holdingsData || []).map(async h => {
          const { data: top } = await supabase
            .from('holdings')
            .select('user_id, shares')
            .eq('artist_id', h.artist_id)
            .order('shares', { ascending: false })
            .limit(1)
            .single()
          largestMap[h.artist_id] = top?.user_id === profileData.id
        })
      )
      setLargestInvestorMap(largestMap)

      const { data: txData } = await supabase
        .from('transactions').select('*').eq('user_id', profileData.id)
        .order('created_at', { ascending: false }).limit(15)

      const txItems = (txData || []).map(tx => ({
        type: tx.type,
        artist_name: tx.artist_name,
        shares: tx.shares,
        price_per_share: tx.price_per_share,
        total: tx.total,
        timestamp: tx.created_at,
      }))
      const badgeItems = (badgeData || []).map(b => ({
        type: 'badge',
        artist_name: b.artist_name,
        timestamp: b.awarded_at,
      }))
      const merged = [...txItems, ...badgeItems]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10)
      setActivity(merged)

      // Calculate leaderboard rank live, matching the leaderboard page's logic
      if (!profileData.is_admin) {
        const { data: allProfiles } = await supabase
          .from('profiles').select('id, credits, is_admin')
        const realProfiles = (allProfiles || []).filter(p => !p.is_admin)

        const { data: allHoldingsForRank } = await supabase
          .from('holdings').select('user_id, artist_id, shares')

        const uniqueArtistIds = [...new Set((allHoldingsForRank || []).map(h => h.artist_id))]
        const rankArtistMap = {}
        await Promise.all(
          uniqueArtistIds.map(async aid => {
            const res = await fetch(`/api/artist?id=${aid}`)
            const data = await res.json()
            if (data.artist) rankArtistMap[aid] = data.artist
          })
        )

        const holdingsByUserForRank = {}
        ;(allHoldingsForRank || []).forEach(h => {
          if (!holdingsByUserForRank[h.user_id]) holdingsByUserForRank[h.user_id] = []
          holdingsByUserForRank[h.user_id].push(h)
        })

        const rankedList = realProfiles.map(p => {
          const userHoldings = holdingsByUserForRank[p.id] || []
          const portfolioValue = userHoldings.reduce((sum, h) => {
            const a = rankArtistMap[h.artist_id]
            return sum + (a ? h.shares * getPrice(a) : 0)
          }, 0)
          return { uid: p.id, netWorth: (p.credits || 0) + portfolioValue }
        }).sort((a, b) => b.netWorth - a.netWorth)

        const userRank = rankedList.findIndex(r => r.uid === profileData.id)
        if (userRank !== -1) {
          setRank(userRank + 1)
          setTotalUsers(rankedList.length)
        }
      }

      setLoading(false)
    }
    getData()
  }, [username])

const getPrice = (artist) => {
    return Math.max(10, Math.round((Math.sqrt(artist.followers) * (artist.popularity / 10) + (artist.popularity * artist.popularity / 200)) / 10))
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
    return (((current - h.buy_price) / h.buy_price) * 100)
  }

  const getSortedHoldings = () => {
    return [...holdings].sort((a, b) => {
      const aArtist = artistData[a.artist_id]
      const bArtist = artistData[b.artist_id]
      const aVal = aArtist ? a.shares * getPrice(aArtist) : 0
      const bVal = bArtist ? b.shares * getPrice(bArtist) : 0
      return bVal - aVal
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return (
    <main style={{ background: '#0a0a0a', height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', color: '#fff', overflow: 'hidden' }}>
      <nav style={{ borderBottom: '0.5px solid #1a1a1a', padding: '20px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ color: '#4ade80', fontSize: '26px', fontWeight: '500' }}>Stockify</div>
          <EQVisualizer />
        </div>
      </nav>
      <div style={{ padding: '32px 48px', flexShrink: 0 }}>
        <Skeleton height="120px" borderRadius="16px" />
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.6fr 1fr 320px', gap: '20px', padding: '0 48px 24px', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: '10px' }}>
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} borderRadius="12px" />)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Skeleton height="80px" borderRadius="12px" />
          <Skeleton height="60px" borderRadius="12px" />
          <Skeleton height="60px" borderRadius="12px" />
          <Skeleton height="60px" borderRadius="12px" />
        </div>
        <Skeleton borderRadius="12px" />
      </div>
    </main>
  )

  if (notFound) return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', flexDirection: 'column', gap: '16px' }}>
      <p style={{ color: '#555', fontSize: '16px' }}>User not found.</p>
      <button onClick={() => router.push('/dashboard')} style={{ background: '#4ade80', color: '#000', fontSize: '14px', fontWeight: '500', padding: '12px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
        Back to Dashboard
      </button>
    </main>
  )

  const totalValue = getTotalValue()
  const totalInvested = getTotalInvested()
  const totalPL = totalValue - totalInvested
  const netWorth = (profile.credits || 0) + totalValue
  const initials = profile.username?.slice(0, 2).toUpperCase() || 'U'
  const sortedHoldings = getSortedHoldings()
  const topHoldings = sortedHoldings.slice(0, 6)

  const joinedDate = profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : null
  const isOwnProfile = currentUser?.id === profile.id
  const myInitials = myProfile?.username?.slice(0, 2).toUpperCase() || 'U'

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
          <span onClick={() => router.push('/leaderboard')} style={{ color: '#666', fontSize: '16px', cursor: 'pointer' }}>Leaderboard</span>
          <span
            onClick={() => router.push(`/profile/${myProfile?.username}`)}
            style={{ color: isOwnProfile ? '#fff' : '#666', fontSize: '16px', fontWeight: isOwnProfile ? '500' : '400', cursor: 'pointer' }}
          >
            Profile
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#0f2a18', border: '0.5px solid #1a4a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80', fontSize: '13px', fontWeight: '500' }}>{myInitials}</div>
            <span style={{ color: '#aaa', fontSize: '16px' }}>{myProfile?.username}</span>
          </div>
          <button onClick={handleLogout} style={{ background: 'transparent', border: '0.5px solid #2a2a2a', color: '#666', fontSize: '14px', padding: '7px 16px', borderRadius: '6px', cursor: 'pointer' }}>Log out</button>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ position: 'relative', padding: '32px 48px', background: 'linear-gradient(135deg, #0f2a18 0%, #0a1a14 40%, #0a0a0a 100%)', borderBottom: '0.5px solid #1a1a1a', flexShrink: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-60%', right: '-5%', width: '350px', height: '350px', background: 'radial-gradient(circle, rgba(74,222,128,0.15) 0%, transparent 70%)' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ width: '84px', height: '84px', borderRadius: '50%', background: 'linear-gradient(135deg, #4ade80, #22c55e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: '600', color: '#000', flexShrink: 0, boxShadow: '0 0 30px rgba(74,222,128,0.3)' }}>
            {initials}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: '600', letterSpacing: '-0.5px' }}>{profile.username}</h1>
              {isOwnProfile && (
                <span style={{ background: 'rgba(74,222,128,0.1)', border: '0.5px solid #1a4a2a', color: '#4ade80', fontSize: '11px', fontWeight: '500', padding: '4px 10px', borderRadius: '6px' }}>
                  This is you
                </span>
              )}
              {profile.is_admin && (
                <span style={{ background: 'rgba(251,191,36,0.1)', border: '0.5px solid #3a3a0a', color: '#fbbf24', fontSize: '11px', fontWeight: '500', padding: '4px 10px', borderRadius: '6px' }}>
                  Admin
                </span>
              )}
            </div>
            <p style={{ color: '#8fae9c', fontSize: '13px', marginTop: '4px' }}>
              {joinedDate && `Joined ${joinedDate}`}
              {holdings.length > 0 && ` · ${holdings.length} artist${holdings.length !== 1 ? 's' : ''} invested`}
              {badges.length > 0 && ` · ${badges.length} badge${badges.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '36px', marginLeft: 'auto' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '26px', fontWeight: '600' }}>
                <AnimatedNumber value={Math.round(netWorth)} /> <span style={{ fontSize: '14px', color: '#4ade80' }}>CR</span>
              </div>
              <div style={{ color: '#8fae9c', fontSize: '11px', marginTop: '3px', letterSpacing: '0.5px' }}>NET WORTH</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '26px', fontWeight: '600', color: '#fbbf24' }}>
                {rank ? `#${rank}` : '—'}
                {rank && totalUsers > 0 && <span style={{ fontSize: '14px', color: '#8a8a6a' }}> / {totalUsers}</span>}
              </div>
              <div style={{ color: '#8fae9c', fontSize: '11px', marginTop: '3px', letterSpacing: '0.5px' }}>LEADERBOARD RANK</div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.6fr 1fr 320px', gap: '20px', padding: '24px 48px 66px', overflow: 'hidden', minHeight: 0 }}>

        {/* Col 1: Top Holdings (3x2 grid of cards) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'hidden' }}>
          <div style={{ color: '#888', fontSize: '11px', letterSpacing: '1px' }}>TOP HOLDINGS</div>
          {topHoldings.length === 0 ? (
            <div style={{ background: '#0f0f0f', border: '0.5px dashed #2a2a2a', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#444', fontSize: '13px' }}>
              No holdings yet.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: '10px', flex: 1 }}>
              {topHoldings.map(h => {
                const artist = artistData[h.artist_id]
                const currentPrice = artist ? getPrice(artist) : h.buy_price
                const currentValue = h.shares * currentPrice
                const pl = getPL(h)
                const up = pl !== null && pl >= 0
                const isFirst = firstInvestorMap[h.artist_id]
                const isLargest = largestInvestorMap[h.artist_id]

                return (
                  <div
                    key={h.id}
                    onClick={() => router.push(`/artist/${h.artist_id}`)}
                    className="card-hover"
                    style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', background: '#111' }}
                  >
                    {artist?.image && (
                      <img src={artist.image} alt={h.artist_name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                    )}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)' }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px' }}>
                      {(isFirst || isLargest) && (
                        <div style={{ color: '#fbbf24', fontSize: '10px', fontWeight: '600', marginBottom: '3px' }}>
                          {isFirst ? '🏆 First Investor' : '👑 Top Holder'}
                        </div>
                      )}
                      <div style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>{h.artist_name}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '2px' }}>
                        <span style={{ color: '#fff', fontSize: '12px', fontWeight: '500' }}><AnimatedNumber value={Math.round(currentValue)} /></span>
                        <span style={{ color: '#4ade80', fontSize: '10px', fontWeight: '500' }}>CR</span>
                        {pl !== null && (
                          <span style={{ color: up ? '#4ade80' : '#f87171', fontSize: '11px', fontWeight: '600', marginLeft: 'auto' }}>
                            {up ? '+' : ''}{pl.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Col 2: Badges + Overview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'hidden' }}>
          <div style={{ color: '#888', fontSize: '11px', letterSpacing: '1px' }}>BADGES & ACHIEVEMENTS</div>
          {badges.length === 0 ? (
            <div style={{ background: '#0f0f0f', border: '0.5px dashed #2a2a2a', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#444', fontSize: '13px' }}>
              No badges yet. Be the first to invest in an artist!
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {badges.slice(0, 4).map(b => (
                <div key={b.id} className="card-hover" style={{ background: 'linear-gradient(135deg, #1a1a0a, #0f0f0a)', border: '0.5px solid #3a3a0a', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '26px', marginBottom: '6px' }}>🏆</div>
                  <div style={{ color: '#fbbf24', fontSize: '11px', fontWeight: '600' }}>First Investor</div>
                  <div style={{ color: '#8a8a6a', fontSize: '10px', marginTop: '2px' }}>{b.artist_name}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ color: '#888', fontSize: '11px', letterSpacing: '1px', marginTop: '6px' }}>OVERVIEW</div>
          <div className="card-hover" style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#555', fontSize: '12px' }}>Total Profit / Loss</span>
            <span style={{ fontSize: '18px', fontWeight: '600', color: totalPL >= 0 ? '#4ade80' : '#f87171' }}>{totalPL >= 0 ? '+' : ''}<AnimatedNumber value={Math.round(totalPL)} /> CR</span>
          </div>
          <div className="card-hover" style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#555', fontSize: '12px' }}>Portfolio Value</span>
            <span style={{ fontSize: '18px', fontWeight: '600', color: '#fff' }}><AnimatedNumber value={Math.round(totalValue)} /> CR</span>
          </div>
          <div className="card-hover" style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#555', fontSize: '12px' }}>Available Credits</span>
            <span style={{ fontSize: '18px', fontWeight: '600', color: '#4ade80' }}><AnimatedNumber value={profile.credits || 0} /> CR</span>
          </div>
        </div>

        {/* Col 3: Activity Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LiveDot />
            <div style={{ color: '#888', fontSize: '11px', letterSpacing: '1px' }}>RECENT ACTIVITY</div>
          </div>
          <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '16px', flex: 1, overflow: 'auto' }}>
            {activity.length === 0 ? (
              <p style={{ color: '#444', fontSize: '13px', textAlign: 'center' }}>No activity yet.</p>
            ) : (
              activity.map((a, i) => {
                let icon, iconBg, iconColor, text
                if (a.type === 'buy') {
                  icon = '↑'; iconBg = '#0f2a18'; iconColor = '#4ade80'
                  text = <>Bought <b style={{ color: '#fff' }}>{a.shares.toFixed(2)} shares</b> of <b style={{ color: '#fff' }}>{a.artist_name}</b> at {Math.round(a.price_per_share).toLocaleString()} CR</>
                } else if (a.type === 'sell') {
                  icon = '↓'; iconBg = '#1a0a0a'; iconColor = '#f87171'
                  text = <>Sold <b style={{ color: '#fff' }}>{a.shares.toFixed(2) } shares</b> of <b style={{ color: '#fff' }}>{a.artist_name}</b> at {Math.round(a.price_per_share).toLocaleString()} CR</>
                } else {
                  icon = '🏆'; iconBg = '#1a1a0a'; iconColor = '#fbbf24'
                  text = <>Earned <b style={{ color: '#fff' }}>First Investor</b> badge for <b style={{ color: '#fff' }}>{a.artist_name}</b> + 50 CR</>
                }
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderBottom: i < activity.length - 1 ? '0.5px solid #141414' : 'none' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '500', flexShrink: 0 }}>
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

      </div>

    </main>
  )
}