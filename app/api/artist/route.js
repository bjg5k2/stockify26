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
  const id = searchParams.get('id')

  if (!id) {
    return Response.json({ error: 'No id provided' }, { status: 400 })
  }

  try {
    const token = await getSpotifyToken()
    console.log('Token:', token)

    const res = await fetch(
      `https://api.spotify.com/v1/artists/${id}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )

    const text = await res.text()
    console.log('Spotify response:', text)

    const artist = JSON.parse(text)

    return Response.json({
      artist: {
        id: artist.id,
        name: artist.name,
        image: artist.images[0]?.url || null,
        followers: artist.followers.total,
        popularity: artist.popularity,
        genres: artist.genres.slice(0, 2)
      }
    })
  } catch (err) {
    console.log('Error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}