import { supabase } from '../supabaseClient'
import { runMembershipOpsAgent, runYouthInsightsAgent } from './agentRunner'

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

function isSchemaSetupError(error) {
  const message = String(error?.message || '')
  return (
    error?.code === 'PGRST202' ||
    error?.code === 'PGRST205' ||
    /agent_definitions|agent_runs|agent_proposals|create_agent_run|finish_agent_run/i.test(message)
  )
}

function schemaSetupError() {
  return new Error('Run supabase/agents.sql in the Supabase SQL Editor, then try again.')
}

export async function fetchAgentDefinitions() {
  const { data, error } = await supabase.from('agent_definitions').select('*').eq('enabled', true).order('sort_order')
  if (error) {
    if (isSchemaSetupError(error)) throw schemaSetupError()
    throw error
  }
  return data || []
}

export async function fetchAgentRuns(limit = 20) {
  const { data, error } = await supabase
    .from('agent_runs')
    .select('*, agent_definitions(name, desk, kind)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    if (isSchemaSetupError(error)) throw schemaSetupError()
    throw error
  }
  return data || []
}

export async function fetchAgentProposals(status = 'pending') {
  let query = supabase
    .from('agent_proposals')
    .select('*, agent_definitions(name, desk), agent_runs(summary, trigger_source, created_at)')
    .order('created_at', { ascending: false })
    .limit(40)
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) {
    if (isSchemaSetupError(error)) throw schemaSetupError()
    throw error
  }
  return data || []
}

export async function resolveAgentProposal(proposalId, status, note = '') {
  const { data, error } = await supabase.rpc('resolve_agent_proposal', {
    p_proposal_id: proposalId,
    p_status: status,
    p_note: note,
  })
  if (error) {
    if (isSchemaSetupError(error)) throw schemaSetupError()
    throw error
  }
  return data
}

/**
 * Starts a DB run, executes the local deterministic pilot agent, then finishes the run.
 * Optional Edge Function can enhance summaries when deployed with an LLM key.
 */
export async function runAgent(agentId, { triggerSource = 'office', input = {} } = {}) {
  const { data: run, error } = await supabase.rpc('create_agent_run', {
    p_agent_id: agentId,
    p_trigger_source: triggerSource,
    p_input: input,
  })
  if (error) {
    if (isSchemaSetupError(error)) throw schemaSetupError()
    throw error
  }

  try {
    let outcome
    if (agentId === 'membership_ops') {
      outcome = await runMembershipOpsAgent(input)
    } else if (agentId === 'youth_insights') {
      outcome = await runYouthInsightsAgent(input)
    } else {
      throw new Error('Unknown agent.')
    }

    // Best-effort LLM polish via Edge Function (ignored if not deployed).
    try {
      const { data: polished, error: edgeError } = await supabase.functions.invoke('run-agent', {
        body: { agentId, summary: outcome.summary, result: outcome.result },
      })
      if (!edgeError && polished?.summary) {
        outcome = {
          ...outcome,
          summary: polished.summary,
          result: { ...outcome.result, ...(polished.result || {}), llm_enhanced: true },
        }
      }
    } catch {
      /* Edge Function optional */
    }

    const finished = await unwrap(
      await supabase.rpc('finish_agent_run', {
        p_run_id: run.id,
        p_status: outcome.proposals?.length ? 'waiting_approval' : 'done',
        p_summary: outcome.summary,
        p_result: outcome.result,
        p_error_message: '',
        p_proposals: outcome.proposals || [],
      }),
    )
    return finished
  } catch (error) {
    await supabase.rpc('finish_agent_run', {
      p_run_id: run.id,
      p_status: 'failed',
      p_summary: '',
      p_result: {},
      p_error_message: error?.message || String(error),
      p_proposals: [],
    })
    throw error
  }
}
