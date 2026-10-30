import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import { uploadProfilePhoto } from '../lib/api'
import { errorMessage } from '../lib/constants'
import { REQUIREMENT_COLUMNS, memberCode, requirementsComplete } from '../lib/tracker'
import { useToast } from '../context/ToastContext'
import Avatar from '../components/Avatar'
import ChangePassword from './ChangePassword'

const TRACKER_FIELDS = 'gforms, registration_form, photo_2x2, interview, membership_fee, members(photo_url)'

export default function Account() {
  const { profile, user, refreshAccess } = useAuth()
  const toast = useToast()
  const [uploading, setUploading] = useState(false)
  const [memberPhoto, setMemberPhoto] = useState('')
  const [tracker, setTracker] = useState(null)
  const [registration, setRegistration] = useState(null)
  const code = profile?.member_no ? memberCode(profile.member_no) : ''
  const photo = profile?.photo_url || memberPhoto
  const showRequirements = profile?.role !== 'adviser' && Boolean(profile?.member_no)

  const requirements = useMemo(() => {
    if (!tracker) return []
    return REQUIREMENT_COLUMNS.map((column) => ({
      ...column,
      done: Boolean(tracker[column.key]),
    }))
  }, [tracker])

  const doneCount = requirements.filter((item) => item.done).length
  const missing = requirements.filter((item) => !item.done)
  const complete = tracker ? requirementsComplete(tracker) : false

  useEffect(() => {
    if (!profile?.member_no) {
      setMemberPhoto('')
      setTracker(null)
      setRegistration(null)
      return undefined
    }
    let ignore = false
    supabase
      .from('membership_tracker')
      .select(TRACKER_FIELDS)
      .eq('member_no', profile.member_no)
      .maybeSingle()
      .then(({ data }) => {
        if (ignore) return
        if (!profile.photo_url) setMemberPhoto(data?.members?.photo_url || '')
        setTracker(data || null)
      })
    supabase
      .from('registrations')
      .select('application_status, remarks')
      .eq('member_no', profile.member_no)
      .maybeSingle()
      .then(({ data }) => {
        if (!ignore) setRegistration(data || null)
      })
    return () => {
      ignore = true
    }
  }, [profile?.member_no, profile?.photo_url])

  async function onPhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !user) return
    setUploading(true)
    try {
      await uploadProfilePhoto(user.id, file)
      await refreshAccess()
      toast.success('Profile photo saved.')
    } catch (err) {
      toast.error(err?.code === 'PGRST202' ? 'Run supabase/users.sql in the Supabase SQL Editor, then try the photo again.' : errorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="page account-page">
      {registration?.application_status === 'declined' && (
        <div className="account-notice account-notice-warn" role="status">
          <strong>Your registration was not approved.</strong>
          <span>{registration.remarks?.trim() || 'An officer declined this registration.'} You can submit a new one.</span>
        </div>
      )}
      {registration?.application_status === 'pending' && (
        <div className="account-notice" role="status">
          <strong>Your registration is on hold.</strong>
          <span>An officer is still reviewing the form.</span>
        </div>
      )}
      {registration?.application_status === 'approved' && tracker?.registration_form && !tracker?.interview && (
        <div className="account-notice" role="status">
          <strong>You are ready for interview.</strong>
          <span>Your registration is approved. An officer will schedule the interview.</span>
        </div>
      )}
      <section className="account-card">
        <label className="account-photo">
          <Avatar src={photo} name={profile?.full_name || profile?.username} size={108} className="ring" />
          <span>{uploading ? 'Saving…' : 'Change photo'}</span>
          <input type="file" accept="image/*" onChange={onPhoto} disabled={uploading} />
        </label>
        <div className="account-identity">
          <p className="eyebrow">Account</p>
          <h1>{profile?.full_name || 'My account'}</h1>
          <p className="muted">Your personal KISLAP account.</p>
          <dl className="account-meta">
            {code && (
              <div>
                <dt>Membership ID</dt>
                <dd>{code}</dd>
              </div>
            )}
            <div>
              <dt>Role</dt>
              <dd>{profile?.role === 'adviser' ? 'Adviser' : profile?.role || 'member'}</dd>
            </div>
          </dl>
          {profile?.role !== 'adviser' && (
            <div className="account-actions">
              <Link to="/register" className="btn btn-primary">
                Open my registration
              </Link>
              <p>
                {registration?.application_status === 'declined'
                  ? 'Open the form to read why it was declined and submit a new registration.'
                  : 'Open a form that is on hold or approved to review it and correct any details.'}
              </p>
            </div>
          )}
        </div>
      </section>

      {showRequirements && (
        <section className="account-requirements">
          <div className="account-requirements-head">
            <div>
              <p className="eyebrow">Membership tracker</p>
              <h2>Your requirements</h2>
              <p className="muted">
                {complete
                  ? 'All required items are marked complete on the tracker.'
                  : missing.length
                    ? `${missing.length} still missing · ${doneCount} of ${requirements.length} marked submitted`
                    : 'Loading your tracker requirements…'}
              </p>
              <p className="muted small">View only. An officer marks GForms, 2×2, Interview, and Fee. Registration is marked automatically after your form is approved.</p>
            </div>
            <span className={`badge ${complete ? 'badge-approved' : 'badge-submitted'}`}>
              {complete ? 'Complete' : 'In progress'}
            </span>
          </div>
          <ul className="requirement-list">
            {REQUIREMENT_COLUMNS.map((column) => {
              const done = Boolean(tracker?.[column.key])
              const detail = done
                ? (column.key === 'registration_form' ? 'Approved' : 'Submitted')
                : column.key === 'registration_form'
                  ? 'Waiting for approval'
                  : column.required
                    ? 'Missing'
                    : 'Optional · not yet'
              return (
                <li key={column.key} className={done ? 'is-done' : 'is-missing'}>
                  <span className="requirement-icon" aria-hidden="true">
                    {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                  </span>
                  <div>
                    <strong>{column.label}</strong>
                    <small>{detail}</small>
                  </div>
                  <span className={`requirement-status ${done ? 'done' : 'missing'}`}>
                    {done ? 'Done' : 'Needed'}
                  </span>
                </li>
              )
            })}
          </ul>
          {missing.length > 0 && (
            <p className="muted small">
              Still needed: {missing.map((item) => item.short).join(', ')}.
            </p>
          )}
        </section>
      )}

      <ChangePassword />
    </div>
  )
}
