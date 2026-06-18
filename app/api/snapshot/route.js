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
  return Math.max(10, Math.round(Math.sqrt(followers) / 2 + (popularity * popularity) / 8))
}

function getPopularityDividendRate(popularity) {
  if (popularity >= 93) return 0.5
  if (popularity >= 85) return 0.25
  if (popularity >= 75) return 0.1
  return 0
}

function getLegacyDividendRate(followers) {
  if (followers >= 100000000) return 5
  if (followers >= 50000000) return 3
  if (followers >= 10000000) return 1
  return 0
}

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: transactions } = await supabase
      .from('transactions')
      .select('artist_id, artist_name')
      .eq('type', 'buy')

    if (!transactions || transactions.length === 0) {
      return Response.json({ message: 'No artists to snapshot' })
    }

    const uniqueArtists = [...new Map(transactions.map(t => [t.artist_id, t])).values()]

    const token = await getSpotifyToken()
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    let totalSnapshotted = 0
    const priceMap = {}
    const artistDataMap = {}

    const { data: profiles } = await supabase.from('profiles').select('*')

    for (const artistObj of uniqueArtists) {
      try {
        const res = await fetch(
          `https://api.spotify.com/v1/artists/${artistObj.artist_id}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        )
        if (!res.ok) {
          console.error(`Spotify fetch failed for ${artistObj.artist_id}: ${res.status}`)
          continue
        }
        const artist = await res.json()
        if (!artist || !artist.id) continue

        const followers = artist.followers.total
        const popularity = artist.popularity
        const price = getPrice(followers, popularity)

        priceMap[artist.id] = price
        artistDataMap[artist.id] = { followers, popularity, artist_name: artist.name }

        await supabase.from('artist_snapshots').upsert({
          artist_id: artist.id,
          artist_name: artist.name,
          monthly_listeners: followers,
          popularity,
          snapshot_date: today
        }, { onConflict: 'artist_id,snapshot_date' })

        totalSnapshotted++
      } catch (err) {
        console.error('Failed to fetch artist:', artistObj.artist_id, err.message)
      }
      await new Promise(r => setTimeout(r, 150))
    }

    for (const profile of profiles) {
      const { data: userHoldings } = await supabase
        .from('holdings')
        .select('*')
        .eq('user_id', profile.id)

      let totalValue = 0
      if (userHoldings && userHoldings.length > 0) {
        for (const h of userHoldings) {
          if (priceMap[h.artist_id]) totalValue += h.shares * priceMap[h.artist_id]
        }
      }

      await supabase.from('portfolio_snapshots').upsert({
        user_id: profile.id,
        total_value: Math.round(totalValue),
        credits: profile.credits,
        snapshot_date: today
      }, { onConflict: 'user_id,snapshot_date' })
    }

    // ── Dividend distribution ────────────────────────────────────────────────
    const isMonday = new Date().getDay() === 1

    const { data: todaySnaps } = await supabase
      .from('artist_snapshots')
      .select('artist_id, artist_name, monthly_listeners, popularity')
      .eq('snapshot_date', today)

    const snapMap = {}
    for (const s of todaySnaps || []) {
      snapMap[s.artist_id] = { followers: s.monthly_listeners, popularity: s.popularity, artist_name: s.artist_name }
    }

    const { data: allHoldings } = await supabase
      .from('holdings')
      .select('user_id, artist_id, shares')

    const holdingsByUser = {}
    for (const h of allHoldings || []) {
      if (!holdingsByUser[h.user_id]) holdingsByUser[h.user_id] = []
      holdingsByUser[h.user_id].push(h)
    }

    const dividendsByUser = {}
    let totalDividendsPaid = 0
    let usersDividendedCount = 0

    for (const profile of profiles) {
      if (profile.is_admin) continue

      const userHoldings = holdingsByUser[profile.id] || []
      if (userHoldings.length === 0) continue

      let totalDividend = 0
      const dividendBreakdown = []

      for (const h of userHoldings) {
        const artistData = snapMap[h.artist_id]
        if (!artistData) continue

        const { followers, popularity, artist_name } = artistData
        let artistDividend = 0

        const popRate = getPopularityDividendRate(popularity)
        artistDividend += h.shares * popRate

        if (isMonday) {
          const legacyRate = getLegacyDividendRate(followers)
          artistDividend += h.shares * legacyRate
        }

        if (artistDividend > 0) {
          totalDividend += artistDividend
          dividendBreakdown.push({ artist_name, amount: artistDividend })
        }
      }

      totalDividend = Math.round(totalDividend)
      if (totalDividend <= 0) continue

      await supabase
        .from('profiles')
        .update({ credits: profile.credits + totalDividend })
        .eq('id', profile.id)

      await supabase.from('transactions').insert({
        user_id: profile.id,
        artist_id: null,
        artist_name: 'Dividends',
        type: 'dividend',
        shares: 0,
        price_per_share: 0,
        total: totalDividend,
      })

      const breakdownText = dividendBreakdown
        .map(d => `${d.artist_name} (+${Math.round(d.amount) || '<1'} CR)`)
        .join(', ')

      const notifTitle = isMonday
        ? `Dividends + Legacy Bonus — +${totalDividend.toLocaleString()} CR`
        : `Daily Dividends — +${totalDividend.toLocaleString()} CR`

      await supabase.from('notifications').insert({
        user_id: profile.id,
        type: 'dividend',
        title: notifTitle,
        body: `You earned ${totalDividend.toLocaleString()} CR in dividends today: ${breakdownText}`,
        read: false,
      })

      dividendsByUser[profile.id] = totalDividend
      totalDividendsPaid += totalDividend
      usersDividendedCount++
    }

    // ── Price alerts ─────────────────────────────────────────────────────────
    const { data: allAlerts } = await supabase.from('price_alerts').select('*')
    const alertsToDelete = []

    for (const alert of allAlerts || []) {
      const artistData = snapMap[alert.artist_id]
      if (!artistData) continue

      const currentPrice = getPrice(artistData.followers, artistData.popularity)
      const currentTier = artistData.popularity >= 93 ? 3
        : artistData.popularity >= 85 ? 2
        : artistData.popularity >= 75 ? 1
        : 0

      let fired = false
      let notifTitle = ''
      let notifBody = ''

      if (alert.alert_type === 'price_pct') {
        const lastPrice = alert.last_price || currentPrice
        const pctChange = ((currentPrice - lastPrice) / lastPrice) * 100
        if (Math.abs(pctChange) >= alert.threshold) {
          fired = true
          const dir = pctChange > 0 ? '📈' : '📉'
          notifTitle = `${dir} ${alert.artist_name} moved ${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(1)}% today`
          notifBody = `${alert.artist_name} moved from ${Math.round(lastPrice).toLocaleString()} CR to ${currentPrice.toLocaleString()} CR — a ${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(1)}% change. Your alert threshold is ${alert.threshold}%.`
        }
        await supabase.from('price_alerts').update({ last_price: currentPrice }).eq('id', alert.id)

      } else if (alert.alert_type === 'price_milestone') {
        const MILESTONES = [100, 500, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000]
        const lastPrice = alert.last_price || 0
        const crossedMilestones = MILESTONES.filter(m =>
          (lastPrice < m && currentPrice >= m) || (lastPrice > m && currentPrice <= m)
        )
        if (crossedMilestones.length > 0) {
          const dir = currentPrice > lastPrice ? '📈' : '📉'
          const milestonesStr = crossedMilestones.map(m => m >= 1000 ? `${m / 1000}K` : m).join(', ')
          notifTitle = `${dir} ${alert.artist_name} crossed a price milestone`
          notifBody = `${alert.artist_name} is now ${currentPrice.toLocaleString()} CR — crossed the ${milestonesStr} CR milestone${crossedMilestones.length > 1 ? 's' : ''}.`
          fired = true
        }
        await supabase.from('price_alerts').update({ last_price: currentPrice }).eq('id', alert.id)

      } else if (alert.alert_type === 'popularity_tier') {
        const lastTier = alert.last_tier ?? currentTier
        if (currentTier !== lastTier) {
          const tierNames = { 0: 'no dividend', 1: 'dividend eligible (75+)', 2: 'premium dividend (85+)', 3: 'top dividend (93+)' }
          const dir = currentTier > lastTier ? '📈' : '📉'
          const movement = currentTier > lastTier ? 'moved up to' : 'dropped to'
          fired = true
          notifTitle = `${dir} ${alert.artist_name} ${movement} a new popularity tier`
          notifBody = `${alert.artist_name} is now in the ${tierNames[currentTier]} tier (popularity ${artistData.popularity}). Previously: ${tierNames[lastTier]} tier.`
        }
        await supabase.from('price_alerts').update({ last_tier: currentTier }).eq('id', alert.id)
      }

      if (fired) {
        await supabase.from('notifications').insert({
          user_id: alert.user_id,
          type: 'price_alert',
          title: notifTitle,
          body: notifBody,
          read: false,
        })
      }
    }

    if (alertsToDelete.length > 0) {
      await supabase.from('price_alerts').delete().in('id', alertsToDelete)
    }

    // ── Morning market summary ────────────────────────────────────────────────
    const { data: yesterdayArtistSnaps } = await supabase
      .from('artist_snapshots')
      .select('artist_id, monthly_listeners, popularity')
      .eq('snapshot_date', yesterdayStr)

    const yesterdayPriceMap = {}
    for (const s of yesterdayArtistSnaps || []) {
      yesterdayPriceMap[s.artist_id] = getPrice(s.monthly_listeners, s.popularity)
    }

    const { data: todayPortfolioSnaps } = await supabase
      .from('portfolio_snapshots')
      .select('user_id, total_value, credits')
      .eq('snapshot_date', today)

    const rankedToday = (todayPortfolioSnaps || [])
      .filter(s => !profiles.find(p => p.id === s.user_id && p.is_admin))
      .map(s => ({ user_id: s.user_id, netWorth: (s.total_value || 0) + (s.credits || 0) }))
      .sort((a, b) => b.netWorth - a.netWorth)

    const rankMap = {}
    rankedToday.forEach((s, i) => { rankMap[s.user_id] = i + 1 })

    for (const profile of profiles) {
      if (profile.is_admin) continue

      const userHoldings = holdingsByUser[profile.id] || []
      if (userHoldings.length === 0) continue

      let biggestMover = null
      let biggestMovePct = 0

      for (const h of userHoldings) {
        const artistData = snapMap[h.artist_id]
        if (!artistData) continue
        const todayPrice = getPrice(artistData.followers, artistData.popularity)
        const yPrice = yesterdayPriceMap[h.artist_id]
        if (!yPrice) continue
        const pct = ((todayPrice - yPrice) / yPrice) * 100
        if (Math.abs(pct) > Math.abs(biggestMovePct)) {
          biggestMovePct = pct
          biggestMover = { name: artistData.artist_name, pct, todayPrice }
        }
      }

      const dividendsEarned = dividendsByUser[profile.id] || 0
      const todaySnap = (todayPortfolioSnaps || []).find(s => s.user_id === profile.id)
      const todayNW = todaySnap ? (todaySnap.total_value || 0) + (todaySnap.credits || 0) : 0
      const rank = rankMap[profile.id] || null
      const totalUsers = rankedToday.length

      const bodyParts = []
      if (dividendsEarned > 0) bodyParts.push(`💰 Dividends: +${dividendsEarned.toLocaleString()} CR`)
      if (biggestMover) {
        const dir = biggestMovePct > 0 ? '📈' : '📉'
        bodyParts.push(`${dir} Biggest mover: ${biggestMover.name} (${biggestMovePct >= 0 ? '+' : ''}${biggestMovePct.toFixed(1)}% → ${biggestMover.todayPrice.toLocaleString()} CR)`)
      }
      if (rank) bodyParts.push(`🏆 Leaderboard rank: #${rank} of ${totalUsers}`)
      if (todayNW > 0) bodyParts.push(`💼 Net worth: ${todayNW.toLocaleString()} CR`)

      if (bodyParts.length === 0) continue

      await supabase.from('notifications').insert({
        user_id: profile.id,
        type: 'market_summary',
        title: `📊 Market Open — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        body: bodyParts.join('\n'),
        read: false,
      })
    }

    return Response.json({
      success: true,
      artists_snapshotted: totalSnapshotted,
      users_snapshotted: profiles.length,
      dividends_paid: totalDividendsPaid,
      users_dividended: usersDividendedCount,
      alerts_fired: alertsToDelete.length,
    })

  } catch (err) {
    console.error('Snapshot error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
