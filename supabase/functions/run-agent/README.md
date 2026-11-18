# run-agent (optional)

Polishes Membership Ops / Youth Insights digests with an LLM.

1. Set secret: `supabase secrets set OPENAI_API_KEY=...`
2. Deploy: `supabase functions deploy run-agent`

If this function is missing, the app still runs deterministic agent digests in the browser.
