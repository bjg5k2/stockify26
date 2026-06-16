import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const filePath = searchParams.get('path')
  if (!filePath) return new Response('Missing path', { status: 400 })

  const { data, error } = await supabaseAdmin.storage
    .from('radio-tracks')
    .download(filePath)

  if (error || !data) {
    return new Response('Track not found', { status: 404 })
  }

  return new Response(data, {
    headers: {
      'Content-Type': data.type || 'audio/mpeg',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
