import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { fetchSpotifyArtist } from '../../../lib/spotifyArtist'
import { CHALLENGES } from '../../../lib/challenges'

export async function POST(request) {
  const auth = request.headers.get('Authorization') ?? ''
  const token = auth.replace('Bearer ', '')
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const { data: { user }, error: authErr } = await anonClient.auth.getUser(token)
  if (authErr || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000)
  const todaysChallenges = [0, 1, 2].map(i => CHALLENGES[(dayOfYear + i) % CHALLENGES.length])
  const todayStr = new Date().toISOString().split('T')[0]
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const { data: todayTx } = await supabaseAdmin
    .from('transactions').select('*').eq('user_id', user.id)
    .gte('created_at', startOfDay.toISOString())

  let priorArtistIds = new Set()
  if (todaysChallenges.some(c => c.type === 'new_artist')) {
    const { data: priorTx } = await supabaseAdmin
      .from('transactions').select('artist_id').eq('user_id', user.id)
      .lt('created_at', startOfDay.toISOString())
    priorArtistIds = new Set((priorTx || []).map(t => t.artist_id))
  }

  let firstInvestorToday = false
  if (todaysChallenges.some(c => c.type === 'first_investor_today')) {
    const { data: todayBadges } = await supabaseAdmin
      .from('badges').select('id').eq('user_id', user.id).eq('badge_type', 'first_investor')
      .gte('awarded_at', startOfDay.toISOString())
    firstInvestorToday = (todayBadges || []).length > 0
  }

  const ctx = {
    todayTx: todayTx || [],
    priorArtistIds,
    firstInvestorToday,
    getArtist: fetchSpotifyArtist,
  }

  let totalNewReward = 0
  const results = []

  for (const challenge of todaysChallenges) {
    const { data: existing } = await supabaseAdmin
      .from('daily_challenge_completions').select('*')
      .eq('user_id', user.id).eq('completion_date', todayStr).eq('challenge_type', challenge.type)
      .maybeSingle()

    if (existing) {
      results.push({ type: challenge.type, description: challenge.description, reward: challenge.reward, completed: true, rewardEarned: existing.reward })
      continue
    }

    const met = await challenge.check(ctx)
    if (met) {
      try {
        await supabaseAdmin.from('daily_challenge_completions').insert({
          user_id: user.id, completion_date: todayStr, challenge_type: challenge.type, reward: challenge.reward,
        })
        totalNewReward += challenge.reward
        results.push({ type: challenge.type, description: challenge.description, reward: challenge.reward, completed: true, rewardEarned: challenge.reward })
      } catch {
        results.push({ type: challenge.type, description: challenge.description, reward: challenge.reward, completed: true, rewardEarned: challenge.reward })
      }
    } else {
      results.push({ type: challenge.type, description: challenge.description, reward: challenge.reward, completed: false, rewardEarned: 0 })
    }
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('credits').eq('id', user.id).single()

  let newCredits = profile?.credits ?? 0
  if (totalNewReward > 0) {
    newCredits += totalNewReward
    await supabaseAdmin.from('profiles').update({ credits: newCredits }).eq('id', user.id)
  }

  return Response.json({
    success: true,
    challenges: results,
    new_credits: newCredits,
  })
}
