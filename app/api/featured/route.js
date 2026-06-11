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

export async function GET() {
  try {
    const token = await getSpotifyToken()

    const res = await fetch(
      'https://api.spotify.com/v1/artists/74KM79TiuVKeVCqs8QtB0B',
      { headers: { 'Authorization': `Bearer ${token}` } }
    )

    const artist = await res.json()

    return Response.json({
      name: artist.name,
      image: artist.images[0]?.url || null,
      followers: artist.followers.total,
    })
  } catch (err) {
    return Response.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}