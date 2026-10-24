import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import { uploadProfilePhoto } from '../lib/api'
import { errorMessage } from '../lib/constants'
import { memberCode } from '../lib/tracker'
import { useToast } from '../context/ToastContext'
import Avatar from '../components/Avatar'
import ChangePassword from './ChangePassword'

export default function Account() {
  const { profile, user, refreshAccess } = useAuth()
  const toast = useToast()
  const [uploading, setUploading] = useState(false)
  const [memberPhoto, setMemberPhoto] = useState('')
  const [readyForInterview, setReadyForInterview] = useState(false)
  const code = profile?.member_no ? memberCode(profile.member_no) : ''
  const photo = profile?.photo_url || memberPhoto

  useEffect(() => {
    if (!profile?.member_no) {
      setMemberPhoto('')
      setReadyForInterview(false)
      return undefined
    }
    let ignore = false
    supabase
      .from('membership_tracker')
      .select('registration_form, interview, members(photo_url)')
      .eq('member_no', profile.member_no)
      .maybeSingle()
      .then(({ data }) => {
        if (ignore) return
        if (!profile.photo_url) setMemberPhoto(data?.members?.photo_url || '')
        setReadyForInterview(Boolean(data?.registration_form) && !data?.interview)
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
      {readyForInterview && (
        <div className="account-notice" role="status">
          <strong>You are ready for interview.</strong>
          <span>Your registration is submitted. An officer will schedule the interview.</span>
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
              <p>Open a submitted or approved form to review it and correct any details.</p>
            </div>
          )}
        </div>
      </section>

      <ChangePassword />
    </div>
  )
}
