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

  const { artist_id, mode, amount, sell_all } = await request.json()

  let artist, price
  try {
    artist = await fetchSpotifyArtist(artist_id)
    price = getPrice(artist)
  } catch {
    return Response.json({ error: 'Failed to fetch artist data' }, { status: 502 })
  }

  const { data: holding } = await supabaseAdmin
    .from('holdings').select('*').eq('user_id', user.id).eq('artist_id', artist_id).single()
  if (!holding) return Response.json({ error: 'No holding found' }, { status: 400 })

  let sharesToSell
  if (sell_all) {
    sharesToSell = holding.shares
  } else if (mode === 'cr') {
    sharesToSell = (parseInt(amount) || 0) / price
  } else {
    sharesToSell = parseFloat(amount) || 0
  }

  if (!sharesToSell || sharesToSell <= 0) {
    return Response.json({ error: 'Invalid amount' }, { status: 400 })
  }
  if (sharesToSell > holding.shares + 0.0001) {
    return Response.json({ error: 'Not enough shares' }, { status: 400 })
  }

  const returnAmount = Math.floor(sharesToSell * price)

  let holdingRow = null
  let holdingDeleted = false
  if (holding.shares - sharesToSell <= 0.0001) {
    await supabaseAdmin.from('holdings').delete().eq('id', holding.id)
    holdingDeleted = true
  } else {
    const { data } = await supabaseAdmin
      .from('holdings')
      .update({ shares: holding.shares - sharesToSell })
      .eq('id', holding.id)
      .select().single()
    holdingRow = data
  }

  const { data: tx } = await supabaseAdmin
    .from('transactions')
    .insert({ user_id: user.id, artist_id, artist_name: holding.artist_name, type: 'sell', shares: sharesToSell, price_per_share: price, total: returnAmount })
    .select().single()

  const { data: profileRow } = await supabaseAdmin
    .from('profiles').select('credits').eq('id', user.id).single()
  const newCredits = profileRow.credits + returnAmount
  await supabaseAdmin.from('profiles').update({ credits: newCredits }).eq('id', user.id)

  return Response.json({
    success: true,
    shares_sold: sharesToSell,
    return_amount: returnAmount,
    new_credits: newCredits,
    holding: holdingRow,
    holding_deleted: holdingDeleted,
    transaction: tx,
  })
}
