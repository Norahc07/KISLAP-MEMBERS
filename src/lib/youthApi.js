import { supabase } from '../supabaseClient'
import { toPayload } from './youthProfiling'

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

function isSchemaSetupError(error) {
  const message = String(error?.message || '')
  return (
    error?.code === 'PGRST202' ||
    error?.code === 'PGRST205' ||
    /youth_profiles|upsert_youth_profile|current_street|current_province|permanent_street|column .* does not exist/i.test(
      message,
    )
  )
}

function schemaSetupError() {
  return new Error(
    'Youth profiling database schema is out of date. Run supabase/youth-profiling.sql in the Supabase SQL Editor, then try again.',
  )
}

export async function fetchYouthProfiles() {
  const { data, error } = await supabase
    .from('youth_profiles')
    .select('*')
    .order('barangay')
    .order('last_name')
    .order('first_name')
  if (error) {
    if (isSchemaSetupError(error)) throw schemaSetupError()
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
    if (isSchemaSetupError(error)) throw schemaSetupError()
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
    if (isSchemaSetupError(error)) throw schemaSetupError()
    throw error
  }
  return data || []
}
