'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function ArtistPage() {
  const [artist, setArtist] = useState(null)
  const [profile, setProfile] = useState(null)
  const [holding, setHolding] = useState(null)
  const [buyAmount, setBuyAmount] = useState(1)
  const [sellAmount, setSellAmount] = useState(1)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { id } = useParams()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(profileData)

      const { data: holdingData } = await supabase
        .from('holdings')
        .select('*')
        .eq('user_id', user.id)
        .eq('artist_id', id)
        .single()
      setHolding(holdingData || null)

      const res = await fetch(`/api/artist?id=${id}`)
      const data = await res.json()
      setArtist(data.artist)
      setLoading(false)
    }
    getData()
  }, [id])

  const getPrice = (artist) => Math.max(1, Math.round(artist.followers / 10000))

  const showMessage = (msg) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 3000)
  }

  const buyShares = async () => {
    const amount = parseInt(buyAmount)
    const price = getPrice(artist)
    const totalCost = amount * price

    if (totalCost > profile.credits) { showMessage('Not enough credits!'); return }

    const { data: { user } } = await supabase.auth.getUser()

    if (holding) {
      await supabase
        .from('holdings')
        .update({ shares: holding.shares + amount })
        .eq('id', holding.id)
      setHolding({ ...holding, shares: holding.shares + amount })
    } else {
      const { data } = await supabase.from('holdings').insert({
        user_id: user.id,
        artist_id: artist.id,
        artist_name: artist.name,
        shares: amount,
        buy_price: price
      }).select().single()
      setHolding(data)
    }

    await supabase
      .from('profiles')
      .update({ credits: profile.credits - totalCost })
      .eq('id', user.id)

    setProfile({ ...profile, credits: profile.credits - totalCost })
    showMessage(`Bought ${amount} share(s) for ${totalCost} credits!`)
  }

  const sellShares = async () => {
    const amount = parseInt(sellAmount)
    if (!holding || amount > holding.shares) { showMessage('Not enough shares!'); return }

    const price = getPrice(artist)
    const totalReturn = amount * price

    const { data: { user } } = await supabase.auth.getUser()

    if (holding.shares - amount === 0) {
      await supabase.from('holdings').delete().eq('id', holding.id)
      setHolding(null)
    } else {
      await supabase
        .from('holdings')
        .update({ shares: holding.shares - amount })
        .eq('id', holding.id)
      setHolding({ ...holding, shares: holding.shares - amount })
    }

    await supabase
      .from('profiles')
      .update({ credits: profile.credits + totalReturn })
      .eq('id', user.id)

    setProfile({ ...profile, credits: profile.credits + totalReturn })
    showMessage(`Sold ${amount} share(s) for ${totalReturn} credits!`)
  }

  if (loading) return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <p className="text-gray-400">Loading...</p>
    </main>
  )

  if (!artist) return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <p className="text-gray-400">Artist not found.</p>
    </main>
  )

  const price = getPrice(artist)

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white transition text-sm"
          >
            ← Back
          </button>
          <span className="text-green-400 font-bold">{profile?.credits} credits</span>
        </div>

        {/* Artist Info */}
        <div className="bg-gray-900 rounded-2xl p-6 mb-6 flex items-center gap-6">
          {artist.image ? (
            <img src={artist.image} alt={artist.name} className="w-24 h-24 rounded-full object-cover" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center text-4xl">🎵</div>
          )}
          <div>
            <h1 className="text-3xl font-bold">{artist.name}</h1>
            <p className="text-gray-400">{artist.followers.toLocaleString()} followers</p>
            {artist.genres.length > 0 && (
              <p className="text-gray-500 text-sm mt-1">{artist.genres.join(', ')}</p>
            )}
            <p className="text-green-400 font-bold text-xl mt-2">{price} credits per share</p>
          </div>
        </div>

        {/* Current Holding */}
        {holding && (
          <div className="bg-gray-900 rounded-2xl p-6 mb-6">
            <h3 className="text-lg font-bold mb-2">Your Position</h3>
            <div className="flex justify-between">
              <div>
                <p className="text-gray-400 text-sm">Shares owned</p>
                <p className="text-2xl font-bold">{holding.shares}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-sm">Current value</p>
                <p className="text-2xl font-bold text-green-400">{holding.shares * price} credits</p>
              </div>
            </div>
          </div>
        )}

        {/* Message */}
        {message && (
          <div className="bg-green-400 text-black font-bold px-4 py-3 rounded-xl mb-6">
            {message}
          </div>
        )}

        {/* Buy */}
        <div className="bg-gray-900 rounded-2xl p-6 mb-4">
          <h3 className="text-lg font-bold mb-4">Buy Shares</h3>
          <div className="flex gap-3">
            <input
              type="number"
              min="1"
              value={buyAmount}
              onChange={e => setBuyAmount(e.target.value)}
              className="w-24 bg-gray-800 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-green-400"
            />
            <div className="flex-1 bg-gray-800 rounded-xl px-4 py-3 text-gray-400">
              Cost: <span className="text-white font-bold">{buyAmount * price} credits</span>
            </div>
            <button
              onClick={buyShares}
              className="bg-green-400 text-black font-bold px-6 py-3 rounded-xl hover:bg-green-300 transition"
            >
              Buy
            </button>
          </div>
        </div>

        {/* Sell */}
        {holding && (
          <div className="bg-gray-900 rounded-2xl p-6">
            <h3 className="text-lg font-bold mb-4">Sell Shares</h3>
            <div className="flex gap-3">
              <input
                type="number"
                min="1"
                max={holding.shares}
                value={sellAmount}
                onChange={e => setSellAmount(e.target.value)}
                className="w-24 bg-gray-800 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-green-400"
              />
              <div className="flex-1 bg-gray-800 rounded-xl px-4 py-3 text-gray-400">
                Return: <span className="text-white font-bold">{sellAmount * price} credits</span>
              </div>
              <button
                onClick={sellShares}
                className="bg-red-500 text-white font-bold px-6 py-3 rounded-xl hover:bg-red-400 transition"
              >
                Sell
              </button>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}