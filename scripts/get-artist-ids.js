require('dotenv').config({ path: '.env.local' })

const ARTIST_NAMES = [
  'Arijit Singh', 'Taylor Swift', 'Ed Sheeran', 'Billie Eilish', 'The Weeknd',
  'Bad Bunny', 'Ariana Grande', 'Drake', 'Eminem', 'Justin Bieber',
  'BTS', 'Bruno Mars', 'Rihanna', 'Adele', 'KAROL G',
  'Coldplay', 'Imagine Dragons', 'BLACKPINK', 'Queen', 'Lana Del Rey',
  'Selena Gomez', 'Olivia Rodrigo', 'Post Malone', 'Kendrick Lamar', 'Travis Scott',
  'Lady Gaga', 'Dua Lipa', 'Harry Styles', 'The Beatles', 'Kanye West',
  'Morgan Wallen', 'Sabrina Carpenter', 'SZA', 'Future', 'Peso Pluma',
  'Shakira', 'Daddy Yankee', 'J Balvin', 'Maluma', 'Ozuna',
  'Linkin Park', 'Metallica', 'AC/DC', 'Guns N Roses', 'Red Hot Chili Peppers',
  'Michael Jackson', 'David Bowie', 'Elton John', 'Bob Dylan', 'Frank Sinatra',
  'Beyonce', 'Nicki Minaj', 'Cardi B', 'Megan Thee Stallion', 'Doja Cat',
  'The Chainsmokers', 'Calvin Harris', 'David Guetta', 'Marshmello', 'Diplo',
  'Luke Combs', 'Zach Bryan', 'Chris Stapleton', 'Toby Keith', 'Kenny Chesney',
  'Rauw Alejandro', 'Anuel AA', 'Fuerza Regida', 'Natanael Cano', 'Junior H',
  'Noah Kahan', 'Hozier', 'Gracie Abrams', 'Chappell Roan', 'Benson Boone',
  'Tyler the Creator', 'J Cole', 'Lil Baby', 'Gunna', '21 Savage',
  'Steve Lacy', 'Frank Ocean', 'Daniel Caesar', 'Giveon', 'Lucky Daye',
  'Glass Animals', 'Arctic Monkeys', 'Tame Impala', 'Radiohead', 'Bon Iver',
  'Miley Cyrus', 'Katy Perry', 'Pink', 'Lizzo', 'Meghan Trainor',
  'Camila Cabello', 'Shawn Mendes', 'Charlie Puth', 'Conan Gray', 'Troye Sivan',
  'SZA', 'Jhene Aiko', 'Summer Walker', 'H.E.R.', 'Jazmine Sullivan'
]

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

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  const token = await getSpotifyToken()
  const results = []

  for (const name of ARTIST_NAMES) {
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=artist&limit=1`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )
    const data = await res.json()
    const artist = data.artists?.items?.[0]
    if (artist) {
      results.push({ name: artist.name, id: artist.id })
      console.log(`✓ ${artist.name} → ${artist.id}`)
    } else {
      console.log(`✗ Not found: ${name}`)
    }
    await sleep(100)
  }

  console.log('\nFull results:')
  console.log(JSON.stringify(results, null, 2))
  console.log('\nJust the IDs:')
  console.log(JSON.stringify(results.map(r => r.id)))
}

main()
