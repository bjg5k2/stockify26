'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Portfolio() {
  const [profile, setProfile] = useState(null)
  const [holdings, setHoldings] = useState([])
  const [artistData, setArtistData] = useState({})
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

  const getPrice = (artist) => Math.max(1, Math.round(artist.followers / 10000))

  const getProfitLoss = (holding) => {
    const artist = artistData[holding.artist_id]
    if (!artist) return null
    const currentValue = holding.shares * getPrice(artist)
    const buyValue = holding.shares * holding.buy_price
    return currentValue - buyValue
  }

  const getTotalValue = () => {
    return holdings.reduce((total, h) => {
      const artist = artistData[h.artist_id]
      if (!artist) return total
      return total + h.shares * getPrice(artist)
    }, 0)
  }

  if (loading) return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <p className="text-gray-400">Loading portfolio...</p>
    </main>
  )

  const totalValue = getTotalValue()
  const totalInvested = holdings.reduce((t, h) => t + h.shares * h.buy_price, 0)
  const totalPL = totalValue - totalInvested

  const CRsym = (size = '13px') => (
    <span style={{ color: '#4ade80', fontSize: size, fontWeight: '500', marginLeft: '3px' }}>CR</span>
  )

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-green-400">Your Portfolio</h1>
          <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white transition text-sm">
            ← Back to Dashboard
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 rounded-2xl p-6 text-center">
            <p className="text-gray-400 text-sm mb-2">Credits Available</p>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-2xl font-bold">{profile?.credits?.toLocaleString()}</span>
              {CRsym('16px')}
            </div>
          </div>
          <div className="bg-gray-900 rounded-2xl p-6 text-center">
            <p className="text-gray-400 text-sm mb-2">Portfolio Value</p>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-2xl font-bold">{totalValue.toLocaleString()}</span>
              {CRsym('16px')}
            </div>
          </div>
          <div className="bg-gray-900 rounded-2xl p-6 text-center">
            <p className="text-gray-400 text-sm mb-2">Total Profit / Loss</p>
            <div className="flex items-baseline justify-center gap-1">
              <span className={`text-2xl font-bold ${totalPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalPL >= 0 ? '+' : ''}{totalPL.toLocaleString()}
              </span>
              {CRsym('16px')}
            </div>
          </div>
        </div>

        {/* Holdings */}
        {holdings.length === 0 ? (
          <div className="bg-gray-900 rounded-2xl p-8 text-center">
            <p className="text-gray-400 mb-4">You haven't invested in any artists yet.</p>
            <button onClick={() => router.push('/explore')} className="bg-green-400 text-black font-bold px-6 py-3 rounded-xl hover:bg-green-300 transition">
              Explore Artists
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {holdings.map(h => {
              const artist = artistData[h.artist_id]
              const currentPrice = artist ? getPrice(artist) : h.buy_price
              const currentValue = h.shares * currentPrice
              const pl = getProfitLoss(h)
              const plPercent = artist ? (((currentPrice - h.buy_price) / h.buy_price) * 100).toFixed(1) : 0

              return (
                <div
                  key={h.id}
                  className="bg-gray-900 rounded-2xl p-6 cursor-pointer hover:bg-gray-800 transition"
                  onClick={() => router.push(`/artist/${h.artist_id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {artist?.image ? (
                        <img src={artist.image} alt={h.artist_name} className="w-14 h-14 rounded-full object-cover" />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center text-2xl">🎵</div>
                      )}
                      <div>
                        <p className="font-bold text-lg">{h.artist_name}</p>
                        <p className="text-gray-400 text-sm">
                          {h.shares} shares · bought at {h.buy_price.toLocaleString()} <span style={{ color: '#4ade80', fontSize: '11px' }}>CR</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-baseline justify-end gap-1">
                        <span className="font-bold text-lg">{currentValue.toLocaleString()}</span>
                        <span style={{ color: '#4ade80', fontSize: '12px', fontWeight: '500' }}>CR</span>
                      </div>
                      {pl !== null && (
                        <p className={`text-sm font-bold ${pl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {pl >= 0 ? '+' : ''}{pl.toLocaleString()} ({plPercent}%)
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {holdings.length > 0 && (
          <button onClick={() => router.push('/explore')} className="w-full mt-6 bg-green-400 text-black font-bold py-4 rounded-2xl hover:bg-green-300 transition text-lg">
            Explore More Artists
          </button>
        )}

      </div>
    </main>
  )
}