'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

const FEATURED_IDS = [
  { id: '74KM79TiuVKeVCqs8QtB0B', name: 'Sabrina Carpenter' },
  { id: '4q3ewBCX7sLwd24euuV69X', name: 'Bad Bunny' },
  { id: '3l0CmX0FuQjFxr8SK7Vqag', name: 'Clairo' },
  { id: '3TVXtAsR1Inumwj472S9r4', name: 'Drake' },
  { id: '4lxfqrEsLX6N1N4OCSkILp', name: 'Phil Collins' },
  { id: '6yJCxee7QumYr820xdIsjo', name: 'Zach Top' },
]

const GENRES = [
  { label: '🔥 All', value: '' },
  { label: '🎤 Hip Hop', value: 'hip hop' },
  { label: '🎵 Pop', value: 'pop' },
  { label: '🤠 Country', value: 'country' },
  { label: '🎸 Rock', value: 'rock' },
  { label: '🌎 Latin', value: 'latin' },
  { label: '🎻 R&B', value: 'r&b' },
  { label: '⚡ Electronic', value: 'electronic' },
  { label: '🎷 Jazz', value: 'jazz' },
]

const TRENDING = [
  'Kendrick Lamar', 'Chappell Roan', 'Tyler, the Creator',
  'Billie Eilish', 'Post Malone', 'SZA', 'Morgan Wallen', 'Doechii'
]

