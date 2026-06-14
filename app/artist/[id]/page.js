'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { EQVisualizer, AnimatedNumber, Skeleton, useFlash } from '../../components/FX'

export default function ArtistPage() {
  const [artist, setArtist] = useState(null)
  const [profile, setProfile] = useState(null)
  const [holding, setHolding] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [priceHistory, setPriceHistory] = useState([])
  const [topInvestors, setTopInvestors] = useState([])
  const [totalInvestors, setTotalInvestors] = useState(0)
  const [adminIds, setAdminIds] = useState([])
  const [bio, setBio] = useState(null)
  const [tradeType, setTradeType] = useState('buy')
  const [buyMode, setBuyMode] = useState('cr')
  const [sellMode, setSellMode] = useState('cr')
  const [buyInput, setBuyInput] = useState('')
  const [sellInput, setSellInput] = useState('')
  const [message, setMessage] = useState({ text: '', success: true })
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { id } = useParams()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      const { data: profileData } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(profileData)

      const { data: adminProfiles } = await supabase
        .from('profiles').select('id').eq('is_admin', true)
      const adminUserIds = (adminProfiles || []).map(p => p.id)
      setAdminIds(adminUserIds)

      const { data: holdingData } = await supabase
        .from('holdings').select('*').eq('user_id', user.id).eq('artist_id', id).single()
      setHolding(holdingData || null)

      const { data: txData } = await supabase
        .from('transactions').select('*').eq('user_id', user.id).eq('artist_id', id)
        .order('created_at', { ascending: false })
      setTransactions(txData || [])

      const { data: snapData } = await supabase
        .from('artist_snapshots').select('*').eq('artist_id', id)
        .order('snapshot_date', { ascending: true })
      if (snapData && snapData.length > 0) {
        setPriceHistory(snapData.map(s => {
          const pop = s.popularity ?? 91
          return {
            date: new Date(s.snapshot_date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
            price: Math.round((Math.sqrt(s.monthly_listeners) * (pop / 10) + (pop * pop / 200)) / 10)
          }
        }))
      }

      const { data: allHoldings } = await supabase
        .from('holdings').select('user_id, shares').eq('artist_id', id)
        .order('shares', { ascending: false })

      const realHoldings = (allHoldings || []).filter(h => !adminUserIds.includes(h.user_id))

      if (realHoldings.length > 0) {
        setTotalInvestors(realHoldings.length)
        const investorProfiles = await Promise.all(
          realHoldings.slice(0, 5).map(async h => {
            const { data: p } = await supabase
              .from('profiles').select('username').eq('id', h.user_id).single()
            return { username: p?.username || 'unknown', shares: h.shares, userId: h.user_id }
          })
        )
        setTopInvestors(investorProfiles)
      }

      const res = await fetch(`/api/artist?id=${id}`)
      const data = await res.json()
      setArtist(data.artist)

      if (data.artist?.name) {
        const bioRes = await fetch(`/api/bio?artist=${encodeURIComponent(data.artist.name)}`)
        const bioData = await bioRes.json()
        setBio(bioData.bio)
      }

      setLoading(false)
    }
    getData()
  }, [id])

  const getPrice = (a) => {
    return Math.round((Math.sqrt(a.followers) * (a.popularity / 10) + (a.popularity * a.popularity / 200)) / 10)
  }

  const showMessage = (text, success = true) => {
    setMessage({ text, success })
    setTimeout(() => setMessage({ text: '', success: true }), 4000)
  }

  const handleBuyInput = (val) => setBuyInput(Math.floor(Math.abs(val)) || '')
  const handleSellInput = (val) => {
    if (sellMode === 'cr') setSellInput(Math.floor(Math.abs(val)) || '')
    else setSellInput(val)
  }

  const getBuyShares = () => {
    if (!artist) return 0
    const price = getPrice(artist)
    if (buyMode === 'cr') return parseInt(buyInput) / price || 0
    return parseFloat(buyInput) || 0
  }

  const getBuyCost = () => {
    if (!artist) return 0
    const price = getPrice(artist)
    if (buyMode === 'cr') return parseInt(buyInput) || 0
    return Math.floor((parseFloat(buyInput) || 0) * price)
  }

  const getSellShares = () => {
    if (!artist || !holding) return 0
    const price = getPrice(artist)
    if (sellMode === 'cr') return parseInt(sellInput) / price || 0
    return parseFloat(sellInput) || 0
  }

  const getSellReturn = () => {
    if (!artist) return 0
    const price = getPrice(artist)
    if (sellMode === 'cr') return parseInt(sellInput) || 0
    return Math.floor((parseFloat(sellInput) || 0) * price)
  }

  const getAvgPrice = () => {
    const buys = transactions.filter(t => t.type === 'buy')
    if (buys.length === 0) return holding?.buy_price || 0
    const totalCost = buys.reduce((sum, t) => sum + t.total, 0)
    const totalShares = buys.reduce((sum, t) => sum + t.shares, 0)
    return totalShares > 0 ? Math.round(totalCost / totalShares) : 0
  }

  const buyShares = async () => {
    const shares = getBuyShares()
    const cost = getBuyCost()
    const price = getPrice(artist)
    if (!shares || shares <= 0) { showMessage('Enter a valid amount.', false); return }
    if (cost > profile.credits) { showMessage('Not enough credits!', false); return }
    const { data: { user } } = await supabase.auth.getUser()

    let isFirstInvestor = false
    let isNewInvestor = false
    if (!holding) {
      isNewInvestor = !profile.is_admin
      if (!profile.is_admin) {
        const { data: existingHoldings } = await supabase
          .from('holdings')
          .select('user_id')
          .eq('artist_id', artist.id)
        const realExisting = (existingHoldings || []).filter(h => !adminIds.includes(h.user_id))
        if (realExisting.length === 0) isFirstInvestor = true
      }
    }

    if (holding) {
      await supabase.from('holdings').update({ shares: holding.shares + shares }).eq('id', holding.id)
      setHolding({ ...holding, shares: holding.shares + shares })
    } else {
      const { data } = await supabase.from('holdings').insert({
        user_id: user.id, artist_id: artist.id, artist_name: artist.name, shares, buy_price: price
      }).select().single()
      setHolding(data)
    }
    const { data: tx } = await supabase.from('transactions').insert({
      user_id: user.id, artist_id: artist.id, artist_name: artist.name,
      type: 'buy', shares, price_per_share: price, total: cost
    }).select().single()
    setTransactions([tx, ...transactions])

    if (isNewInvestor) setTotalInvestors(prev => prev + 1)

    let bonus = 0
    if (isFirstInvestor) {
      bonus = 500
      await supabase.from('badges').insert({
        user_id: user.id, badge_type: 'first_investor', artist_id: artist.id, artist_name: artist.name
      })
    }

    const newCredits = profile.credits - cost + bonus
    await supabase.from('profiles').update({ credits: newCredits }).eq('id', user.id)
    setProfile({ ...profile, credits: newCredits })
    setBuyInput('')

    if (isFirstInvestor) {
      showMessage(`🏆 First Investor! Bought ${shares.toFixed(2)} shares for ${cost.toLocaleString()} CR + 500 CR bonus!`)
    } else {
      showMessage(`Bought ${shares.toFixed(2)} shares for ${cost.toLocaleString()} CR!`)
    }
  }

  const sellShares = async (sellAll = false) => {
    if (!holding) return
    const price = getPrice(artist)
    const sharesToSell = sellAll ? holding.shares : getSellShares()
    const returnAmount = Math.floor(sharesToSell * price)
    if (!sharesToSell || sharesToSell <= 0) { showMessage('Enter a valid amount.', false); return }
    if (sharesToSell > holding.shares) { showMessage('Not enough shares!', false); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (holding.shares - sharesToSell <= 0.0001) {
      await supabase.from('holdings').delete().eq('id', holding.id)
      setHolding(null)
      if (!profile.is_admin) setTotalInvestors(prev => Math.max(0, prev - 1))
    } else {
      await supabase.from('holdings').update({ shares: holding.shares - sharesToSell }).eq('id', holding.id)
      setHolding({ ...holding, shares: holding.shares - sharesToSell })
    }
    const { data: tx } = await supabase.from('transactions').insert({
      user_id: user.id, artist_id: artist.id, artist_name: artist.name,
      type: 'sell', shares: sharesToSell, price_per_share: price, total: returnAmount
    }).select().single()
    setTransactions([tx, ...transactions])
    await supabase.from('profiles').update({ credits: profile.credits + returnAmount }).eq('id', user.id)
    setProfile({ ...profile, credits: profile.credits + returnAmount })
    setSellInput('')
    showMessage(`Sold ${sharesToSell.toFixed(2)} shares for ${returnAmount.toLocaleString()} CR!`)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const price = artist ? getPrice(artist) : 0
  const currentValue = holding && artist ? holding.shares * price : 0
  const avgPrice = getAvgPrice()
  const pl = holding ? currentValue - (holding.shares * avgPrice) : 0
  const plPct = avgPrice > 0 ? (((price - avgPrice) / avgPrice) * 100).toFixed(1) : '0.0'
  const chartUp = priceHistory.length < 2 || priceHistory[priceHistory.length - 1]?.price >= priceHistory[0]?.price

  const valueFlash = useFlash(Math.round(currentValue))
  const plFlash = useFlash(Math.round(pl))

  if (loading) return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh', fontFamily: 'sans-serif', color: '#fff' }}>
      <nav style={{ borderBottom: '0.5px solid #1a1a1a', padding: '20px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ color: '#4ade80', fontSize: '26px', fontWeight: '500' }}>Stockify</div>
          <EQVisualizer />
        </div>
      </nav>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', minHeight: 'calc(100vh - 65px)' }}>
        <div style={{ padding: '28px 40px', borderRight: '0.5px solid #141414' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '28px' }}>
            <Skeleton width="100px" height="100px" borderRadius="50%" />
            <div style={{ flex: 1 }}>
              <Skeleton width="220px" height="32px" borderRadius="6px" />
              <div style={{ marginTop: '10px' }}><Skeleton width="320px" height="16px" borderRadius="4px" /></div>
            </div>
          </div>
          <Skeleton height="180px" borderRadius="12px" />
          <div style={{ marginTop: '14px' }}><Skeleton height="120px" borderRadius="12px" /></div>
          <div style={{ marginTop: '14px' }}><Skeleton height="200px" borderRadius="12px" /></div>
        </div>
        <div style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Skeleton height="180px" borderRadius="12px" />
          <Skeleton height="120px" borderRadius="12px" />
          <Skeleton height="160px" borderRadius="12px" />
        </div>
      </div>
    </main>
  )

  if (!artist) return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <p style={{ color: '#555' }}>Artist not found.</p>
    </main>
  )

  let priceYDomain = ['auto', 'auto']
  if (priceHistory.length >= 2) {
    const prices = priceHistory.map(d => d.price)
    const pMin = Math.min(...prices)
    const pMax = Math.max(...prices)
    const pRange = pMax - pMin
    const pPadding = pRange === 0 ? pMax * 0.05 : pRange * 0.1
    priceYDomain = [Math.max(0, pMin - pPadding), pMax + pPadding]
  }

  const tabStyle = (active) => ({
    flex: 1, padding: '8px', borderRadius: '6px', border: 'none', cursor: 'pointer',
    fontSize: '13px', fontWeight: '500',
    background: active ? '#1a1a1a' : 'transparent',
    color: active ? '#fff' : '#555',
  })

  const inputStyle = {
    flex: 1,
    background: '#0f0f0f',
    border: '0.5px solid #2a2a2a',
    borderRadius: '8px',
    padding: '12px 16px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none'
  }

  const initials = profile?.username?.slice(0, 2).toUpperCase() || 'U'

  return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh', fontFamily: 'sans-serif', color: '#fff' }}>

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
          <span onClick={() => router.push(`/profile/${profile?.username}`)} style={{ color: '#666', fontSize: '16px', cursor: 'pointer' }}>Profile</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#0f2a18', border: '0.5px solid #1a4a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80', fontSize: '13px', fontWeight: '500' }}>{initials}</div>
            <span style={{ color: '#aaa', fontSize: '16px' }}>{profile?.username}</span>
          </div>
          <button onClick={handleLogout} style={{ background: 'transparent', border: '0.5px solid #2a2a2a', color: '#666', fontSize: '14px', padding: '7px 16px', borderRadius: '6px', cursor: 'pointer' }}>Log out</button>
        </div>
      </nav>

      {/* Body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', minHeight: 'calc(100vh - 65px)' }}>

        {/* Left */}
        <div style={{ padding: '28px 40px', borderRight: '0.5px solid #141414', overflow: 'auto' }}>

          {/* Artist Header */}
          <div style={{ marginBottom: '28px', paddingBottom: '24px', borderBottom: '0.5px solid #141414' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              {artist.image ? (
                <img src={artist.image} alt={artist.name} style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #1a4a2a' }} />
              ) : (
                <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', flexShrink: 0 }}>🎵</div>
              )}
              <div style={{ flex: 1 }}>
                <h1 style={{ color: '#fff', fontSize: '36px', fontWeight: '500', letterSpacing: '-1px', marginBottom: '8px' }}>{artist.name}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <span style={{ color: '#555', fontSize: '14px' }}>{artist.followers.toLocaleString()} followers</span>
                  <span style={{ color: '#333' }}>·</span>
                  <span style={{ color: '#555', fontSize: '14px' }}>popularity {artist.popularity}/100</span>
                  {artist.genres.length > 0 && <>
                    <span style={{ color: '#333' }}>·</span>
                    <span style={{ color: '#444', fontSize: '14px' }}>{artist.genres.join(', ')}</span>
                  </>}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', justifyContent: 'flex-end' }}>
                  <span style={{ color: '#fff', fontSize: '42px', fontWeight: '500', letterSpacing: '-1px' }}><AnimatedNumber value={price} /></span>
                  <span style={{ color: '#4ade80', fontSize: '22px', fontWeight: '500' }}>CR</span>
                </div>
                <p style={{ color: '#555', fontSize: '13px' }}>per share</p>
              </div>
            </div>
          </div>

          {/* Price History Chart */}
          <div className="card-hover" style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '18px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ color: '#888', fontSize: '11px', letterSpacing: '0.5px' }}>PRICE HISTORY</div>
              {priceHistory.length >= 2 && (
                <span style={{ color: chartUp ? '#4ade80' : '#f87171', fontSize: '12px', fontWeight: '500' }}>
                  {chartUp ? '▲' : '▼'} {Math.abs(((priceHistory[priceHistory.length - 1].price - priceHistory[0].price) / priceHistory[0].price) * 100).toFixed(1)}% since tracking
                </span>
              )}
            </div>
            {priceHistory.length >= 2 ? (
              <>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={priceHistory} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <defs>
                      <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartUp ? '#4ade80' : '#f87171'} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={chartUp ? '#4ade80' : '#f87171'} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fill: '#444', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis hide domain={priceYDomain} />
                    <Tooltip
                      contentStyle={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                      formatter={(val) => [`${val.toLocaleString()} CR`, 'Price']}
                      labelStyle={{ color: '#555' }}
                    />
                    <Area type="monotone" dataKey="price" stroke={chartUp ? '#4ade80' : '#f87171'} strokeWidth={2} fill="url(#priceGrad)" dot={{ fill: chartUp ? '#4ade80' : '#f87171', r: 3 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  <div>
                    <div style={{ color: '#555', fontSize: '11px' }}>Earliest</div>
                    <div style={{ color: '#fff', fontSize: '13px', fontWeight: '500' }}>{priceHistory[0].price.toLocaleString()} CR</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#555', fontSize: '11px' }}>Latest</div>
                    <div style={{ color: chartUp ? '#4ade80' : '#f87171', fontSize: '13px', fontWeight: '500' }}>{priceHistory[priceHistory.length - 1].price.toLocaleString()} CR</div>
                  </div>
                </div>
              </>
            ) : (
              <p style={{ color: '#555', fontSize: '13px' }}>Not enough data yet. Check back after the next market update.</p>
            )}
          </div>

          {/* Position */}
          {holding && (
            <div className="card-hover" style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '18px', marginBottom: '14px' }}>
              <div style={{ color: '#888', fontSize: '11px', letterSpacing: '0.5px', marginBottom: '14px' }}>YOUR POSITION</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                <div>
                  <div style={{ color: '#555', fontSize: '11px', marginBottom: '5px' }}>Shares owned</div>
                  <div style={{ color: '#fff', fontSize: '15px', fontWeight: '500' }}>{holding.shares.toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ color: '#555', fontSize: '11px', marginBottom: '5px' }}>Avg buy price</div>
                  <div style={{ color: '#fff', fontSize: '15px', fontWeight: '500' }}><AnimatedNumber value={avgPrice} /> CR</div>
                </div>
                <div className={valueFlash} style={{ borderRadius: '6px' }}>
                  <div style={{ color: '#555', fontSize: '11px', marginBottom: '5px' }}>Current value</div>
                  <div style={{ color: '#fff', fontSize: '15px', fontWeight: '500' }}><AnimatedNumber value={Math.round(currentValue)} /> CR</div>
                </div>
                <div className={plFlash} style={{ borderRadius: '6px' }}>
                  <div style={{ color: '#555', fontSize: '11px', marginBottom: '5px' }}>Profit / Loss</div>
                  <div style={{ color: pl >= 0 ? '#4ade80' : '#f87171', fontSize: '15px', fontWeight: '500' }}>
                    {pl >= 0 ? '+' : ''}<AnimatedNumber value={Math.round(pl)} /> CR ({plPct}%)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Message */}
          {message.text && (
            <div style={{ background: message.success ? '#0f2a18' : '#1a0a0a', border: `0.5px solid ${message.success ? '#1a4a2a' : '#3a1a1a'}`, borderRadius: '8px', padding: '12px 16px', color: message.success ? '#4ade80' : '#f87171', fontSize: '14px', marginBottom: '14px' }}>
              {message.text}
            </div>
          )}

          {/* Trade Panel */}
          <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '18px', marginBottom: '14px' }}>

            {/* Buy / Sell toggle */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                onClick={() => setTradeType('buy')}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px',
                  border: tradeType === 'buy' ? '1px solid #4ade80' : '0.5px solid #1a4a2a',
                  background: '#0f2a18',
                  color: '#4ade80',
                  fontSize: '14px', fontWeight: '500', cursor: 'pointer',
                  opacity: tradeType === 'buy' ? 1 : 0.6
                }}
              >
                Buy
              </button>
              <button
                onClick={() => holding && setTradeType('sell')}
                disabled={!holding}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px',
                  border: tradeType === 'sell' ? '1px solid #f87171' : '0.5px solid #3a1a1a',
                  background: '#1a0a0a',
                  color: '#f87171',
                  fontSize: '14px', fontWeight: '500',
                  cursor: holding ? 'pointer' : 'not-allowed',
                  opacity: !holding ? 0.35 : tradeType === 'sell' ? 1 : 0.6
                }}
              >
                Sell
              </button>
            </div>

            {/* Buy form */}
            {tradeType === 'buy' && (
              <>
                <div style={{ display: 'flex', background: '#0a0a0a', borderRadius: '8px', padding: '3px', marginBottom: '12px' }}>
                  <button style={tabStyle(buyMode === 'cr')} onClick={() => { setBuyMode('cr'); setBuyInput('') }}>Invest by CR amount</button>
                  <button style={tabStyle(buyMode === 'shares')} onClick={() => { setBuyMode('shares'); setBuyInput('') }}>Invest by share count</button>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                  <input type="number" min="1" step={buyMode === 'cr' ? '1' : 'any'}
                    placeholder={buyMode === 'cr' ? 'Amount in CR...' : 'Number of shares...'}
                    value={buyInput} onChange={e => handleBuyInput(e.target.value)}
                    style={inputStyle} />
                  <button onClick={buyShares} style={{ background: '#4ade80', color: '#000', fontSize: '14px', fontWeight: '500', padding: '12px 28px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>Buy</button>
                </div>
                {buyInput > 0 && <div style={{ color: '#555', fontSize: '12px' }}>≈ {getBuyShares().toFixed(2)} shares for {getBuyCost().toLocaleString()} CR</div>}
                {!profile?.is_admin && (
                  <div style={{ color: totalInvestors === 0 ? '#fbbf24' : '#555', fontSize: '12px', marginTop: '8px' }}>
                    {totalInvestors === 0
                      ? `🏆 Be the first to invest in ${artist.name} and earn a badge + 500 CR bonus!`
                      : `${totalInvestors} user${totalInvestors !== 1 ? 's' : ''} invested`}
                  </div>
                )}
              </>
            )}

            {/* Sell form */}
            {tradeType === 'sell' && holding && (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                  <button onClick={() => sellShares(true)} style={{ background: '#1a0a0a', border: '0.5px solid #3a1a1a', color: '#f87171', fontSize: '11px', fontWeight: '500', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer' }}>Sell All</button>
                </div>
                <div style={{ display: 'flex', background: '#0a0a0a', borderRadius: '8px', padding: '3px', marginBottom: '12px' }}>
                  <button style={tabStyle(sellMode === 'cr')} onClick={() => { setSellMode('cr'); setSellInput('') }}>Sell by CR amount</button>
                  <button style={tabStyle(sellMode === 'shares')} onClick={() => { setSellMode('shares'); setSellInput('') }}>Sell by share count</button>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                  <input type="number" min="0" step={sellMode === 'cr' ? '1' : 'any'}
                    placeholder={sellMode === 'cr' ? 'Amount in CR...' : 'Number of shares...'}
                    value={sellInput} onChange={e => handleSellInput(e.target.value)}
                    style={inputStyle} />
                  <button onClick={() => sellShares(false)} style={{ background: '#1a0a0a', border: '0.5px solid #3a1a1a', color: '#f87171', fontSize: '14px', fontWeight: '500', padding: '12px 28px', borderRadius: '8px', cursor: 'pointer' }}>Sell</button>
                </div>
                {sellInput > 0 && <div style={{ color: '#555', fontSize: '12px', marginBottom: '10px' }}>≈ {getSellShares().toFixed(2)} shares · receive {getSellReturn().toLocaleString()} CR</div>}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[25, 50, 75, 100].map(pct => (
                    <button key={pct}
                      onClick={() => {
                        if (pct === 100) { sellShares(true); return }
                        setSellMode('shares')
                        setSellInput((holding.shares * (pct / 100)).toFixed(4))
                      }}
                      style={{ flex: 1, background: '#1a1a1a', border: '0.5px solid #2a2a2a', color: '#aaa', fontSize: '12px', padding: '7px', borderRadius: '6px', cursor: 'pointer' }}>
                      {pct}%
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Trade History */}
          {transactions.length > 0 && (
            <div className="card-hover" style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '18px' }}>
              <div style={{ color: '#888', fontSize: '11px', letterSpacing: '0.5px', marginBottom: '14px' }}>TRADE HISTORY</div>
              {transactions.map((tx, i) => (
                <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: i < transactions.length - 1 ? '0.5px solid #141414' : 'none' }}>
                  <span style={{ fontSize: '10px', fontWeight: '500', padding: '3px 8px', borderRadius: '5px', flexShrink: 0, background: tx.type === 'buy' ? '#0f2a18' : '#1a0a0a', border: `0.5px solid ${tx.type === 'buy' ? '#1a4a2a' : '#3a1a1a'}`, color: tx.type === 'buy' ? '#4ade80' : '#f87171' }}>
                    {tx.type.toUpperCase()}
                  </span>
                  <span style={{ color: '#ddd', fontSize: '13px', flex: 1 }}>{tx.shares.toFixed(2)} shares</span>
                  <span style={{ color: '#555', fontSize: '12px' }}>@ {Math.round(tx.price_per_share).toLocaleString()} CR</span>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ color: tx.type === 'buy' ? '#fff' : '#f87171', fontSize: '13px', fontWeight: '500' }}>
                      {tx.type === 'sell' ? '−' : ''}{Math.round(tx.total).toLocaleString()} CR
                    </div>
                    <div style={{ color: '#444', fontSize: '11px', marginTop: '2px' }}>
                      {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div style={{ padding: '28px 24px', overflow: 'auto' }}>

          {/* Artist Stats */}
          <div className="card-hover" style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '18px', marginBottom: '14px' }}>
            <div style={{ color: '#888', fontSize: '11px', letterSpacing: '0.5px', marginBottom: '14px' }}>ARTIST STATS</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid #111' }}>
              <span style={{ color: '#555', fontSize: '13px' }}>Followers</span>
              <span style={{ color: '#fff', fontSize: '13px', fontWeight: '500' }}><AnimatedNumber value={artist.followers} /></span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid #111' }}>
              <span style={{ color: '#555', fontSize: '13px' }}>Popularity score</span>
              <span style={{ color: '#fff', fontSize: '13px', fontWeight: '500' }}>{artist.popularity} / 100</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid #111' }}>
              <span style={{ color: '#555', fontSize: '13px' }}>Genre</span>
              <span style={{ color: '#fff', fontSize: '13px', fontWeight: '500' }}>{artist.genres.length > 0 ? artist.genres.join(', ') : 'N/A'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid #111' }}>
              <span style={{ color: '#555', fontSize: '13px' }}>Share price</span>
              <span style={{ color: '#fff', fontSize: '13px', fontWeight: '500' }}><AnimatedNumber value={price} /> CR</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
              <span style={{ color: '#555', fontSize: '13px' }}>Total investors</span>
              <span style={{ color: '#fff', fontSize: '13px', fontWeight: '500' }}>{totalInvestors} user{totalInvestors !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Bio */}
          {bio && (
            <div className="card-hover" style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '18px', marginBottom: '14px' }}>
              <div style={{ color: '#888', fontSize: '11px', letterSpacing: '0.5px', marginBottom: '14px' }}>ABOUT</div>
              <p style={{ color: '#fff', fontSize: '13px', lineHeight: '1.7' }}>{bio}</p>
            </div>
          )}

          {/* Top Investors */}
          {topInvestors.length > 0 && (
            <div className="card-hover" style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '18px' }}>
              <div style={{ color: '#888', fontSize: '11px', letterSpacing: '0.5px', marginBottom: '14px' }}>TOP INVESTORS</div>
              {topInvestors.map((inv, i) => (
                <div key={inv.userId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: i < topInvestors.length - 1 ? '0.5px solid #111' : 'none' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#0f2a18', border: '0.5px solid #1a4a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80', fontSize: '10px', fontWeight: '500', flexShrink: 0 }}>
                    {inv.username.slice(0, 2).toUpperCase()}
                  </div>
                  <span style={{ color: '#ddd', fontSize: '13px', flex: 1 }}>{inv.username}</span>
                  <span style={{ color: '#555', fontSize: '12px' }}>{inv.shares.toFixed(2)} shares</span>
                  <span style={{ color: '#4ade80', fontSize: '12px', fontWeight: '500' }}><AnimatedNumber value={Math.round(inv.shares * price)} /> CR</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}