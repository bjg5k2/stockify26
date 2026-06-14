export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const artist = searchParams.get('artist')

  if (!artist) {
    return Response.json({ error: 'No artist provided' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(artist)}&api_key=${process.env.LASTFM_API_KEY}&format=json`
    )
    const data = await res.json()

    if (data.error) {
      return Response.json({ bio: null })
    }

    const bio = data.artist?.bio?.summary || null
    let cleanBio = bio ? bio.replace(/<a[^>]*>.*?<\/a>/g, '').replace(/<[^>]*>/g, '').trim() : null

    // Last.fm returns a disambiguation list when multiple artists share a name
    if (cleanBio && /there are (at least )?\d+ artists? (who have used|with the name)/i.test(cleanBio)) {
      cleanBio = null
    }

    return Response.json({
      bio: cleanBio,
      tags: data.artist?.tags?.tag?.map(t => t.name) || [],
      listeners: data.artist?.stats?.listeners || null,
    })
  } catch (err) {
    return Response.json({ bio: null })
  }
}