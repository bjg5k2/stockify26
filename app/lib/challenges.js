export const CHALLENGES = [
  {
    type: 'three_artists',
    description: 'Invest in 3 or more different artists today',
    reward: 100,
    check: async (ctx) => new Set(ctx.todayTx.filter(t => t.type === 'buy').map(t => t.artist_id)).size >= 3,
  },
  {
    type: 'three_trades',
    description: 'Make 3 or more trades today',
    reward: 50,
    check: async (ctx) => ctx.todayTx.length >= 3,
  },
  {
    type: 'new_artist',
    description: "Invest in an artist you haven't before",
    reward: 75,
    check: async (ctx) => {
      const todayBuyIds = ctx.todayTx.filter(t => t.type === 'buy').map(t => t.artist_id)
      return todayBuyIds.some(id => !ctx.priorArtistIds.has(id))
    },
  },
  {
    type: 'bargain',
    description: 'Invest in an artist priced under 500 CR',
    reward: 50,
    check: async (ctx) => ctx.todayTx.some(t => t.type === 'buy' && t.price_per_share < 500),
  },
  {
    type: 'underdog',
    description: 'Invest in an artist with under 100K followers',
    reward: 125,
    check: async (ctx) => {
      const ids = [...new Set(ctx.todayTx.filter(t => t.type === 'buy').map(t => t.artist_id))]
      for (const id of ids) {
        const artistData = await ctx.getArtist(id)
        if (artistData && artistData.followers < 100000) return true
      }
      return false
    },
  },
  {
    type: 'first_investor_today',
    description: 'Be the first investor in an artist',
    reward: 100,
    check: async (ctx) => ctx.firstInvestorToday,
  },
]
