import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

function getPrice(followers, popularity) {
  return Math.max(1, Math.round((Math.sqrt(followers) * (popularity / 10) + (popularity * popularity / 200)) / 10))
}

export async function GET() {
  try {
    const { data: snapshots } = await supabase
      .from('artist_snapshots')
      .select('*')
      .order('snapshot_date', { ascending: true })

    const byArtist = {}
    ;(snapshots || []).forEach(s => {
      if (!byArtist[s.artist_id]) byArtist[s.artist_id] = []
      byArtist[s.artist_id].push(s)
    })

    const movers = Object.entries(byArtist)
      .filter(([, snaps]) => snaps.length >= 2)
      .map(([id, snaps]) => {
        const first = snaps[0]
        const last = snaps[snaps.length - 1]
        const growth = first.monthly_listeners > 0
          ? ((last.monthly_listeners - first.monthly_listeners) / first.monthly_listeners) * 100
          : 0
        const pop = last.popularity ?? 91
        const price = getPrice(last.monthly_listeners, pop)
        return { artist_id: id, artist_name: last.artist_name, growth, price }
      })
      .sort((a, b) => Math.abs(b.growth) - Math.abs(a.growth))
      .slice(0, 10)

    return Response.json({ movers })
  } catch (err) {
    return Response.json({ movers: [] })
  }
}