export default function Explore() {
  const [query, setQuery] = useState('')
  const [artists, setArtists] = useState([])
  const [featured, setFeatured] = useState(FEATURED_IDS.map(a => ({ ...a, image: null, price: null })))
  const [profile, setProfile] = useState(null)
  const [holdings, setHoldings] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeGenre, setActiveGenre] = useState('')
  const [searched, setSearched] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      const { data: profileData } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(profileData)

      const { data: holdingsData } = await supabase
        .from('holdings').select('artist_id').eq('user_id', user.id)
      setHoldings((holdingsData || []).map(h => h.artist_id))

      const updated = await Promise.all(
        FEATURED_IDS.map(async (a) => {
          try {
            const res = await fetch(`/api/artist?id=${a.id}`)
            const data = await res.json()
            return {
              ...a,
              image: data.artist?.image || null,
              price: data.artist ? getPrice(data.artist) : null,
              popularity: data.artist?.popularity || 0,
            }
          } catch {
            return { ...a, image: null, price: null }
          }
        })
      )
      setFeatured(updated)
    }
    init()
  }, [])

  const getPrice = (artist) => {
    return Math.round((Math.sqrt(artist.followers) * (artist.popularity / 10) + (artist.popularity * artist.popularity / 200)) / 10)
  }

  const searchArtists = async (q) => {
    const searchQuery = q !== undefined ? q : query
    if (!searchQuery) return
    setLoading(true)
    setSearched(true)
    const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
    const data = await res.json()
    setArtists(data.artists || [])
    setQuery(searchQuery)
    setLoading(false)
  }

  const handleGenre = (genre) => {
    setActiveGenre(genre)
    if (genre) searchArtists(genre)
    else {
      setArtists([])
      setSearched(false)
    }
  }

  const handleTrending = (name) => {
    setQuery(name)
    searchArtists(name)
  }

  return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh', fontFamily: 'sans-serif', color: '#fff' }}>

      {/* Navbar */}
      <nav style={{ borderBottom: '0.5px solid #1a1a1a', padding: '20px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: '#4ade80', fontSize: '26px', fontWeight: '500', cursor: 'pointer' }} onClick={() => router.push('/dashboard')}>Stockify</div>
        <div style={{ display: 'flex', gap: '36px', alignItems: 'center' }}>
          <span onClick={() => router.push('/dashboard')} style={{ color: '#666', fontSize: '16px', cursor: 'pointer' }}>Portfolio</span>
          <span style={{ color: '#fff', fontSize: '16px', fontWeight: '500', cursor: 'pointer' }}>Explore</span>
          <span style={{ color: '#666', fontSize: '16px', cursor: 'pointer' }}>Leaderboard</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ color: '#fff', fontWeight: '500', fontSize: '16px' }}>{profile?.credits?.toLocaleString()}</span>
            <span style={{ color: '#4ade80', fontSize: '13px', fontWeight: '500' }}>CR</span>
          </div>
        </div>
      </nav>

      <div style={{ padding: '32px 48px' }}>

        {/* Search */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
          <input
            style={{ flex: 1, background: '#0f0f0f', border: '0.5px solid #2a2a2a', borderRadius: '10px', padding: '14px 20px', color: '#fff', fontSize: '15px', outline: 'none' }}
            placeholder="Search for an artist..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchArtists()}
          />
          <button
            onClick={() => searchArtists()}
            style={{ background: '#4ade80', color: '#000', fontSize: '15px', fontWeight: '500', padding: '14px 28px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}
          >
            Search
          </button>
        </div>

        {/* Featured Artists */}
        {!searched && (
          <>
            <div style={{ color: '#555', fontSize: '11px', letterSpacing: '1px', marginBottom: '16px' }}>FEATURED ARTISTS</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', marginBottom: '32px' }}>
              {featured.map((a) => (
                <div
                  key={a.id}
                  onClick={() => router.push(`/artist/${a.id}`)}
                  style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', aspectRatio: '2/3', maxHeight: '200px', border: '0.5px solid #1c1c1c', cursor: 'pointer', background: '#111' }}
                >
                  {a.image && (
                    <img src={a.image} alt={a.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.75 }} />
                  )}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px' }}>
                    <div style={{ color: '#fff', fontSize: '12px', fontWeight: '500', marginBottom: '3px' }}>{a.name}</div>
                    <div style={{ fontSize: '12px', fontWeight: '500' }}>
                      {a.price ? (
                        <><span style={{ color: '#fff' }}>{a.price.toLocaleString()}</span><span style={{ color: '#4ade80' }}> CR</span></>
                      ) : (
                        <span style={{ color: '#555' }}>Loading...</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Genre Categories */}
        <div style={{ color: '#555', fontSize: '11px', letterSpacing: '1px', marginBottom: '14px' }}>BROWSE BY GENRE</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', flexWrap: 'wrap' }}>
          {GENRES.map(g => (
            <button
              key={g.value}
              onClick={() => handleGenre(g.value)}
              style={{
                background: activeGenre === g.value ? '#0f2a18' : '#0f0f0f',
                border: `0.5px solid ${activeGenre === g.value ? '#1a4a2a' : '#1c1c1c'}`,
                color: activeGenre === g.value ? '#4ade80' : '#888',
                fontSize: '13px',
                padding: '7px 16px',
                borderRadius: '20px',
                cursor: 'pointer',
              }}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* Trending Searches */}
        {!searched && (
          <>
            <div style={{ color: '#555', fontSize: '11px', letterSpacing: '1px', marginBottom: '14px' }}>TRENDING SEARCHES</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', flexWrap: 'wrap' }}>
              {TRENDING.map((name, i) => (
                <button
                  key={name}
                  onClick={() => handleTrending(name)}
                  style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '20px', padding: '6px 14px', color: '#666', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {i < 2 && <span style={{ color: '#f87171', fontSize: '11px' }}>🔥</span>}
                  {name}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Results */}
        {loading && <p style={{ color: '#555', fontSize: '14px' }}>Searching...</p>}

        {searched && !loading && (
          <>
            <div style={{ color: '#555', fontSize: '11px', letterSpacing: '1px', marginBottom: '16px' }}>
              {artists.length} RESULTS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {artists.map(artist => {
                const price = getPrice(artist)
                const isHot = artist.popularity >= 85
                const isOwned = holdings.includes(artist.id)

                return (
                  <div
                    key={artist.id}
                    onClick={() => router.push(`/artist/${artist.id}`)}
                    style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}
                  >
                    {artist.image ? (
                      <img src={artist.image} alt={artist.name} style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>🎵</div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ color: '#ddd', fontSize: '16px', fontWeight: '500' }}>{artist.name}</span>
                        {isHot && (
                          <span style={{ background: '#1a0a0a', border: '0.5px solid #3a1a1a', color: '#f87171', fontSize: '10px', fontWeight: '500', padding: '2px 8px', borderRadius: '10px' }}>🔥 HOT</span>
                        )}
                        {isOwned && (
                          <span style={{ background: '#0f2a18', border: '0.5px solid #1a4a2a', color: '#4ade80', fontSize: '10px', fontWeight: '500', padding: '2px 8px', borderRadius: '10px' }}>✓ OWNED</span>
                        )}
                      </div>
                      <div style={{ color: '#555', fontSize: '13px' }}>
                        {artist.followers.toLocaleString()} followers · popularity {artist.popularity}/100
                        {artist.genres.length > 0 && ` · ${artist.genres.join(', ')}`}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', justifyContent: 'flex-end' }}>
                        <span style={{ color: '#fff', fontSize: '18px', fontWeight: '500' }}>{price.toLocaleString()}</span>
                        <span style={{ color: '#4ade80', fontSize: '13px', fontWeight: '500' }}>CR</span>
                      </div>
                      <div style={{ color: '#555', fontSize: '12px', marginTop: '2px' }}>per share</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </main>
  )
}