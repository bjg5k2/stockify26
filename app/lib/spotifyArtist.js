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

export async function fetchSpotifyArtist(id) {
  const token = await getSpotifyToken()
  const res = await fetch(`https://api.spotify.com/v1/artists/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const artist = await res.json()
  return {
    id: artist.id,
    name: artist.name,
    followers: artist.followers.total,
    popularity: artist.popularity,
  }
}

export function getPrice({ followers, popularity }) {
  return Math.max(10, Math.round(
    (Math.sqrt(followers) * (popularity / 10) + (popularity * popularity / 200)) / 10
  ))
}
