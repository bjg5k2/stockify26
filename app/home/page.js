'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import { EQVisualizer, LiveDot, AnimatedNumber, Skeleton } from '../components/FX'

const ARTIST_POOL = [
  { id: '74KM79TiuVKeVCqs8QtB0B', name: 'Sabrina Carpenter' },
  { id: '4q3ewBCX7sLwd24euuV69X', name: 'Bad Bunny' },
  { id: '3l0CmX0FuQjFxr8SK7Vqag', name: 'Clairo' },
  { id: '3TVXtAsR1Inumwj472S9r4', name: 'Drake' },
  { id: '4lxfqrEsLX6N1N4OCSkILp', name: 'Phil Collins' },
  { id: '4FGPzWzgjURDNT7JQ8pYgH', name: 'Zach Top' },
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
  const [aodStats, setAodStats] = useState({ investors: 0, totalInvested: 0, firstInvestor: null, priceChangePct: null })
  const [stats, setStats] = useState({ totalInvested: 0, totalUsers: 0, totalBadges: 0, totalArtists: 0 })
  const [winner, setWinner] = useState(null)
  const [loser, setLoser] = useState(null)
  const [feed, setFeed] = useState([])
  const [dailyChallenges, setDailyChallenges] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

const getPrice = (artist) => {
    return Math.max(10, Math.round((Math.sqrt(artist.followers) * (artist.popularity / 10) + (artist.popularity * artist.popularity / 200)) / 10))
  }
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      const { data: myProfileData } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setMyProfile(myProfileData)

      const { data: adminProfiles } = await supabase
        .from('profiles').select('id').eq('is_admin', true)
      const adminIds = (adminProfiles || []).map(p => p.id)

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

      // Artist of the Day stats: investors, total invested, first investor, price change
      const { data: aodHoldings } = await supabase
        .from('holdings').select('user_id, shares, buy_price').eq('artist_id', pick.id)
      const realAodHoldings = (aodHoldings || []).filter(h => !adminIds.includes(h.user_id))
      const aodInvestors = realAodHoldings.length
      const aodTotalInvested = realAodHoldings.reduce((sum, h) => sum + h.shares * h.buy_price, 0)

      let firstInvestorUsername = null
      const { data: firstBadge } = await supabase
        .from('badges').select('user_id').eq('artist_id', pick.id).eq('badge_type', 'first_investor').maybeSingle()
      if (firstBadge) {
        const { data: p } = await supabase.from('profiles').select('username').eq('id', firstBadge.user_id).single()
        firstInvestorUsername = p?.username || null
      }

      const { data: aodSnaps } = await supabase
        .from('artist_snapshots').select('*').eq('artist_id', pick.id)
        .order('snapshot_date', { ascending: true })
      let priceChangePct = null
      if (aodSnaps && aodSnaps.length >= 2) {
const getP = (s) => {
          const pop = s.popularity ?? 91
          return Math.max(10, Math.round((Math.sqrt(s.monthly_listeners) * (pop / 10) + (pop * pop / 200)) / 10))
        }
        const firstPrice = getP(aodSnaps[0])
        const lastPrice = getP(aodSnaps[aodSnaps.length - 1])
        priceChangePct = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0
      }

      setAodStats({
        investors: aodInvestors,
        totalInvested: aodTotalInvested,
        firstInvestor: firstInvestorUsername,
        priceChangePct,
      })

      // Daily Challenges
      const { data: { session } } = await supabase.auth.getSession()
      const claimRes = await fetch('/api/challenges/claim', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const claimData = await claimRes.json()
      setDailyChallenges(claimData.challenges || [])
      if (claimData.new_credits !== myProfileData.credits) {
        setMyProfile({ ...myProfileData, credits: claimData.new_credits })
      }

      const { data: allProfiles } = await supabase.from('profiles').select('id, is_admin')
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
        totalUsers: (allProfiles || []).filter(p => !p.is_admin).length,
        totalBadges: (allBadges || []).length,
        totalArtists: uniqueArtists.size,
      })

      const byArtist = {}
      ;(snapshotsAll || []).forEach(s => {
        if (!byArtist[s.artist_id]) byArtist[s.artist_id] = []
        byArtist[s.artist_id].push(s)
      })

      const growthList = Object.entries(byArtist)
        .filter(([, snaps]) => snaps.length >= 2 && snaps[snaps.length - 1].popularity > 30)
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
        .gt('shares', 0)
        .order('created_at', { ascending: false }).limit(20)

      const { data: badgeData } = await supabase
        .from('badges').select('*')
        .order('awarded_at', { ascending: false }).limit(20)

      const realTx = (txData || []).filter(t => !adminIds.includes(t.user_id))
      const realBadges = (badgeData || []).filter(b => !adminIds.includes(b.user_id))

      const userIds = [...new Set([...realTx.map(t => t.user_id), ...realBadges.map(b => b.user_id)])]
      const { data: profilesData } = await supabase
        .from('profiles').select('id, username').in('id', userIds)

      const usernameMap = {}
      ;(profilesData || []).forEach(p => { usernameMap[p.id] = p.username })

      const txItems = realTx.map(tx => ({
        type: tx.type,
        username: usernameMap[tx.user_id] || 'unknown',
        artist_id: tx.artist_id,
        artist_name: tx.artist_name,
        shares: tx.shares,
        total: tx.total,
        timestamp: tx.created_at,
      }))
      const badgeItems = realBadges.map(b => ({
        type: 'badge',
        username: usernameMap[b.user_id] || 'unknown',
        artist_id: b.artist_id,
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

  const CARD_HEIGHT = '660px'
  const MOVER_HEIGHT = '380px'

  if (loading) return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh', fontFamily: 'sans-serif', color: '#fff' }}>
      <nav style={{ borderBottom: '0.5px solid #1a1a1a', padding: '20px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ color: '#4ade80', fontSize: '26px', fontWeight: '500' }}>Stockify</div>
          <EQVisualizer />
        </div>
      </nav>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr 1fr', gap: '20px', padding: '24px 48px' }}>
        <Skeleton height={CARD_HEIGHT} borderRadius="14px" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {[1, 2, 3, 4].map(i => <Skeleton key={i} height="90px" borderRadius="12px" />)}
          </div>
          <Skeleton height="100px" borderRadius="12px" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Skeleton height={MOVER_HEIGHT} borderRadius="14px" />
            <Skeleton height={MOVER_HEIGHT} borderRadius="14px" />
          </div>
        </div>
        <Skeleton height={CARD_HEIGHT} borderRadius="14px" />
      </div>
    </main>
  )

  const myInitials = myProfile?.username?.slice(0, 2).toUpperCase() || 'U'
  const aodPrice = artistOfDay ? getPrice(artistOfDay) : null

  const clampStyle = (lines) => ({
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: lines,
    overflow: 'hidden',
  })

  return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh', fontFamily: 'sans-serif', color: '#fff', paddingBottom: '42px' }}>

      {/* Navbar */}
      <nav style={{ borderBottom: '0.5px solid #1a1a1a', padding: '20px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div onClick={() => router.push('/home')} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
          <div style={{ color: '#4ade80', fontSize: '26px', fontWeight: '500' }}>Stockify</div>
          <EQVisualizer />
        </div>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr 1fr', gap: '20px', padding: '24px 48px' }}>

        {/* Col 1 (20%): Artist of the Day */}
        {artistOfDay && (
          <div
            onClick={() => router.push(`/artist/${artistOfDay.id}`)}
            className="card-hover"
            style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', height: CARD_HEIGHT, background: '#111', display: 'flex', flexDirection: 'column' }}
          >
            {artistOfDay.image && (
              <img src={artistOfDay.image} alt={artistOfDay.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }} />
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,10,10,0.97) 35%, rgba(10,10,10,0.3) 100%)' }} />
            <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(0,0,0,0.6)', color: '#fbbf24', fontSize: '11px', fontWeight: '600', letterSpacing: '1px', padding: '4px 10px', borderRadius: '6px' }}>⭐ ARTIST OF THE DAY</div>
            <div style={{ position: 'relative', marginTop: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h1 style={{ color: '#fff', fontSize: '20px', fontWeight: '600', letterSpacing: '-0.5px' }}>{artistOfDay.name}</h1>
              {bio && <p style={{ color: '#fff', fontSize: '12px', lineHeight: '1.5', ...clampStyle(3) }}>{bio}</p>}

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px', color: '#ccc', padding: '8px 0', borderTop: '0.5px solid rgba(255,255,255,0.08)', borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
                <div>👥 {aodStats.investors} investor{aodStats.investors !== 1 ? 's' : ''}</div>
                <div>💰 {Math.round(aodStats.totalInvested).toLocaleString()} CR invested</div>
                <div style={{ gridColumn: 'span 2', color: aodStats.firstInvestor ? '#fbbf24' : '#888' }}>
                  {aodStats.firstInvestor ? `🏆 First investor: @${aodStats.firstInvestor}` : '🏆 No investors yet — be the first!'}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                <div>
                  <div>
                    <span style={{ color: '#fff', fontSize: '17px', fontWeight: '600' }}><AnimatedNumber value={aodPrice || 0} /></span>
                    <span style={{ color: '#4ade80', fontSize: '11px', fontWeight: '500' }}> CR</span>
                  </div>
                  {aodStats.priceChangePct !== null && (
                    <div style={{ color: aodStats.priceChangePct >= 0 ? '#4ade80' : '#f87171', fontSize: '11px', fontWeight: '500', marginTop: '2px' }}>
                      {aodStats.priceChangePct >= 0 ? '▲' : '▼'} {Math.abs(aodStats.priceChangePct).toFixed(1)}% since tracking
                    </div>
                  )}
                </div>
                <button style={{ background: '#4ade80', color: '#000', fontSize: '12px', fontWeight: '500', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
                  View & Invest
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Col 2 (60%): Stats + Daily Challenges + Heating Up / Cooling Off */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Platform Stats row of 4 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {[
              { label: 'Total CR Invested', val: Math.round(stats.totalInvested), suffix: ' CR', color: '#4ade80' },
              { label: 'Total Users', val: stats.totalUsers, suffix: '', color: '#fff' },
              { label: 'Badges Awarded', val: stats.totalBadges, suffix: '', color: '#fbbf24' },
              { label: 'Artists Tracked', val: stats.totalArtists, suffix: '', color: '#fff' },
            ].map(s => (
              <div key={s.label} className="card-hover" style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '18px', textAlign: 'center' }}>
                <div style={{ color: s.color, fontSize: '24px', fontWeight: '600' }}>
                  <AnimatedNumber value={s.val} />{s.suffix}
                </div>
                <div style={{ color: '#555', fontSize: '11px', marginTop: '6px', letterSpacing: '0.5px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Daily Challenges */}
          {dailyChallenges.length > 0 && (
            <div className="card-hover" style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '14px 18px' }}>
              <div style={{ color: '#888', fontSize: '10px', letterSpacing: '1px', marginBottom: '10px' }}>DAILY CHALLENGES</div>
              {dailyChallenges.map((c, i) => (
                <div key={c.type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < dailyChallenges.length - 1 ? '0.5px solid #141414' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '16px' }}>{c.completed ? '✅' : '🎯'}</div>
                    <div style={{ color: '#fff', fontSize: '13px' }}>{c.description}</div>
                  </div>
                  <div style={{ color: c.completed ? '#4ade80' : '#fbbf24', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                    {c.completed ? `+${c.rewardEarned} CR` : `+${c.reward} CR`}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Heating Up / Cooling Off side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {winner ? (
              <div
                onClick={() => router.push(`/artist/${winner.artist_id}`)}
                className="card-hover"
                style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', height: MOVER_HEIGHT, background: '#111' }}
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
            ) : (
              <div className="card-hover" style={{ borderRadius: '14px', height: MOVER_HEIGHT, background: '#0f0f0f', border: '0.5px dashed #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: '13px', textAlign: 'center', padding: '16px' }}>
                Not enough data yet for Heating Up
              </div>
            )}

            {loser ? (
              <div
                onClick={() => router.push(`/artist/${loser.artist_id}`)}
                className="card-hover"
                style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', height: MOVER_HEIGHT, background: '#111' }}
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
            ) : (
              <div className="card-hover" style={{ borderRadius: '14px', height: MOVER_HEIGHT, background: '#0f0f0f', border: '0.5px dashed #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: '13px', textAlign: 'center', padding: '16px' }}>
                Not enough data yet for Cooling Off
              </div>
            )}
          </div>
        </div>

        {/* Col 3 (20%): Live Activity Feed */}
        <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '14px', padding: '18px', height: CARD_HEIGHT, overflow: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <LiveDot />
            <div style={{ color: '#888', fontSize: '11px', letterSpacing: '1px' }}>LIVE ACTIVITY</div>
          </div>
          {feed.length === 0 ? (
            <p style={{ color: '#444', fontSize: '13px' }}>No activity yet.</p>
          ) : (
            feed.map((a, i) => {
              let icon, iconBg, iconColor, text
              if (a.type === 'buy') {
                icon = '↑'; iconBg = '#0f2a18'; iconColor = '#4ade80'
                text = <><b style={{ color: '#fff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }} onClick={() => router.push(`/profile/${a.username}`)}>{a.username}</b> bought <b style={{ color: '#fff' }}>{a.shares.toFixed(2)} shares</b> of <b style={{ color: '#fff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }} onClick={() => router.push(`/artist/${a.artist_id}`)}>{a.artist_name}</b></>
              } else if (a.type === 'sell') {
                icon = '↓'; iconBg = '#1a0a0a'; iconColor = '#f87171'
                text = <><b style={{ color: '#fff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }} onClick={() => router.push(`/profile/${a.username}`)}>{a.username}</b> sold <b style={{ color: '#fff' }}>{a.shares.toFixed(2)} shares</b> of <b style={{ color: '#fff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }} onClick={() => router.push(`/artist/${a.artist_id}`)}>{a.artist_name}</b></>
              } else {
                icon = '🏆'; iconBg = '#1a1a0a'; iconColor = '#fbbf24'
                text = <><b style={{ color: '#fff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }} onClick={() => router.push(`/profile/${a.username}`)}>{a.username}</b> earned <b style={{ color: '#fff' }}>First Investor</b> for <b style={{ color: '#fff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }} onClick={() => router.push(`/artist/${a.artist_id}`)}>{a.artist_name}</b></>
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