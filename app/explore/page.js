'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Explore() {
  const [query, setQuery] = useState('')
  const [artists, setArtists] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [buyAmount, setBuyAmount] = useState({})
  const [message, setMessage] = useState('')
  const router = useRouter()

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)
    }
    getProfile()
  }, [])

  const searchArtists = async () => {
    if (!query) return
    setLoading(true)
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
    const data = await res.json()
    setArtists(data.artists || [])
    setLoading(false)
  }

  const getPrice = (artist) => Math.max(1, Math.round(artist.followers / 10000))

  const buyShares = async (artist) => {
    const amount = parseInt(buyAmount[artist.id] || 1)
    const price = getPrice(artist)
    const totalCost = amount * price

    if (totalCost > profile.credits) {
      setMessage('Not enough credits!')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()

    const { data: existing } = await supabase
      .from('holdings')
      .select('*')
      .eq('user_id', user.id)
      .eq('artist_id', artist.id)
      .single()

    if (existing) {
      await supabase.from('holdings').update({ shares: existing.shares + amount }).eq('id', existing.id)
    } else {
      await supabase.from('holdings').insert({
        user_id: user.id,
        artist_id: artist.id,
        artist_name: artist.name,
        shares: amount,
        buy_price: price
      })
    }

    await supabase.from('profiles').update({ credits: profile.credits - totalCost }).eq('id', user.id)
    setProfile({ ...profile, credits: profile.credits - totalCost })
    setMessage(`Bought ${amount} share(s) of ${artist.name} for ${totalCost.toLocaleString()} CR!`)
    setTimeout(() => setMessage(''), 3000)
  }

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-green-400">Explore Artists</h1>
          <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white transition text-sm">
            ← Back to Dashboard
          </button>
        </div>

        {/* Credits */}
        {profile && (
          <div className="bg-gray-900 rounded-2xl p-4 mb-6 flex items-baseline gap-2">
            <span className="text-white font-bold text-xl">{profile.credits.toLocaleString()}</span>
            <span style={{ color: '#4ade80', fontSize: '14px', fontWeight: '500' }}>CR</span>
            <span className="text-gray-400 text-sm ml-1">available</span>
          </div>
        )}

        {/* Message */}
        {message && (
          <div className="bg-green-400 text-black font-bold px-4 py-3 rounded-xl mb-6">
            {message}
          </div>
        )}

        {/* Search */}
        <div className="flex gap-3 mb-8">
          <input
            className="flex-1 bg-gray-900 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-green-400"
            placeholder="Search for an artist..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchArtists()}
          />
          <button onClick={searchArtists} className="bg-green-400 text-black font-bold px-6 py-3 rounded-xl hover:bg-green-300 transition">
            Search
          </button>
        </div>

        {/* Results */}
        {loading && <p className="text-gray-400">Searching...</p>}
        <div className="flex flex-col gap-4">
          {artists.map(artist => (
            <div key={artist.id} className="bg-gray-900 rounded-2xl p-4 flex items-center gap-4">

              {artist.image ? (
                <img src={artist.image} alt={artist.name} className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-2xl">🎵</div>
              )}

              <div className="flex-1">
                <p
                  className="font-bold text-lg cursor-pointer hover:text-green-400 transition"
                  onClick={() => router.push(`/artist/${artist.id}`)}
                >
                  {artist.name}
                </p>
                <p className="text-gray-400 text-sm">{artist.followers.toLocaleString()} followers</p>
                {artist.genres.length > 0 && (
                  <p className="text-gray-500 text-xs mt-1">{artist.genres.join(', ')}</p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-white font-bold">
                    {getPrice(artist).toLocaleString()} <span style={{ color: '#4ade80', fontSize: '12px' }}>CR</span>
                  </p>
                  <p className="text-gray-400 text-xs">per share</p>
                </div>
                <input
                  type="number"
                  min="1"
                  value={buyAmount[artist.id] || 1}
                  onChange={e => setBuyAmount({ ...buyAmount, [artist.id]: e.target.value })}
                  className="w-16 bg-gray-800 rounded-lg px-2 py-1 text-white text-center outline-none"
                />
                <button onClick={() => buyShares(artist)} className="bg-green-400 text-black font-bold px-4 py-2 rounded-xl hover:bg-green-300 transition">
                  Buy
                </button>
              </div>

            </div>
          ))}
        </div>

      </div>
    </main>
  )
}