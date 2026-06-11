'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [profile, setProfile] = useState(null)
  const [holdings, setHoldings] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      const { data: holdingsData } = await supabase
        .from('holdings')
        .select('*')
        .eq('user_id', user.id)

      setProfile(profileData)
      setHoldings(holdingsData || [])
      setLoading(false)
    }
    getData()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  if (loading) return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <p className="text-gray-400">Loading...</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-green-400">Stockify</h1>
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-white transition text-sm"
          >
            Log Out
          </button>
        </div>

        {/* User Info */}
        <div className="bg-gray-900 rounded-2xl p-6 mb-6">
          <p className="text-gray-400 text-sm">Welcome back,</p>
          <h2 className="text-2xl font-bold">{profile?.username}</h2>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-green-400 text-3xl font-bold">{profile?.credits}</span>
            <span className="text-gray-400">credits available</span>
          </div>
        </div>

        {/* Portfolio */}
        <div className="bg-gray-900 rounded-2xl p-6 mb-6">
          <h3 className="text-xl font-bold mb-4">Your Portfolio</h3>
          {holdings.length === 0 ? (
            <p className="text-gray-400">You haven't invested in any artists yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {holdings.map(h => (
                <div key={h.id} className="flex justify-between items-center bg-gray-800 p-4 rounded-xl">
                  <div>
                    <p className="font-bold">{h.artist_name}</p>
                    <p className="text-gray-400 text-sm">{h.shares} shares</p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-bold">{h.shares * h.buy_price} credits</p>
                    <p className="text-gray-400 text-sm">@ {h.buy_price} each</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Explore Button */}
        <button
          onClick={() => router.push('/explore')}
          className="w-full bg-green-400 text-black font-bold py-4 rounded-2xl hover:bg-green-300 transition text-lg"
        >
          Explore Artists
        </button>

      </div>
    </main>
  )
}