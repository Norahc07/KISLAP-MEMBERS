import { supabase } from '../supabaseClient'
import { toPayload } from './youthProfiling'

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

export async function fetchYouthProfiles() {
  const { data, error } = await supabase
    .from('youth_profiles')
    .select('*')
    .order('barangay')
    .order('last_name')
    .order('first_name')
  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('youth_profiles')) {
      throw new Error('Run supabase/youth-profiling.sql in the Supabase SQL Editor, then try again.')
    }
    throw error
  }
  return data || []
}

export async function fetchYouthProfile(id) {
  return unwrap(await supabase.from('youth_profiles').select('*').eq('id', id).maybeSingle())
}

export async function fetchYouthByClientId(clientId) {
  return unwrap(await supabase.from('youth_profiles').select('*').eq('client_id', clientId).maybeSingle())
}

export async function upsertYouthProfile(form, { collectedBy = null } = {}) {
  const payload = toPayload(form, { collectedBy })
  const { data, error } = await supabase.rpc('upsert_youth_profile', { payload })
  if (error) {
    if (error.code === 'PGRST202' || error.message?.includes('upsert_youth_profile')) {
      throw new Error('Run supabase/youth-profiling.sql in the Supabase SQL Editor, then try again.')
    }
    throw error
  }
  return data
}

export async function deleteYouthProfile(id) {
  return unwrap(await supabase.from('youth_profiles').delete().eq('id', id))
}

export async function fetchYouthBarangayStats() {
  const { data, error } = await supabase.rpc('youth_profiling_barangay_stats')
  if (error) {
    if (error.code === 'PGRST202') {
      throw new Error('Run supabase/youth-profiling.sql in the Supabase SQL Editor, then try again.')
    }
    throw error
  }
  return data || []
}
