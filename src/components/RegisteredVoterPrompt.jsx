import { useEffect, useState } from 'react'
import { Vote } from 'lucide-react'
import Modal from './Modal'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { errorMessage } from '../lib/constants'
import { supabase } from '../supabaseClient'

export default function RegisteredVoterPrompt() {
  const { ready, isAdmin, isAdviser, profile } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!ready || isAdmin || isAdviser || !profile?.member_no) {
      setOpen(false)
      return undefined
    }

    let ignore = false
    supabase
      .from('registrations')
      .select('application_status, registered_voter')
      .eq('member_no', profile.member_no)
      .maybeSingle()
      .then(({ data, error }) => {
        if (ignore || error) return
        const needsAnswer =
          data?.application_status === 'approved' &&
          (data.registered_voter == null || data.registered_voter === '')
        setOpen(Boolean(needsAnswer))
      })

    return () => {
      ignore = true
    }
  }, [ready, isAdmin, isAdviser, profile?.member_no])

  async function saveAnswer(value) {
    setBusy(true)
    try {
      const { error } = await supabase.rpc('save_registered_voter', { p_value: value })
      if (error) {
        throw error.code === 'PGRST202'
          ? new Error('Run supabase/registration-form.sql in the Supabase SQL Editor, then try again.')
          : error
      }
      supabase.rpc('log_audit', {
        p_action: 'registered_voter_saved',
        p_summary: `Saved registered voter answer (${value})`,
        p_detail: { registered_voter: value, member_no: profile.member_no },
      }).then(() => {}, () => {})
      setOpen(false)
      toast.success(value === 'yes' ? 'Saved: registered voter — Yes' : 'Saved: registered voter — No')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <Modal
      title="Registered voter"
      subtitle="We added this question to Personal information. Please answer once so your approved registration stays complete."
      onClose={() => {}}
      dismissible={false}
      size="sm"
      className="voter-prompt-modal"
    >
      <div className="voter-prompt">
        <div className="voter-prompt-icon">
          <Vote size={22} />
        </div>
        <p>Are you a registered voter?</p>
        <div className="voter-prompt-actions">
          <button type="button" className="btn btn-soft" disabled={busy} onClick={() => saveAnswer('no')}>
            No
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => saveAnswer('yes')}>
            {busy ? 'Saving…' : 'Yes'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
