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
  const [movers, setMovers] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('value')
  const [sortDir, setSortDir] = useState('desc')

  const [expandedId, setExpandedId] = useState(null)
  const [tradeType, setTradeType] = useState('buy')
  const [tradeMode, setTradeMode] = useState('cr')
  const [tradeInput, setTradeInput] = useState('')
  const [tradeMessage, setTradeMessage] = useState({ text: '', success: true })
  const [pendingSell, setPendingSell] = useState(null)

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

      // Market Movers (same logic as explore page)
      const { data: snapshotsAll } = await supabase
        .from('artist_snapshots')
        .select('*')
        .order('snapshot_date', { ascending: true })

      const byArtist = {}
      ;(snapshotsAll || []).forEach(s => {
        if (!byArtist[s.artist_id]) byArtist[s.artist_id] = []
        byArtist[s.artist_id].push(s)
      })

      const moversRaw = Object.entries(byArtist)
        .filter(([, snaps]) => snaps.length >= 2)
        .map(([id, snaps]) => {
          const first = snaps[0]
          const last = snaps[snaps.length - 1]
          const growth = first.monthly_listeners > 0
            ? ((last.monthly_listeners - first.monthly_listeners) / first.monthly_listeners) * 100
            : 0
          return { artist_id: id, artist_name: last.artist_name, growth }
        })
        .filter(m => m.growth > 0)
        .sort((a, b) => b.growth - a.growth)
        .slice(0, 4)

      const moversWithData = await Promise.all(
        moversRaw.map(async (m) => {
          try {
            const res = await fetch(`/api/artist?id=${m.artist_id}`)
            const data = await res.json()
            return {
              ...m,
              image: data.artist?.image || null,
              price: data.artist ? getPrice(data.artist) : null,
            }
          } catch {
            return { ...m, image: null, price: null }
          }
        })
      )
      setMovers(moversWithData)

      setLoading(false)
    }
    getData()
  }, [])

  const getPrice = (artist) => {
    return Math.round((Math.sqrt(artist.followers) * (artist.popularity / 10) + (artist.popularity * artist.popularity / 200)) / 10)
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

  const handleSort = (newSort) => {
    if (newSort === sortBy) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(newSort)
      setSortDir('desc')
    }
  }

  const getSortedHoldings = () => {
    const sorted = [...holdings]
    const dir = sortDir === 'desc' ? -1 : 1

    if (sortBy === 'value') {
      return sorted.sort((a, b) => {
        const aArtist = artistData[a.artist_id]
        const bArtist = artistData[b.artist_id]
        const aVal = aArtist ? a.shares * getPrice(aArtist) : 0
        const bVal = bArtist ? b.shares * getPrice(bArtist) : 0
        return (bVal - aVal) * dir
      })
    }
    if (sortBy === 'date') {
      return sorted.sort((a, b) => (new Date(b.created_at) - new Date(a.created_at)) * dir)
    }
    if (sortBy === 'az') {
      return sorted.sort((a, b) => a.artist_name.localeCompare(b.artist_name) * dir)
    }
    return sorted
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  // --- Trade panel logic ---
  const showTradeMessage = (text, success = true) => {
    setTradeMessage({ text, success })
    setTimeout(() => setTradeMessage({ text: '', success: true }), 4000)
  }

  const toggleExpand = (h) => {
    if (expandedId === h.id) {
      setExpandedId(null)
    } else {
      setExpandedId(h.id)
      setTradeType('buy')
      setTradeMode('cr')
      setTradeInput('')
      setTradeMessage({ text: '', success: true })
      setPendingSell(null)
    }
  }

  const getTradeShares = (h, artist) => {
    const price = getPrice(artist)
    if (tradeMode === 'cr') return parseInt(tradeInput) / price || 0
    return parseFloat(tradeInput) || 0
  }

  const getTradeCRAmount = (h, artist) => {
    const price = getPrice(artist)
    if (tradeMode === 'cr') return parseInt(tradeInput) || 0
    return Math.floor((parseFloat(tradeInput) || 0) * price)
  }

  const handleTradeInput = (val) => {
    if (tradeMode === 'cr') setTradeInput(Math.floor(Math.abs(val)) || '')
    else setTradeInput(val)
  }

  const buyMore = async (h) => {
    const artist = artistData[h.artist_id]
    if (!artist) return
    const price = getPrice(artist)
    const shares = getTradeShares(h, artist)
    const cost = getTradeCRAmount(h, artist)
    if (!shares || shares <= 0) { showTradeMessage('Enter a valid amount.', false); return }
    if (cost > profile.credits) { showTradeMessage('Not enough credits!', false); return }

    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('holdings').update({ shares: h.shares + shares }).eq('id', h.id)
    await supabase.from('transactions').insert({
      user_id: user.id, artist_id: h.artist_id, artist_name: h.artist_name,
      type: 'buy', shares, price_per_share: price, total: cost
    })
    const newCredits = profile.credits - cost
    await supabase.from('profiles').update({ credits: newCredits }).eq('id', user.id)
    setProfile({ ...profile, credits: newCredits })
    setHoldings(holdings.map(x => x.id === h.id ? { ...x, shares: x.shares + shares } : x))
    setTradeInput('')
    showTradeMessage(`Bought ${shares.toFixed(2)} shares for ${cost.toLocaleString()} CR!`)
  }

  const requestSell = (h, sellAll = false) => {
    const artist = artistData[h.artist_id]
    if (!artist) return
    const price = getPrice(artist)
    const sharesToSell = sellAll ? h.shares : getTradeShares(h, artist)
    const returnAmount = Math.floor(sharesToSell * price)
    if (!sharesToSell || sharesToSell <= 0) { showTradeMessage('Enter a valid amount.', false); return }
    if (sharesToSell > h.shares) { showTradeMessage('Not enough shares!', false); return }
    setPendingSell({ holdingId: h.id, sharesToSell, returnAmount, sellAll })
  }

  const confirmSell = async (h) => {
    const artist = artistData[h.artist_id]
    if (!artist || !pendingSell) return
    const price = getPrice(artist)
    const { sharesToSell, returnAmount } = pendingSell

    const { data: { user } } = await supabase.auth.getUser()
    if (h.shares - sharesToSell <= 0.0001) {
      await supabase.from('holdings').delete().eq('id', h.id)
      setHoldings(holdings.filter(x => x.id !== h.id))
      setExpandedId(null)
    } else {
      await supabase.from('holdings').update({ shares: h.shares - sharesToSell }).eq('id', h.id)
      setHoldings(holdings.map(x => x.id === h.id ? { ...x, shares: x.shares - sharesToSell } : x))
    }
    await supabase.from('transactions').insert({
      user_id: user.id, artist_id: h.artist_id, artist_name: h.artist_name,
      type: 'sell', shares: sharesToSell, price_per_share: price, total: returnAmount
    })
    const newCredits = profile.credits + returnAmount
    await supabase.from('profiles').update({ credits: newCredits }).eq('id', user.id)
    setProfile({ ...profile, credits: newCredits })
    setTradeInput('')
    setPendingSell(null)
    showTradeMessage(`Sold ${sharesToSell.toFixed(2)} shares for ${returnAmount.toLocaleString()} CR!`)
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

  const chartValues = chartData.map(d => d.value)
  const chartMin = Math.min(...chartValues)
  const chartMax = Math.max(...chartValues)
  const chartRange = chartMax - chartMin
  const chartPadding = chartRange === 0 ? chartMax * 0.05 : chartRange * 0.1
  const yDomain = [Math.max(0, chartMin - chartPadding), chartMax + chartPadding]

  const sortedHoldings = getSortedHoldings()

  const getSortLabel = (key, labels) => {
    if (sortBy !== key) return labels[0]
    return sortDir === 'desc' ? labels[0] : labels[1]
  }

  const sortBtnStyle = (active) => ({
    background: active ? '#0f2a18' : '#0f0f0f',
    border: `0.5px solid ${active ? '#1a4a2a' : '#1c1c1c'}`,
    color: active ? '#4ade80' : '#555',
    fontSize: '13px',
    padding: '6px 14px',
    borderRadius: '6px',
    cursor: 'pointer',
  })

  const tabStyle = (active) => ({
    flex: 1, padding: '7px', borderRadius: '6px', border: 'none', cursor: 'pointer',
    fontSize: '12px', fontWeight: '500',
    background: active ? '#1a1a1a' : 'transparent',
    color: active ? '#fff' : '#555',
  })

  const tradeInputStyle = {
    flex: 1,
    background: '#0a0a0a',
    border: '0.5px solid #2a2a2a',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#fff',
    fontSize: '13px',
    outline: 'none'
  }

  return (
    <main style={{ background: '#0a0a0a', height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', color: '#fff', overflow: 'hidden' }}>

      {/* Navbar */}
      <nav style={{ borderBottom: '0.5px solid #1a1a1a', padding: '20px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div onClick={() => router.push('/home')} style={{ color: '#4ade80', fontSize: '26px', fontWeight: '500', letterSpacing: '-0.5px', cursor: 'pointer' }}>Stockify</div>
        <div style={{ display: 'flex', gap: '36px', alignItems: 'center' }}>
          <span onClick={() => router.push('/home')} style={{ color: '#666', fontSize: '16px', cursor: 'pointer' }}>Home</span>
          <span style={{ color: '#fff', fontSize: '16px', fontWeight: '500', cursor: 'pointer' }}>Portfolio</span>
          <span onClick={() => router.push('/explore')} style={{ color: '#666', fontSize: '16px', cursor: 'pointer' }}>Explore</span>
          <span onClick={() => router.push('/leaderboard')} style={{ color: '#666', fontSize: '16px', cursor: 'pointer' }}>Leaderboard</span>
          <span onClick={() => router.push(`/profile/${profile?.username}`)} style={{ color: '#666', fontSize: '16px', cursor: 'pointer' }}>Profile</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#0f2a18', border: '0.5px solid #1a4a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80', fontSize: '13px', fontWeight: '500' }}>{initials}</div>
            <span style={{ color: '#aaa', fontSize: '16px' }}>{profile?.username}</span>
          </div>
          <button onClick={handleLogout} style={{ background: 'transparent', border: '0.5px solid #2a2a2a', color: '#666', fontSize: '14px', padding: '7px 16px', borderRadius: '6px', cursor: 'pointer' }}>Log out</button>
        </div>
      </nav>

      {/* Body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', flex: 1, minHeight: 0 }}>

        {/* Main */}
        <div style={{ padding: '32px 48px', borderRight: '0.5px solid #141414', overflow: 'auto' }}>

          <div style={{ color: '#555', fontSize: '11px', letterSpacing: '1px', marginBottom: '12px' }}>PORTFOLIO OVERVIEW</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '4px' }}>
            <span style={{ color: '#fff', fontSize: '52px', fontWeight: '500', letterSpacing: '-2px' }}>{Math.round(totalValue).toLocaleString()}</span>
            <span style={{ color: '#4ade80', fontSize: '28px', fontWeight: '500' }}>CR</span>
          </div>
          <div style={{ color: '#555', fontSize: '13px', marginBottom: '20px' }}>Total portfolio value · updated live</div>

          {/* Chart */}
          <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ color: '#aaa', fontSize: '15px', fontWeight: '500' }}>{profile?.username}'s portfolio</span>
              <span style={{ color: up ? '#4ade80' : '#f87171', fontSize: '14px', fontWeight: '500' }}>
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
                <XAxis dataKey="date" tick={{ fill: '#444', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis hide={true} domain={yDomain} />
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
                <div style={{ color: '#555', fontSize: '13px', marginBottom: '8px' }}>{m.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ color: m.color || '#fff', fontSize: '22px', fontWeight: '500' }}>{m.val}</span>
                  <span style={{ color: '#4ade80', fontSize: '13px', fontWeight: '500' }}>CR</span>
                </div>
              </div>
            ))}
          </div>

          {/* Holdings header with sort */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ color: '#fff', fontSize: '18px', fontWeight: '500' }}>Your holdings</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button style={sortBtnStyle(sortBy === 'value')} onClick={() => handleSort('value')}>
                {getSortLabel('value', ['Value ↓', 'Value ↑'])}
              </button>
              <button style={sortBtnStyle(sortBy === 'date')} onClick={() => handleSort('date')}>
                {getSortLabel('date', ['Newest', 'Oldest'])}
              </button>
              <button style={sortBtnStyle(sortBy === 'az')} onClick={() => handleSort('az')}>
                {getSortLabel('az', ['A–Z', 'Z–A'])}
              </button>
            </div>
          </div>

          {holdings.length === 0 ? (
            <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
              <p style={{ color: '#555', fontSize: '15px', marginBottom: '16px' }}>You haven't invested in any artists yet.</p>
              <button onClick={() => router.push('/explore')} style={{ background: '#4ade80', color: '#000', fontSize: '14px', fontWeight: '500', padding: '12px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
                Explore Artists
              </button>
            </div>
          ) : (
            sortedHoldings.map(h => {
              const artist = artistData[h.artist_id]
              const currentPrice = artist ? getPrice(artist) : h.buy_price
              const currentValue = h.shares * currentPrice
              const pl = getPL(h)
              const plUp = parseFloat(pl) >= 0
              const isExpanded = expandedId === h.id
              const isPendingSell = pendingSell?.holdingId === h.id

              return (
                <div key={h.id}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 0', borderBottom: isExpanded ? 'none' : '0.5px solid #141414' }}
                  >
                    <div
                      onClick={() => router.push(`/artist/${h.artist_id}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, cursor: 'pointer' }}
                    >
                      {artist?.image ? (
                        <img src={artist.image} alt={h.artist_name} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#1a1a1a', flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#ddd', fontSize: '16px', fontWeight: '500' }}>{h.artist_name}</div>
                        <div style={{ color: '#555', fontSize: '13px', marginTop: '3px' }}>{h.shares.toFixed(2)} shares · avg {Math.round(h.buy_price).toLocaleString()} CR</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', justifyContent: 'flex-end' }}>
                          <span style={{ color: '#fff', fontSize: '16px', fontWeight: '500' }}>{Math.round(currentValue).toLocaleString()}</span>
                          <span style={{ color: '#4ade80', fontSize: '12px' }}>CR</span>
                        </div>
                        {pl !== null && (
                          <div style={{ color: plUp ? '#4ade80' : '#f87171', fontSize: '13px', fontWeight: '500', marginTop: '3px' }}>
                            {plUp ? '+' : ''}{pl}%
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleExpand(h)}
                      style={{
                        background: isExpanded ? '#1a1a1a' : 'transparent',
                        border: '0.5px solid #2a2a2a',
                        color: isExpanded ? '#fff' : '#888',
                        fontSize: '12px', fontWeight: '500',
                        padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', flexShrink: 0
                      }}
                    >
                      {isExpanded ? 'Close' : 'Trade'}
                    </button>
                  </div>

                  {isExpanded && artist && (
                    <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>

                      {/* Message */}
                      {tradeMessage.text && (
                        <div style={{ background: tradeMessage.success ? '#0f2a18' : '#1a0a0a', border: `0.5px solid ${tradeMessage.success ? '#1a4a2a' : '#3a1a1a'}`, borderRadius: '8px', padding: '10px 14px', color: tradeMessage.success ? '#4ade80' : '#f87171', fontSize: '13px', marginBottom: '12px' }}>
                          {tradeMessage.text}
                        </div>
                      )}

                      {isPendingSell ? (
                        <div>
                          <div style={{ color: '#fff', fontSize: '14px', marginBottom: '4px' }}>
                            {pendingSell.sellAll
                              ? `Sell your entire position in ${h.artist_name}?`
                              : `Sell ${pendingSell.sharesToSell.toFixed(2)} shares of ${h.artist_name}?`}
                          </div>
                          <div style={{ color: '#f87171', fontSize: '17px', fontWeight: '600', marginBottom: '14px' }}>
                            You'll receive {pendingSell.returnAmount.toLocaleString()} CR
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => confirmSell(h)} style={{ flex: 1, background: '#f87171', color: '#000', fontSize: '13px', fontWeight: '500', padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
                              Confirm Sell
                            </button>
                            <button onClick={() => setPendingSell(null)} style={{ flex: 1, background: 'transparent', border: '0.5px solid #2a2a2a', color: '#aaa', fontSize: '13px', fontWeight: '500', padding: '10px', borderRadius: '8px', cursor: 'pointer' }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Buy / Sell toggle */}
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                            <button
                              onClick={() => { setTradeType('buy'); setTradeInput('') }}
                              style={{
                                flex: 1, padding: '8px', borderRadius: '8px',
                                border: tradeType === 'buy' ? '1px solid #4ade80' : '0.5px solid #1a4a2a',
                                background: '#0f2a18', color: '#4ade80',
                                fontSize: '13px', fontWeight: '500', cursor: 'pointer',
                                opacity: tradeType === 'buy' ? 1 : 0.6
                              }}
                            >
                              Buy more
                            </button>
                            <button
                              onClick={() => { setTradeType('sell'); setTradeInput('') }}
                              style={{
                                flex: 1, padding: '8px', borderRadius: '8px',
                                border: tradeType === 'sell' ? '1px solid #f87171' : '0.5px solid #3a1a1a',
                                background: '#1a0a0a', color: '#f87171',
                                fontSize: '13px', fontWeight: '500', cursor: 'pointer',
                                opacity: tradeType === 'sell' ? 1 : 0.6
                              }}
                            >
                              Sell
                            </button>
                          </div>

                          {/* CR / Shares mode toggle */}
                          <div style={{ display: 'flex', background: '#0a0a0a', borderRadius: '8px', padding: '3px', marginBottom: '10px' }}>
                            <button style={tabStyle(tradeMode === 'cr')} onClick={() => { setTradeMode('cr'); setTradeInput('') }}>By CR amount</button>
                            <button style={tabStyle(tradeMode === 'shares')} onClick={() => { setTradeMode('shares'); setTradeInput('') }}>By share count</button>
                          </div>

                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                            <input
                              type="number" min="0" step={tradeMode === 'cr' ? '1' : 'any'}
                              placeholder={tradeMode === 'cr' ? 'Amount in CR...' : 'Number of shares...'}
                              value={tradeInput} onChange={e => handleTradeInput(e.target.value)}
                              style={tradeInputStyle}
                            />
                            {tradeType === 'buy' ? (
                              <button onClick={() => buyMore(h)} style={{ background: '#4ade80', color: '#000', fontSize: '13px', fontWeight: '500', padding: '10px 22px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>Buy</button>
                            ) : (
                              <button onClick={() => requestSell(h, false)} style={{ background: '#1a0a0a', border: '0.5px solid #3a1a1a', color: '#f87171', fontSize: '13px', fontWeight: '500', padding: '10px 22px', borderRadius: '8px', cursor: 'pointer' }}>Sell</button>
                            )}
                          </div>

                          {tradeInput > 0 && (
                            <div style={{ color: '#555', fontSize: '12px', marginBottom: '8px' }}>
                              {tradeType === 'buy'
                                ? `≈ ${getTradeShares(h, artist).toFixed(2)} shares for ${getTradeCRAmount(h, artist).toLocaleString()} CR`
                                : `≈ ${getTradeShares(h, artist).toFixed(2)} shares · receive ${getTradeCRAmount(h, artist).toLocaleString()} CR`}
                            </div>
                          )}

                          {tradeType === 'sell' && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {[25, 50, 75, 100].map(pct => (
                                <button key={pct}
                                  onClick={() => {
                                    if (pct === 100) { requestSell(h, true); return }
                                    setTradeMode('shares')
                                    setTradeInput((h.shares * (pct / 100)).toFixed(4))
                                  }}
                                  style={{ flex: 1, background: '#1a1a1a', border: '0.5px solid #2a2a2a', color: '#aaa', fontSize: '12px', padding: '7px', borderRadius: '6px', cursor: 'pointer' }}>
                                  {pct}%
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Sidebar */}
        <div style={{ padding: '32px 28px', overflow: 'auto' }}>
          <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
            <div style={{ color: '#888', fontSize: '11px', letterSpacing: '0.5px', marginBottom: '16px' }}>ACCOUNT SUMMARY</div>
            {[
              { label: 'Username', val: profile?.username },
              { label: 'Credits', val: `${profile?.credits?.toLocaleString()} CR`, color: '#4ade80' },
              { label: 'Holdings', val: `${holdings.length} artists` },
              { label: 'Net worth', val: `${Math.round(netWorth).toLocaleString()} CR` },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ color: '#555', fontSize: '14px' }}>{r.label}</span>
                <span style={{ color: r.color || '#fff', fontSize: '14px', fontWeight: '500' }}>{r.val}</span>
              </div>
            ))}
          </div>

          <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
            <div style={{ color: '#888', fontSize: '11px', letterSpacing: '0.5px', marginBottom: '16px' }}>MARKET MOVERS</div>
            {movers.length === 0 ? (
              <p style={{ color: '#444', fontSize: '13px' }}>No movers yet — check back after the next market update.</p>
            ) : (
              movers.map((m, i, arr) => (
                <div key={m.artist_id} onClick={() => router.push(`/artist/${m.artist_id}`)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 0', borderBottom: i < arr.length - 1 ? '0.5px solid #111' : 'none', cursor: 'pointer' }}>
                  {m.image ? (
                    <img src={m.image} alt={m.artist_name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#1a1a1a', flexShrink: 0 }} />
                  )}
                  <span style={{ color: '#ddd', fontSize: '14px', flex: 1 }}>{m.artist_name}</span>
                  <span style={{ color: '#888', fontSize: '13px' }}>{m.price?.toLocaleString()} CR</span>
                  <span style={{ color: '#4ade80', fontSize: '13px', fontWeight: '500' }}>▲ {m.growth.toFixed(1)}%</span>
                </div>
              ))
            )}
          </div>

          <button onClick={() => router.push('/explore')} style={{ width: '100%', background: '#4ade80', color: '#000', fontSize: '15px', fontWeight: '500', padding: '15px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}>
            Explore artists
          </button>
        </div>
      </div>
    </main>
  )
}