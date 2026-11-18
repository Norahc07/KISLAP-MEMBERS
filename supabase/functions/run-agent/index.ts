// Optional Supabase Edge Function: polish agent summaries with an LLM.
// Deploy only after setting OPENAI_API_KEY (or compatible) in function secrets.
// The React app still works without this function — deterministic digests run client-side.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const body = await req.json()
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ summary: body?.summary || '', skipped: true }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const prompt = `Polish this KISLAP staff digest into 2-3 crisp sentences. Keep all numbers. Do not invent facts.\n\n${body?.summary || ''}`
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a concise operations assistant for a youth volunteer organization.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      return new Response(JSON.stringify({ summary: body?.summary || '', error: text }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const json = await response.json()
    const summary = json?.choices?.[0]?.message?.content?.trim() || body?.summary || ''
    return new Response(JSON.stringify({ summary, result: { llm_enhanced: true } }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
