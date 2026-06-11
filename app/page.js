'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const FEATURED_IDS = [
  { id: '74KM79TiuVKeVCqs8QtB0B', name: 'Sabrina Carpenter', genre: 'pop · dance pop' },
  { id: '4q3ewBCX7sLwd24euuV69X', name: 'Bad Bunny', genre: 'reggaeton · trap latino' },
  { id: '3l0CmX0FuQjFxr8SK7Vqag', name: 'Clairo', genre: 'indie pop · bedroom pop' },
  { id: '3TVXtAsR1Inumwj472S9r4', name: 'Drake', genre: 'hip hop · rap' },
  { id: '4lxfqrEsLX6N1N4OCSkILp', name: 'Phil Collins', genre: 'pop rock · soft rock' },
  { id: '6yJCxee7QumYr820xdIsjo', name: 'Zach Top', genre: 'country · neo-traditional' },
]

export default function Home() {
  const router = useRouter()
  const [artists, setArtists] = useState(FEATURED_IDS.map(a => ({ ...a, image: null, price: null })))

  useEffect(() => {
    const fetchArtists = async () => {
      const updated = await Promise.all(
        FEATURED_IDS.map(async (a) => {
          try {
            const res = await fetch(`/api/artist?id=${a.id}`)
            const data = await res.json()
            return {
              ...a,
              image: data.artist?.image || null,
              price: data.artist?.followers ? Math.max(1, Math.round(data.artist.followers / 10000)) : null,
            }
          } catch {
            return { ...a, image: null, price: null }
          }
        })
      )
      setArtists(updated)
    }
    fetchArtists()
  }, [])

  return (
    <main style={{ background: '#0a0a0a', fontFamily: 'sans-serif', color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Navbar */}
      <nav style={{ borderBottom: '0.5px solid #1a1a1a', padding: '16px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: '#4ade80', fontSize: '20px', fontWeight: '500', letterSpacing: '-0.5px' }}>Stockify</div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span style={{ color: '#555', fontSize: '14px', cursor: 'pointer' }}>How it works</span>
          <span style={{ color: '#555', fontSize: '14px', cursor: 'pointer' }}>Markets</span>
          <button onClick={() => router.push('/auth')} style={{ background: 'transparent', border: '0.5px solid #2a2a2a', color: '#aaa', fontSize: '14px', padding: '8px 18px', borderRadius: '7px', cursor: 'pointer' }}>Log in</button>
          <button onClick={() => router.push('/auth')} style={{ background: '#4ade80', color: '#000', fontSize: '14px', fontWeight: '500', padding: '8px 18px', borderRadius: '7px', border: 'none', cursor: 'pointer' }}>Get started</button>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ padding: '56px 48px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', borderBottom: '0.5px solid #141414' }}>
        <div style={{ display: 'inline-block', background: '#0f2a18', border: '0.5px solid #1a4a2a', color: '#4ade80', fontSize: '11px', padding: '5px 14px', borderRadius: '20px', marginBottom: '20px', letterSpacing: '0.5px' }}>
          THE MUSIC STOCK MARKET
        </div>
        <h1 style={{ color: '#fff', fontSize: '68px', fontWeight: '500', lineHeight: '1.05', margin: '0 0 18px', letterSpacing: '-3px', maxWidth: '900px' }}>
          Invest in artists.<br />
          <span style={{ color: '#4ade80' }}>Profit from their rise.</span>
        </h1>
        <p style={{ color: '#555', fontSize: '17px', lineHeight: '1.7', maxWidth: '520px', margin: '0 auto 28px' }}>
          Stockify is a music-powered stock market. Buy shares in artists using credits, and profit as their fanbase grows.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '36px' }}>
          <button onClick={() => router.push('/auth')} style={{ background: '#4ade80', color: '#000', fontSize: '15px', fontWeight: '500', padding: '13px 28px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
            Start investing free
          </button>
          <button onClick={() => router.push('/auth')} style={{ background: 'transparent', border: '0.5px solid #2a2a2a', color: '#aaa', fontSize: '15px', padding: '13px 28px', borderRadius: '8px', cursor: 'pointer' }}>
            Log in
          </button>
        </div>
        <div style={{ display: 'flex', gap: '64px', justifyContent: 'center', paddingTop: '28px', borderTop: '0.5px solid #1a1a1a', width: '100%', maxWidth: '500px' }}>
          {[['1,000', 'free credits'], ['50M+', 'artists'], ['Live', 'Spotify data']].map(([val, label]) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ color: '#4ade80', fontSize: '24px', fontWeight: '500' }}>{val}</div>
              <div style={{ color: '#444', fontSize: '13px', marginTop: '3px' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Featured Artists */}
      <div style={{ padding: '36px 48px', borderBottom: '0.5px solid #141414' }}>
        <div style={{ color: '#888', fontSize: '11px', letterSpacing: '1px', marginBottom: '18px', textAlign: 'center' }}>FEATURED ARTISTS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
          {artists.map((a) => (
            <div
              key={a.id}
              onClick={() => router.push('/auth')}
              style={{
                position: 'relative',
                borderRadius: '12px',
                overflow: 'hidden',
                aspectRatio: '2/3',
                maxHeight: '240px',
                border: '0.5px solid #1c1c1c',
                cursor: 'pointer',
                background: '#111',
              }}
            >
              {a.image && (
                <img
                  src={a.image}
                  alt={a.name}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.75 }}
                />
              )}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px' }}>
                <div style={{ color: '#fff', fontSize: '13px', fontWeight: '500', marginBottom: '3px', lineHeight: '1.3' }}>{a.name}</div>
                <div style={{ fontSize: '13px', fontWeight: '500' }}>
                  {a.price ? (
                    <>
                      <span style={{ color: '#fff' }}>{a.price.toLocaleString()}</span>
                      <span style={{ color: '#4ade80' }}> CR</span>
                    </>
                  ) : (
                    <span style={{ color: '#555' }}>Loading...</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Example Investment */}
      <div style={{ padding: '48px 48px', borderBottom: '0.5px solid #141414' }}>
        <div style={{ color: '#4ade80', fontSize: '11px', letterSpacing: '1px', marginBottom: '12px' }}>EXAMPLE INVESTMENT</div>
        <h2 style={{ color: '#fff', fontSize: '28px', fontWeight: '500', margin: '0 0 8px', letterSpacing: '-0.5px' }}>Here's how it works with Sabrina Carpenter</h2>
        <p style={{ color: '#555', fontSize: '15px', marginBottom: '28px' }}>Follow a real investment from start to profit.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
          {[
            { num: '01', title: 'You find her on Stockify', body: 'Sabrina has 45M followers. Her share price is set at', val: '4,500 CR', valColor: '#fff' },
            { num: '02', title: 'You buy 2 shares', body: 'You spend 9,000 credits from your starting balance.', val: '−9,000 CR', valColor: '#f87171' },
            { num: '03', title: 'Her listeners grow', body: 'Sabrina goes on tour. Followers jump to 54M. Price rises to', val: '5,400 CR', valColor: '#4ade80' },
            { num: '04', title: 'You sell your shares', body: 'You sell 2 shares at 5,400 CR each and pocket', val: '+1,800 CR profit', valColor: '#4ade80' },
          ].map((s) => (
            <div key={s.num} style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '10px', padding: '24px' }}>
              <div style={{ color: '#4ade80', fontSize: '11px', fontWeight: '500', marginBottom: '10px', letterSpacing: '0.5px' }}>STEP {s.num}</div>
              <div style={{ color: '#ddd', fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>{s.title}</div>
              <div style={{ color: '#666', fontSize: '14px', lineHeight: '1.6' }}>{s.body}</div>
              <div style={{ color: s.valColor, fontSize: '24px', fontWeight: '500', marginTop: '12px' }}>{s.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div style={{ padding: '48px 48px', borderBottom: '0.5px solid #141414' }}>
        <div style={{ color: '#4ade80', fontSize: '11px', letterSpacing: '1px', marginBottom: '12px' }}>HOW IT WORKS</div>
        <h2 style={{ color: '#fff', fontSize: '28px', fontWeight: '500', margin: '0 0 24px', letterSpacing: '-0.5px' }}>Three steps to your first investment</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
          {[
            { icon: '🔍', title: 'Search any artist', body: 'Find any artist on Spotify. Their share price is based on real follower data, updated regularly.' },
            { icon: '💰', title: 'Buy shares with credits', body: 'Every account starts with 1,000 free credits. No real money involved — just smart picks.' },
            { icon: '📈', title: 'Sell when they rise', body: 'As an artist gains listeners, their price goes up. Sell at the right time to grow your portfolio.' },
          ].map((c) => (
            <div key={c.title} style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '10px', padding: '24px' }}>
              <div style={{ width: '36px', height: '36px', background: '#0f2a18', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', marginBottom: '14px' }}>{c.icon}</div>
              <div style={{ color: '#ddd', fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>{c.title}</div>
              <div style={{ color: '#666', fontSize: '14px', lineHeight: '1.65' }}>{c.body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Bar */}
      <div style={{ padding: '40px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ color: '#fff', fontSize: '26px', fontWeight: '500', letterSpacing: '-0.5px', marginBottom: '6px' }}>Ready to build your portfolio?</h2>
          <p style={{ color: '#555', fontSize: '15px' }}>Join free. No credit card required. 1,000 credits on us.</p>
        </div>
        <button onClick={() => router.push('/auth')} style={{ background: '#4ade80', color: '#000', fontSize: '15px', fontWeight: '500', padding: '13px 28px', borderRadius: '9px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          Create free account
        </button>
      </div>

      {/* Footer */}
      <footer style={{ padding: '16px 48px', borderTop: '0.5px solid #141414', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
        <div style={{ color: '#4ade80', fontSize: '15px', fontWeight: '500' }}>Stockify</div>
        <div style={{ color: '#333', fontSize: '13px' }}>© 2025 Stockify. All rights reserved.</div>
      </footer>

    </main>
  )
}