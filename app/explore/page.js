'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Explore() {
  const [query, setQuery] = useState('')
  const [artists, setArtists] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
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

  const getPrice = (artist) => {
    const followers = artist.followers
    const popularity = artist.popularity
    return Math.round(Math.sqrt(followers) * (popularity / 10) + (popularity * popularity / 200))
  }

  const searchArtists = async () => {
    if (!query) return
    setLoading(true)
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
    const data = await res.json()
    setArtists(data.artists || [])
    setLoading(false)
  }

  return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh', fontFamily: 'sans-serif', color: '#fff' }}>

      {/* Navbar */}
      <nav style={{ borderBottom: '0.5px solid #1a1a1a', padding: '14px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: '#4ade80', fontSize: '18px', fontWeight: '500', cursor: 'pointer' }} onClick={() => router.push('/dashboard')}>Stockify</div>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <span onClick={() => router.push('/dashboard')} style={{ color: '#555', fontSize: '13px', cursor: 'pointer' }}>Portfolio</span>
          <span style={{ color: '#fff', fontSize: '13px', cursor: 'pointer' }}>Explore</span>
          <span style={{ color: '#555', fontSize: '13px', cursor: 'pointer' }}>Leaderboard</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ color: '#fff', fontWeight: '500' }}>{profile?.credits?.toLocaleString()}</span>
            <span style={{ color: '#4ade80', fontSize: '12px', fontWeight: '500' }}>CR</span>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px' }}>

        <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: '500', letterSpacing: '-0.5px', marginBottom: '8px' }}>Explore Artists</h1>
        <p style={{ color: '#555', fontSize: '14px', marginBottom: '28px' }}>Search any artist and invest with your credits.</p>

        {/* Search */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '28px' }}>
          <input
            style={{ flex: 1, background: '#0f0f0f', border: '0.5px solid #2a2a2a', borderRadius: '8px', padding: '12px 16px', color: '#fff', fontSize: '14px', outline: 'none' }}
            placeholder="Search for an artist..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchArtists()}
          />
          <button
            onClick={searchArtists}
            style={{ background: '#4ade80', color: '#000', fontSize: '14px', fontWeight: '500', padding: '12px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
          >
            Search
          </button>
        </div>

        {/* Message */}
        {message && (
          <div style={{ background: '#0f2a18', border: '0.5px solid #1a4a2a', borderRadius: '8px', padding: '12px 16px', color: '#4ade80', fontSize: '13px', marginBottom: '16px' }}>
            {message}
          </div>
        )}

        {loading && <p style={{ color: '#555', fontSize: '14px' }}>Searching...</p>}

        {/* Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {artists.map(artist => (
            <div
              key={artist.id}
              onClick={() => router.push(`/artist/${artist.id}`)}
              style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}
            >
              {artist.image ? (
                <img src={artist.image} alt={artist.name} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>🎵</div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#ddd', fontSize: '15px', fontWeight: '500', marginBottom: '3px' }}>{artist.name}</div>
                <div style={{ color: '#555', fontSize: '12px' }}>{artist.followers.toLocaleString()} followers · popularity {artist.popularity}/100</div>
                {artist.genres.length > 0 && (
                  <div style={{ color: '#444', fontSize: '11px', marginTop: '2px' }}>{artist.genres.join(', ')}</div>
                )}
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', justifyContent: 'flex-end' }}>
                  <span style={{ color: '#fff', fontSize: '16px', fontWeight: '500' }}>{getPrice(artist).toLocaleString()}</span>
                  <span style={{ color: '#4ade80', fontSize: '12px', fontWeight: '500' }}>CR</span>
                </div>
                <div style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>per share</div>
              </div>

              <div style={{ color: '#333', fontSize: '18px', flexShrink: 0 }}>›</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}