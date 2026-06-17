import { supabaseAdmin } from '../../lib/supabaseAdmin'

const ADMIN_USER_ID = '25aca630-437f-4144-888b-86a8bd857d33' // TODO: replace with your admin account's UUID

async function getSpotifyToken() {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(
        process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
      ).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  })
  const data = await res.json()
  return data.access_token
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { artist_ids } = body

    if (!artist_ids || artist_ids.length === 0) {
      return Response.json({ error: 'artist_ids is required and must not be empty' }, { status: 400 })
    }

    const chunks = []
    for (let i = 0; i < artist_ids.length; i += 50) {
      chunks.push(artist_ids.slice(i, i + 50))
    }

    const token = await getSpotifyToken()
    const today = new Date().toISOString().split('T')[0]
    let totalSeeded = 0

    for (const chunk of chunks) {
      const ids = chunk.join(',')
      const res = await fetch(
        `https://api.spotify.com/v1/artists?ids=${ids}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      )
      const data = await res.json()

      for (const artist of data.artists) {
        if (!artist) continue

        await supabaseAdmin.from('artist_snapshots').upsert({
          artist_id: artist.id,
          artist_name: artist.name,
          monthly_listeners: artist.followers.total,
          popularity: artist.popularity,
          snapshot_date: today,
        }, { onConflict: 'artist_id,snapshot_date' })

        try {
          await supabaseAdmin.from('transactions').insert({
            user_id: ADMIN_USER_ID,
            artist_id: artist.id,
            artist_name: artist.name,
            type: 'buy',
            shares: 0,
            price_per_share: 0,
            total: 0,
          })
        } catch {
          // row already exists — fine, artist is already tracked
        }

        totalSeeded++
      }
    }

    return Response.json({ success: true, seeded: totalSeeded })

  } catch (err) {
    console.error('Seed artists error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
