import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function getSpotifyToken() {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(
        process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
      ).toString('base64')
    },
    body: 'grant_type=client_credentials'
  })
  const data = await res.json()
  return data.access_token
}

function getPrice(followers, popularity) {
  return Math.round(Math.sqrt(followers) * (popularity / 10) + (popularity * popularity / 200))
}

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all unique artist IDs from holdings
    const { data: holdings } = await supabase
      .from('holdings')
      .select('artist_id, artist_name')

    if (!holdings || holdings.length === 0) {
      return Response.json({ message: 'No holdings to snapshot' })
    }

    // Deduplicate
    const uniqueArtists = [...new Map(holdings.map(h => [h.artist_id, h])).values()]

    // Chunk into groups of 50
    const chunks = []
    for (let i = 0; i < uniqueArtists.length; i += 50) {
      chunks.push(uniqueArtists.slice(i, i + 50))
    }

    const token = await getSpotifyToken()
    const today = new Date().toISOString().split('T')[0]
    let totalSnapshotted = 0
    const priceMap = {}

    // Fetch each chunk from Spotify
    for (const chunk of chunks) {
      const ids = chunk.map(a => a.artist_id).join(',')
      const res = await fetch(
        `https://api.spotify.com/v1/artists?ids=${ids}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      )
      const data = await res.json()

      for (const artist of data.artists) {
        if (!artist) continue
        const followers = artist.followers.total
        const popularity = artist.popularity
        const price = getPrice(followers, popularity)

        priceMap[artist.id] = price

        await supabase.from('artist_snapshots').upsert({
          artist_id: artist.id,
          artist_name: artist.name,
          monthly_listeners: followers,
          snapshot_date: today
        }, { onConflict: 'artist_id,snapshot_date' })

        totalSnapshotted++
      }
    }

    // Snapshot each user's portfolio value
    const { data: profiles } = await supabase.from('profiles').select('*')

    for (const profile of profiles) {
      const { data: userHoldings } = await supabase
        .from('holdings')
        .select('*')
        .eq('user_id', profile.id)

      let totalValue = 0

      if (userHoldings && userHoldings.length > 0) {
        for (const h of userHoldings) {
          if (priceMap[h.artist_id]) {
            totalValue += h.shares * priceMap[h.artist_id]
          }
        }
      }

      await supabase.from('portfolio_snapshots').upsert({
        user_id: profile.id,
        total_value: Math.round(totalValue),
        credits: profile.credits,
        snapshot_date: today
      }, { onConflict: 'user_id,snapshot_date' })
    }

    return Response.json({
      success: true,
      artists_snapshotted: totalSnapshotted,
      users_snapshotted: profiles.length
    })

  } catch (err) {
    console.error('Snapshot error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}