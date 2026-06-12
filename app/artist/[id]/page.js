'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function ArtistPage() {
  const [artist, setArtist] = useState(null)
  const [profile, setProfile] = useState(null)
  const [holding, setHolding] = useState(null)
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

      const { data: holdingData } = await supabase
        .from('holdings').select('*').eq('user_id', user.id).eq('artist_id', id).single()
      setHolding(holdingData || null)

      const res = await fetch(`/api/artist?id=${id}`)
      const data = await res.json()
      setArtist(data.artist)
      setLoading(false)
    }
    getData()
  }, [id])

  const getPrice = (a) => {
    const followers = a.followers
    const popularity = a.popularity
    return Math.round(Math.sqrt(followers) * (popularity / 10) + (popularity * popularity / 200))
  }

  const showMessage = (text, success = true) => {
    setMessage({ text, success })
    setTimeout(() => setMessage({ text: '', success: true }), 3000)
  }

  // Force whole numbers only
  const handleBuyInput = (val) => {
    setBuyInput(Math.floor(Math.abs(val)) || '')
  }

  const handleSellInput = (val) => {
    if (sellMode === 'cr') {
      setSellInput(Math.floor(Math.abs(val)) || '')
    } else {
      setSellInput(val)
    }
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

  const buyShares = async () => {
    const shares = getBuyShares()
    const cost = getBuyCost()
    const price = getPrice(artist)

    if (!shares || shares <= 0) { showMessage('Enter a valid amount.', false); return }
    if (cost > profile.credits) { showMessage('Not enough credits!', false); return }

    const { data: { user } } = await supabase.auth.getUser()

    if (holding) {
      await supabase.from('holdings')
        .update({ shares: holding.shares + shares })
        .eq('id', holding.id)
      setHolding({ ...holding, shares: holding.shares + shares })
    } else {
      const { data } = await supabase.from('holdings').insert({
        user_id: user.id,
        artist_id: artist.id,
        artist_name: artist.name,
        shares,
        buy_price: price
      }).select().single()
      setHolding(data)
    }

    await supabase.from('profiles')
      .update({ credits: profile.credits - cost })
      .eq('id', user.id)
    setProfile({ ...profile, credits: profile.credits - cost })
    setBuyInput('')
    showMessage(`Bought ${shares.toFixed(2)} shares for ${cost.toLocaleString()} CR!`)
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
    } else {
      await supabase.from('holdings')
        .update({ shares: holding.shares - sharesToSell })
        .eq('id', holding.id)
      setHolding({ ...holding, shares: holding.shares - sharesToSell })
    }

    await supabase.from('profiles')
      .update({ credits: profile.credits + returnAmount })
      .eq('id', user.id)
    setProfile({ ...profile, credits: profile.credits + returnAmount })
    setSellInput('')
    showMessage(`Sold ${sharesToSell.toFixed(2)} shares for ${returnAmount.toLocaleString()} CR!`)
  }

  if (loading) return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <p style={{ color: '#555' }}>Loading...</p>
    </main>
  )

  if (!artist) return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <p style={{ color: '#555' }}>Artist not found.</p>
    </main>
  )

  const price = getPrice(artist)
  const currentValue = holding ? holding.shares * price : 0
  const pl = holding ? currentValue - (holding.shares * holding.buy_price) : 0
  const plPct = holding ? (((price - holding.buy_price) / holding.buy_price) * 100).toFixed(1) : 0

  const tabStyle = (active) => ({
    flex: 1,
    padding: '8px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    background: active ? '#1a1a1a' : 'transparent',
    color: active ? '#fff' : '#555',
  })

  return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh', fontFamily: 'sans-serif', color: '#fff' }}>

      {/* Navbar */}
      <nav style={{ borderBottom: '0.5px solid #1a1a1a', padding: '14px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: '#4ade80', fontSize: '18px', fontWeight: '500', cursor: 'pointer' }} onClick={() => router.push('/dashboard')}>Stockify</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => router.back()} style={{ background: 'transparent', border: 'none', color: '#555', fontSize: '13px', cursor: 'pointer' }}>← Back</button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ color: '#fff', fontWeight: '500' }}>{profile?.credits?.toLocaleString()}</span>
            <span style={{ color: '#4ade80', fontSize: '12px', fontWeight: '500' }}>CR</span>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '32px 24px' }}>

        {/* Artist Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '28px' }}>
          {artist.image ? (
            <img src={artist.image} alt={artist.name} style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>🎵</div>
          )}
          <div style={{ flex: 1 }}>
            <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: '500', letterSpacing: '-0.5px', marginBottom: '4px' }}>{artist.name}</h1>
            <p style={{ color: '#555', fontSize: '13px' }}>{artist.followers.toLocaleString()} followers · popularity {artist.popularity}/100</p>
            {artist.genres.length > 0 && <p style={{ color: '#444', fontSize: '12px', marginTop: '2px' }}>{artist.genres.join(', ')}</p>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', justifyContent: 'flex-end' }}>
              <span style={{ color: '#fff', fontSize: '28px', fontWeight: '500' }}>{price.toLocaleString()}</span>
              <span style={{ color: '#4ade80', fontSize: '16px', fontWeight: '500' }}>CR</span>
            </div>
            <p style={{ color: '#555', fontSize: '12px' }}>per share</p>
          </div>
        </div>

        {/* Current Position */}
        {holding && (
          <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
            <div style={{ color: '#888', fontSize: '10px', letterSpacing: '0.5px', marginBottom: '14px' }}>YOUR POSITION</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div>
                <div style={{ color: '#555', fontSize: '11px', marginBottom: '4px' }}>Shares owned</div>
                <div style={{ color: '#fff', fontSize: '16px', fontWeight: '500' }}>{holding.shares.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ color: '#555', fontSize: '11px', marginBottom: '4px' }}>Current value</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                  <span style={{ color: '#fff', fontSize: '16px', fontWeight: '500' }}>{Math.round(currentValue).toLocaleString()}</span>
                  <span style={{ color: '#4ade80', fontSize: '12px' }}>CR</span>
                </div>
              </div>
              <div>
                <div style={{ color: '#555', fontSize: '11px', marginBottom: '4px' }}>Profit / Loss</div>
                <div style={{ color: pl >= 0 ? '#4ade80' : '#f87171', fontSize: '16px', fontWeight: '500' }}>
                  {pl >= 0 ? '+' : ''}{Math.round(pl).toLocaleString()} CR ({plPct}%)
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Message */}
        {message.text && (
          <div style={{ background: message.success ? '#0f2a18' : '#1a0a0a', border: `0.5px solid ${message.success ? '#1a4a2a' : '#3a1a1a'}`, borderRadius: '8px', padding: '12px 16px', color: message.success ? '#4ade80' : '#f87171', fontSize: '13px', marginBottom: '16px' }}>
            {message.text}
          </div>
        )}

        {/* Buy */}
        <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '20px', marginBottom: '12px' }}>
          <div style={{ color: '#888', fontSize: '10px', letterSpacing: '0.5px', marginBottom: '14px' }}>BUY SHARES</div>
          <div style={{ display: 'flex', background: '#0a0a0a', borderRadius: '8px', padding: '3px', marginBottom: '14px' }}>
            <button style={tabStyle(buyMode === 'cr')} onClick={() => { setBuyMode('cr'); setBuyInput('') }}>Invest by CR amount</button>
            <button style={tabStyle(buyMode === 'shares')} onClick={() => { setBuyMode('shares'); setBuyInput('') }}>Invest by share count</button>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
            <input
              type="number"
              min="1"
              step={buyMode === 'cr' ? '1' : 'any'}
              placeholder={buyMode === 'cr' ? 'Amount in CR...' : 'Number of shares...'}
              value={buyInput}
              onChange={e => handleBuyInput(e.target.value)}
              style={{ flex: 1, background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '8px', padding: '11px 16px', color: '#fff', fontSize: '14px', outline: 'none' }}
            />
            <button onClick={buyShares} style={{ background: '#4ade80', color: '#000', fontSize: '13px', fontWeight: '500', padding: '11px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Buy
            </button>
          </div>
          {buyInput > 0 && (
            <div style={{ color: '#555', fontSize: '12px' }}>
              ≈ {getBuyShares().toFixed(2)} shares for {getBuyCost().toLocaleString()} CR
            </div>
          )}
        </div>

        {/* Sell */}
        {holding && (
          <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ color: '#888', fontSize: '10px', letterSpacing: '0.5px' }}>SELL SHARES</div>
              <button
                onClick={() => sellShares(true)}
                style={{ background: '#1a0a0a', border: '0.5px solid #3a1a1a', color: '#f87171', fontSize: '11px', fontWeight: '500', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer' }}
              >
                Sell All
              </button>
            </div>
            <div style={{ display: 'flex', background: '#0a0a0a', borderRadius: '8px', padding: '3px', marginBottom: '14px' }}>
              <button style={tabStyle(sellMode === 'cr')} onClick={() => { setSellMode('cr'); setSellInput('') }}>Sell by CR amount</button>
              <button style={tabStyle(sellMode === 'shares')} onClick={() => { setSellMode('shares'); setSellInput('') }}>Sell by share count</button>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
              <input
                type="number"
                min="0"
                step={sellMode === 'cr' ? '1' : 'any'}
                placeholder={sellMode === 'cr' ? 'Amount in CR...' : 'Number of shares...'}
                value={sellInput}
                onChange={e => handleSellInput(e.target.value)}
                style={{ flex: 1, background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '8px', padding: '11px 16px', color: '#fff', fontSize: '14px', outline: 'none' }}
              />
              <button onClick={() => sellShares(false)} style={{ background: '#1a0a0a', border: '0.5px solid #3a1a1a', color: '#f87171', fontSize: '13px', fontWeight: '500', padding: '11px 24px', borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Sell
              </button>
            </div>
            {sellInput > 0 && (
              <div style={{ color: '#555', fontSize: '12px' }}>
                ≈ {getSellShares().toFixed(2)} shares · receive {getSellReturn().toLocaleString()} CR
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              {[25, 50, 75, 100].map(pct => (
                <button
                  key={pct}
                  onClick={() => {
                    if (pct === 100) { sellShares(true); return }
                    const sharesToSell = holding.shares * (pct / 100)
                    setSellMode('shares')
                    setSellInput(sharesToSell.toFixed(4))
                  }}
                  style={{ flex: 1, background: '#1a1a1a', border: '0.5px solid #2a2a2a', color: '#aaa', fontSize: '11px', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </main>
  )
}