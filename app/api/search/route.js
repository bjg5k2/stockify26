async function getSpotifyToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
    },
    body: 'grant_type=client_credentials'
  })

  const data = await res.json()
  return data.access_token
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query) {
    return Response.json({ error: 'No query provided' }, { status: 400 })
  }

  try {
    const token = await getSpotifyToken()

    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=8`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )

    const data = await res.json()
    const artists = data.artists.items.map(artist => ({
      id: artist.id,
      name: artist.name,
      image: artist.images[0]?.url || null,
      followers: artist.followers.total,
      popularity: artist.popularity,
      genres: artist.genres.slice(0, 2)
    }))

    return Response.json({ artists })
  } catch (err) {
    return Response.json({ error: 'Failed to fetch artists' }, { status: 500 })
  }
}