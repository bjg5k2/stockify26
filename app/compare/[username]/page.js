'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { EQVisualizer, AnimatedNumber, Skeleton } from '../../components/FX'
import NotificationBell from '../../components/NotificationBell'

export default function ComparePage() {
  const [myProfile, setMyProfile] = useState(null)
  const [theirProfile, setTheirProfile] = useState(null)
  const [myHoldings, setMyHoldings] = useState([])
  const [theirHoldings, setTheirHoldings] = useState([])
  const [artistMap, setArtistMap] = useState({})
  const [mySnapshots, setMySnapshots] = useState([])
  const [theirSnapshots, setTheirSnapshots] = useState([])
  const [myBadgeCount, setMyBadgeCount] = useState(0)
  const [theirBadgeCount, setTheirBadgeCount] = useState(0)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { username } = useParams()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      const [
        { data: myProfileData },
        { data: theirProfileData, error: theirError },
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('profiles').select('*').eq('username', username).single(),
      ])

      if (theirError || !theirProfileData) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setMyProfile(myProfileData)
      setTheirProfile(theirProfileData)

      const [
        { data: myHoldingsData },
        { data: theirHoldingsData },
        { data: myBadges },
        { data: theirBadges },
        { data: mySnaps },
        { data: theirSnaps },
      ] = await Promise.all([
        supabase.from('holdings').select('*').eq('user_id', user.id),
        supabase.from('holdings').select('*').eq('user_id', theirProfileData.id),
        supabase.from('badges').select('id').eq('user_id', user.id),
        supabase.from('badges').select('id').eq('user_id', theirProfileData.id),
        supabase.from('portfolio_snapshots').select('snapshot_date, total_value, credits')
          .eq('user_id', user.id).order('snapshot_date', { ascending: true }),
        supabase.from('portfolio_snapshots').select('snapshot_date, total_value, credits')
          .eq('user_id', theirProfileData.id).order('snapshot_date', { ascending: true }),
      ])

      setMyHoldings(myHoldingsData || [])
      setTheirHoldings(theirHoldingsData || [])
      setMyBadgeCount((myBadges || []).length)
      setTheirBadgeCount((theirBadges || []).length)
      setMySnapshots(mySnaps || [])
      setTheirSnapshots(theirSnaps || [])

      const allArtistIds = [...new Set([
        ...(myHoldingsData || []).map(h => h.artist_id),
        ...(theirHoldingsData || []).map(h => h.artist_id),
      ])]
      const map = {}
      await Promise.all(allArtistIds.map(async id => {
        const res = await fetch(`/api/artist?id=${id}`)
        const data = await res.json()
        if (data.artist) map[id] = data.artist
      }))
      setArtistMap(map)
      setLoading(false)
    }
    getData()
  }, [username])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const getPrice = (artist) => Math.max(10, Math.round(Math.sqrt(artist.followers) / 2 + (artist.popularity * artist.popularity) / 8))

  const computeStats = (holdings, credits) => {
    const portfolioValue = holdings.reduce((sum, h) => {
      const a = artistMap[h.artist_id]
      return sum + (a ? h.shares * getPrice(a) : 0)
    }, 0)
    const netWorth = (credits || 0) + portfolioValue
    const sorted = [...holdings].sort((a, b) => {
      const aA = artistMap[a.artist_id]
      const bA = artistMap[b.artist_id]
      return (bA ? b.shares * getPrice(bA) : 0) - (aA ? a.shares * getPrice(aA) : 0)
    })
    return { portfolioValue, netWorth, sortedHoldings: sorted, bestHolding: sorted[0] || null }
  }

  const buildChartData = () => {
    const myMap = {}
    mySnapshots.forEach(s => { myMap[s.snapshot_date] = (s.total_value || 0) + (s.credits || 0) })
    const theirMap = {}
    theirSnapshots.forEach(s => { theirMap[s.snapshot_date] = (s.total_value || 0) + (s.credits || 0) })
    const allDates = [...new Set([...Object.keys(myMap), ...Object.keys(theirMap)])].sort()
    return allDates.map(date => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
      mine: myMap[date] ?? null,
      theirs: theirMap[date] ?? null,
    }))
  }

  const getOverlaps = () => {
    const myIds = new Set(myHoldings.map(h => h.artist_id))
    return theirHoldings.filter(h => myIds.has(h.artist_id))
  }

  if (loading) return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh', fontFamily: 'sans-serif', color: '#fff' }}>
      <nav style={{ borderBottom: '0.5px solid #1a1a1a', padding: '20px 48px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ color: '#4ade80', fontSize: '26px', fontWeight: '500' }}>Stockify</div>
        <EQVisualizer />
      </nav>
      <div style={{ padding: '32px 48px 74px', maxWidth: '1100px', margin: '0 auto' }}>
        <Skeleton height="120px" borderRadius="16px" style={{ marginBottom: '24px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Skeleton height="160px" borderRadius="12px" />
            <Skeleton height="100px" borderRadius="12px" />
            <Skeleton height="200px" borderRadius="12px" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Skeleton height="160px" borderRadius="12px" />
            <Skeleton height="100px" borderRadius="12px" />
            <Skeleton height="200px" borderRadius="12px" />
          </div>
        </div>
        <Skeleton height="180px" borderRadius="12px" />
      </div>
    </main>
  )

  if (notFound) return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', flexDirection: 'column', gap: '16px' }}>
      <p style={{ color: '#555', fontSize: '16px' }}>User not found.</p>
      <button onClick={() => router.push('/leaderboard')} style={{ background: '#4ade80', color: '#000', fontSize: '14px', fontWeight: '500', padding: '12px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
        Back to Leaderboard
      </button>
    </main>
  )

  const myInitials = myProfile?.username?.slice(0, 2).toUpperCase() || 'U'
  const theirInitials = theirProfile?.username?.slice(0, 2).toUpperCase() || 'U'
  const myStats = computeStats(myHoldings, myProfile?.credits)
  const theirStats = computeStats(theirHoldings, theirProfile?.credits)
  const chartData = buildChartData()
  const overlaps = getOverlaps()

  const ahead = myStats.netWorth > theirStats.netWorth ? 'you' : myStats.netWorth < theirStats.netWorth ? 'them' : 'tied'

  const StatRow = ({ label, value, highlight }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '0.5px solid #111' }}>
      <span style={{ color: '#555', fontSize: '13px' }}>{label}</span>
      <span style={{ color: highlight ? '#4ade80' : '#fff', fontSize: '13px', fontWeight: '500' }}>{value}</span>
    </div>
  )

  const UserColumn = ({ profile, holdings, stats, badgeCount, accentColor, snapshots }) => {
    const initials = profile.username?.slice(0, 2).toUpperCase() || 'U'
    const bestArtist = stats.bestHolding ? artistMap[stats.bestHolding.artist_id] : null
    const bestPrice = bestArtist ? getPrice(bestArtist) : 0
    const bestValue = stats.bestHolding ? stats.bestHolding.shares * bestPrice : 0
    const plPct = stats.bestHolding && stats.bestHolding.buy_price > 0
      ? (((bestPrice - stats.bestHolding.buy_price) / stats.bestHolding.buy_price) * 100).toFixed(1)
      : null

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Stats card */}
        <div style={{ background: '#0f0f0f', border: `0.5px solid ${accentColor === '#4ade80' ? '#1c2a1c' : '#1c1c2a'}`, borderRadius: '12px', padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: accentColor === '#4ade80' ? '#0f2a18' : '#0f1a2a', border: `0.5px solid ${accentColor === '#4ade80' ? '#1a4a2a' : '#1a2a4a'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentColor, fontSize: '14px', fontWeight: '600', flexShrink: 0 }}>
              {initials}
            </div>
            <div>
              <div style={{ color: '#fff', fontSize: '16px', fontWeight: '600' }}>{profile.username}</div>
              <div style={{ color: accentColor, fontSize: '12px', marginTop: '1px' }}>{accentColor === '#4ade80' ? 'You' : 'Opponent'}</div>
            </div>
          </div>
          <StatRow label="Net Worth" value={`${Math.round(stats.netWorth).toLocaleString()} CR`} highlight />
          <StatRow label="Portfolio Value" value={`${Math.round(stats.portfolioValue).toLocaleString()} CR`} />
          <StatRow label="Liquid CR" value={`${(profile.credits || 0).toLocaleString()} CR`} />
          <StatRow label="Artists" value={stats.sortedHoldings.length} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0' }}>
            <span style={{ color: '#555', fontSize: '13px' }}>Badges</span>
            <span style={{ color: '#fff', fontSize: '13px', fontWeight: '500' }}>{badgeCount}</span>
          </div>
        </div>

        {/* Best holding card */}
        {stats.bestHolding && bestArtist ? (
          <div
            onClick={() => router.push(`/artist/${stats.bestHolding.artist_id}`)}
            className="card-hover"
            style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '18px', cursor: 'pointer' }}
          >
            <div style={{ color: '#888', fontSize: '11px', letterSpacing: '0.5px', marginBottom: '12px' }}>TOP POSITION</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {bestArtist.image ? (
                <img src={bestArtist.image} alt={bestArtist.name} style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>🎵</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#fff', fontSize: '14px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bestArtist.name}</div>
                <div style={{ color: '#555', fontSize: '12px', marginTop: '2px' }}>{stats.bestHolding.shares.toFixed(2)} shares</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ color: '#fff', fontSize: '14px', fontWeight: '500' }}>{Math.round(bestValue).toLocaleString()} CR</div>
                {plPct !== null && (
                  <div style={{ color: parseFloat(plPct) >= 0 ? '#4ade80' : '#f87171', fontSize: '12px', marginTop: '2px' }}>
                    {parseFloat(plPct) >= 0 ? '+' : ''}{plPct}%
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '18px' }}>
            <div style={{ color: '#888', fontSize: '11px', letterSpacing: '0.5px', marginBottom: '12px' }}>TOP POSITION</div>
            <p style={{ color: '#444', fontSize: '13px' }}>No holdings yet.</p>
          </div>
        )}

        {/* Holdings list */}
        <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '18px' }}>
          <div style={{ color: '#888', fontSize: '11px', letterSpacing: '0.5px', marginBottom: '12px' }}>ALL HOLDINGS</div>
          {stats.sortedHoldings.length === 0 ? (
            <p style={{ color: '#444', fontSize: '13px' }}>No holdings yet.</p>
          ) : (
            stats.sortedHoldings.map((h, i) => {
              const a = artistMap[h.artist_id]
              if (!a) return null
              const price = getPrice(a)
              const value = h.shares * price
              const pl = h.buy_price > 0 ? (((price - h.buy_price) / h.buy_price) * 100).toFixed(1) : null
              return (
                <div
                  key={h.artist_id}
                  onClick={() => router.push(`/artist/${h.artist_id}`)}
                  className="card-hover"
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderBottom: i < stats.sortedHoldings.length - 1 ? '0.5px solid #141414' : 'none', cursor: 'pointer' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#ddd', fontSize: '13px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                    <div style={{ color: '#555', fontSize: '11px', marginTop: '1px' }}>{h.shares.toFixed(2)} shares</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ color: '#fff', fontSize: '13px', fontWeight: '500' }}>{Math.round(value).toLocaleString()} CR</div>
                    {pl !== null && (
                      <div style={{ color: parseFloat(pl) >= 0 ? '#4ade80' : '#f87171', fontSize: '11px', marginTop: '1px' }}>
                        {parseFloat(pl) >= 0 ? '+' : ''}{pl}%
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    )
  }

  return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh', fontFamily: 'sans-serif', color: '#fff', paddingBottom: '74px' }}>

      {/* Navbar */}
      <nav style={{ borderBottom: '0.5px solid #1a1a1a', padding: '20px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div onClick={() => router.push('/home')} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
          <div style={{ color: '#4ade80', fontSize: '26px', fontWeight: '500' }}>Stockify</div>
          <EQVisualizer />
        </div>
        <div style={{ display: 'flex', gap: '36px', alignItems: 'center' }}>
          <span onClick={() => router.push('/home')} style={{ color: '#666', fontSize: '16px', cursor: 'pointer' }}>Home</span>
          <span onClick={() => router.push('/dashboard')} style={{ color: '#666', fontSize: '16px', cursor: 'pointer' }}>Portfolio</span>
          <span onClick={() => router.push('/explore')} style={{ color: '#666', fontSize: '16px', cursor: 'pointer' }}>Explore</span>
          <span onClick={() => router.push('/leaderboard')} style={{ color: '#666', fontSize: '16px', cursor: 'pointer' }}>Leaderboard</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#0f2a18', border: '0.5px solid #1a4a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80', fontSize: '13px', fontWeight: '500' }}>{myInitials}</div>
            <span onClick={() => router.push(`/profile/${myProfile?.username}`)} style={{ color: '#aaa', fontSize: '16px', cursor: 'pointer' }}>{myProfile?.username}</span>
          </div>
          <NotificationBell />
          <button onClick={handleLogout} style={{ background: 'transparent', border: '0.5px solid #2a2a2a', color: '#666', fontSize: '14px', padding: '7px 16px', borderRadius: '6px', cursor: 'pointer' }}>Log out</button>
        </div>
      </nav>

      <div style={{ padding: '32px 48px', maxWidth: '1100px', margin: '0 auto' }}>

        {/* VS Banner */}
        <div style={{ padding: '28px 32px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(74,222,128,0.08), rgba(10,10,10,0.4))', border: '0.5px solid rgba(74,222,128,0.18)', backdropFilter: 'blur(12px)', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>

            {/* Me */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#0f2a18', border: '2px solid #1a4a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80', fontSize: '18px', fontWeight: '600', flexShrink: 0 }}>{myInitials}</div>
              <div>
                <div style={{ color: '#fff', fontSize: '20px', fontWeight: '600' }}>{myProfile?.username}</div>
                <div style={{ color: '#4ade80', fontSize: '22px', fontWeight: '600', marginTop: '2px' }}>
                  <AnimatedNumber value={Math.round(myStats.netWorth)} /> <span style={{ fontSize: '14px' }}>CR</span>
                </div>
              </div>
            </div>

            {/* Center */}
            <div style={{ textAlign: 'center', flexShrink: 0, padding: '0 24px' }}>
              <div style={{ color: '#fff', fontSize: '36px', fontWeight: '700', letterSpacing: '-1px', opacity: 0.15 }}>VS</div>
              <div style={{ marginTop: '6px', fontSize: '12px', fontWeight: '500', color: ahead === 'you' ? '#4ade80' : ahead === 'them' ? '#f87171' : '#888' }}>
                {ahead === 'you' ? "you're ahead" : ahead === 'them' ? "they're ahead" : 'tied'}
              </div>
            </div>

            {/* Them */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '14px', justifyContent: 'flex-end', flexDirection: 'row-reverse' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#0f1a2a', border: '2px solid #1a2a4a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa', fontSize: '18px', fontWeight: '600', flexShrink: 0 }}>{theirInitials}</div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#fff', fontSize: '20px', fontWeight: '600' }}>{theirProfile?.username}</div>
                <div style={{ color: '#60a5fa', fontSize: '22px', fontWeight: '600', marginTop: '2px' }}>
                  <AnimatedNumber value={Math.round(theirStats.netWorth)} /> <span style={{ fontSize: '14px' }}>CR</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Two-column comparison */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }}>
          <UserColumn
            profile={myProfile}
            holdings={myHoldings}
            stats={myStats}
            badgeCount={myBadgeCount}
            accentColor="#4ade80"
            snapshots={mySnapshots}
          />
          <UserColumn
            profile={theirProfile}
            holdings={theirHoldings}
            stats={theirStats}
            badgeCount={theirBadgeCount}
            accentColor="#60a5fa"
            snapshots={theirSnapshots}
          />
        </div>

        {/* Net worth over time */}
        <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '18px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ color: '#888', fontSize: '11px', letterSpacing: '0.5px' }}>NET WORTH OVER TIME</div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#888', fontSize: '12px' }}>
                <span style={{ width: '10px', height: '2px', background: '#4ade80', display: 'inline-block', borderRadius: '2px' }} />
                {myProfile?.username}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#888', fontSize: '12px' }}>
                <span style={{ width: '10px', height: '2px', background: '#60a5fa', display: 'inline-block', borderRadius: '2px' }} />
                {theirProfile?.username}
              </span>
            </div>
          </div>
          {chartData.length >= 2 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="myGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4ade80" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="theirGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: '#444', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  hide
                  domain={([dataMin, dataMax]) => {
                    const padding = (dataMax - dataMin) * 0.1 || dataMax * 0.05
                    return [Math.max(0, dataMin - padding), dataMax + padding]
                  }}
                />
                <Tooltip
                  contentStyle={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  formatter={(val, name) => [`${Math.round(val).toLocaleString()} CR`, name === 'mine' ? myProfile?.username : theirProfile?.username]}
                  labelStyle={{ color: '#555' }}
                />
                <Area type="monotone" dataKey="mine" stroke="#4ade80" strokeWidth={2} fill="url(#myGrad)" dot={false} activeDot={{ r: 4 }} connectNulls />
                <Area type="monotone" dataKey="theirs" stroke="#60a5fa" strokeWidth={2} fill="url(#theirGrad)" dot={false} activeDot={{ r: 4 }} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: '#555', fontSize: '13px', padding: '20px 0' }}>Not enough history yet. Check back after a few market snapshots.</p>
          )}
        </div>

        {/* Overlapping artists */}
        <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '18px' }}>
          <div style={{ color: '#888', fontSize: '11px', letterSpacing: '0.5px', marginBottom: '14px' }}>ARTISTS IN COMMON</div>
          {overlaps.length === 0 ? (
            <p style={{ color: '#444', fontSize: '13px' }}>No artists in common.</p>
          ) : (
            overlaps.map((theirH, i) => {
              const a = artistMap[theirH.artist_id]
              if (!a) return null
              const price = getPrice(a)
              const myH = myHoldings.find(h => h.artist_id === theirH.artist_id)
              return (
                <div
                  key={theirH.artist_id}
                  onClick={() => router.push(`/artist/${theirH.artist_id}`)}
                  className="card-hover"
                  style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 0', borderBottom: i < overlaps.length - 1 ? '0.5px solid #141414' : 'none', cursor: 'pointer' }}
                >
                  {a.image ? (
                    <img src={a.image} alt={a.name} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>🎵</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#ddd', fontSize: '13px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                    <div style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>{price.toLocaleString()} CR / share</div>
                  </div>
                  <div style={{ display: 'flex', gap: '32px', flexShrink: 0 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#4ade80', fontSize: '13px', fontWeight: '500' }}>{myH?.shares.toFixed(2) ?? '0'}</div>
                      <div style={{ color: '#555', fontSize: '10px', marginTop: '1px' }}>{myProfile?.username}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#60a5fa', fontSize: '13px', fontWeight: '500' }}>{theirH.shares.toFixed(2)}</div>
                      <div style={{ color: '#555', fontSize: '10px', marginTop: '1px' }}>{theirProfile?.username}</div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

      </div>
    </main>
  )
}
