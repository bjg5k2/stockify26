import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { fetchSpotifyArtist, getPrice } from '../../../lib/spotifyArtist'

export async function POST(request) {
  const auth = request.headers.get('Authorization') ?? ''
  const token = auth.replace('Bearer ', '')
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const { data: { user }, error: authErr } = await anonClient.auth.getUser(token)
  if (authErr || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { artist_id, mode, amount } = await request.json()

  let artist, price
  try {
    artist = await fetchSpotifyArtist(artist_id)
    price = getPrice(artist)
  } catch {
    return Response.json({ error: 'Failed to fetch artist data' }, { status: 502 })
  }

  let shares, cost
  if (mode === 'cr') {
    cost = parseInt(amount) || 0
    shares = cost / price
  } else {
    shares = parseFloat(amount) || 0
    cost = Math.floor(shares * price)
  }

  if (!shares || shares <= 0 || !Number.isFinite(shares) || cost < 0) {
    return Response.json({ error: 'Invalid amount' }, { status: 400 })
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('credits, is_admin').eq('id', user.id).single()
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })
  if (cost > profile.credits) return Response.json({ error: 'Not enough credits' }, { status: 400 })

  const { data: existingHolding } = await supabaseAdmin
    .from('holdings').select('*').eq('user_id', user.id).eq('artist_id', artist_id).single()

  let isFirstInvestor = false
  if (!existingHolding && !profile.is_admin) {
    const { data: adminProfiles } = await supabaseAdmin
      .from('profiles').select('id').eq('is_admin', true)
    const adminIds = (adminProfiles || []).map(p => p.id)
    const { data: allHoldings } = await supabaseAdmin
      .from('holdings').select('user_id').eq('artist_id', artist_id)
    const realHoldings = (allHoldings || []).filter(h => !adminIds.includes(h.user_id))
    if (realHoldings.length === 0) isFirstInvestor = true
  }

  let holdingRow
  if (existingHolding) {
    const { data } = await supabaseAdmin
      .from('holdings')
      .update({ shares: existingHolding.shares + shares })
      .eq('id', existingHolding.id)
      .select().single()
    holdingRow = data
  } else {
    const { data } = await supabaseAdmin
      .from('holdings')
      .insert({ user_id: user.id, artist_id, artist_name: artist.name, shares, buy_price: price })
      .select().single()
    holdingRow = data
  }

  const { data: tx } = await supabaseAdmin
    .from('transactions')
    .insert({ user_id: user.id, artist_id, artist_name: artist.name, type: 'buy', shares, price_per_share: price, total: cost })
    .select().single()

  let bonus = 0
  if (isFirstInvestor) {
    bonus = 50
    await supabaseAdmin.from('badges').insert({
      user_id: user.id, badge_type: 'first_investor', artist_id, artist_name: artist.name,
    })
  }

  const newCredits = profile.credits - cost + bonus
  await supabaseAdmin.from('profiles').update({ credits: newCredits }).eq('id', user.id)

  if (!existingHolding) {
    const currentTier = artist.popularity >= 93 ? 3
      : artist.popularity >= 85 ? 2
      : artist.popularity >= 75 ? 1 : 0

    await supabaseAdmin.from('price_alerts').insert([
      {
        user_id: user.id,
        artist_id,
        artist_name: artist.name,
        alert_type: 'price_pct',
        threshold: 3,
        last_price: price,
        last_tier: null,
      },
      {
        user_id: user.id,
        artist_id,
        artist_name: artist.name,
        alert_type: 'price_milestone',
        threshold: 0,
        last_price: price,
        last_tier: null,
      },
      {
        user_id: user.id,
        artist_id,
        artist_name: artist.name,
        alert_type: 'popularity_tier',
        threshold: 0,
        last_price: null,
        last_tier: currentTier,
      },
    ])
  }

  return Response.json({
    success: true,
    shares_bought: shares,
    cost,
    new_credits: newCredits,
    first_investor: isFirstInvestor,
    bonus,
    holding: holdingRow,
    transaction: tx,
  })
}
