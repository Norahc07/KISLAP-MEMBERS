import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, CloudOff, Wifi } from 'lucide-react'
import DateField from '../components/DateField'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { errorMessage } from '../lib/constants'
import {
  AGE_BANDS,
  AVAILABILITY_DAYS,
  AVAILABILITY_TIME,
  CIVIL_STATUS_OPTIONS,
  COMMUNITY_ISSUES,
  CONTINUE_EDUCATION,
  CONTRIBUTION_AREAS,
  EDUCATIONAL_STATUS,
  EMPLOYMENT_STATUS,
  INTERESTS,
  KISLAP_FAMILIARITY,
  KISLAP_PROGRAMS,
  LIVELIHOOD_INTEREST,
  MAUBAN_BARANGAYS,
  MEMBERSHIP_INTEREST,
  OPPORTUNITIES,
  PWD_OPTIONS,
  PWD_TYPES,
  SEX_OPTIONS,
  SKILLS,
  SKILLS_TO_DEVELOP,
  VOTER_BARANGAY_OPTIONS,
  VOTER_STATUS,
  VOLUNTEER_ACTIVITIES,
  VOLUNTEER_FREQUENCY,
  VOLUNTEER_INTEREST,
  VOLUNTEER_MOTIVATIONS,
  HOUSEHOLD_RELATIONSHIPS,
  YES_NO,
  YOUTH_STEPS,
  emptyYouthProfile,
  fromRow,
  fullName,
  labelOf,
  needsGuardianAssent,
  validateStep,
} from '../lib/youthProfiling'
import { fetchYouthByClientId, fetchYouthProfile, upsertYouthProfile } from '../lib/youthApi'
import { getLocalYouth, isOnline, saveLocalYouth, subscribeOnline } from '../lib/youthOffline'

function ChoiceSet({ legend, hint, children }) {
  return (
    <fieldset className="choice-set">
      <legend>
        {legend}
        {hint ? <small>{hint}</small> : null}
      </legend>
      {children}
    </fieldset>
  )
}

function RadioGrid({ options, value, onChange, compact }) {
  return (
    <div className={`choice-grid${compact ? ' choice-grid-compact' : ''}`}>
      {options.map((option) => {
        const [key, label] = Array.isArray(option) ? option : [option, option]
        const active = value === key || value === String(key)
        return (
          <label key={String(key)} className={`choice${active ? ' active' : ''}`}>
            <input type="radio" checked={active} onChange={() => onChange(key)} />
            <span>{label}</span>
          </label>
        )
      })}
    </div>
  )
}

function CheckGrid({ options, values, onToggle, max }) {
  const selected = values || []
  return (
    <div className="choice-grid">
      {options.map((option) => {
        const [key, label] = Array.isArray(option) ? option : [option, option]
        const active = selected.includes(key)
        const disabled = !active && max && selected.length >= max
        return (
          <label key={key} className={`choice${active ? ' active' : ''}${disabled ? ' is-disabled' : ''}`}>
            <input
              type="checkbox"
              checked={active}
              disabled={disabled}
              onChange={() => {
                if (disabled) return
                onToggle(key)
              }}
            />
            <span>{label}</span>
          </label>
        )
      })}
    </div>
  )
}

export default function YouthForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile, canDo } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState(emptyYouthProfile)
  const [stepIndex, setStepIndex] = useState(0)
  const [missing, setMissing] = useState([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(Boolean(id))
  const [online, setOnline] = useState(isOnline())
  const [blocked, setBlocked] = useState('')

  const steps = YOUTH_STEPS
  const step = steps[Math.min(stepIndex, steps.length - 1)]
  const canCreate = canDo('youth_profiling_create')
  const canUpdate = canDo('youth_profiling_update')

  const setField = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  const setValue = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  function toggleList(key, value) {
    setForm((current) => {
      const list = current[key] || []
      return {
        ...current,
        [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value],
      }
    })
  }

  useEffect(() => subscribeOnline(setOnline), [])

  useEffect(() => {
    let ignore = false
    async function load() {
      if (!id) {
        setForm(emptyYouthProfile())
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        let row = null
        if (online) {
          row = await fetchYouthProfile(id).catch(() => null)
          if (!row) row = await fetchYouthByClientId(id).catch(() => null)
        }
        if (!row) row = await getLocalYouth(id)
        if (!ignore) {
          if (!row) {
            toast.error('Profile not found.')
            navigate('/youth')
            return
          }
          setForm(fromRow(row))
        }
      } catch (error) {
        if (!ignore) toast.error(errorMessage(error))
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    load()
    return () => {
      ignore = true
    }
  }, [id])

  useEffect(() => {
    if (form.age_eligible === false) setBlocked('Only youth aged 14-30 may complete this survey.')
    else if (form.resides_mauban === false) setBlocked('Only residents of Mauban, Quezon may complete this survey.')
    else if (form.consent_agreed === false) setBlocked('Consent is required to participate in youth profiling.')
    else setBlocked('')
  }, [form.age_eligible, form.resides_mauban, form.consent_agreed])

  const displayName = useMemo(() => fullName(form) || 'New youth profile', [form])

  async function persist(nextStatus = 'submitted') {
    if (nextStatus === 'submitted' && !canCreate && !canUpdate) {
      throw new Error('You do not have permission to save youth profiles.')
    }
    const payload = {
      ...form,
      status: nextStatus,
      collection_barangay: form.collection_barangay || form.barangay,
      collected_by: profile?.member_no || null,
    }
    await saveLocalYouth(payload, { syncStatus: online ? 'pending' : 'pending' })
    if (online) {
      const remote = await upsertYouthProfile(payload, { collectedBy: profile?.member_no || null })
      await saveLocalYouth({ ...payload, ...remote, id: remote?.id }, { syncStatus: 'synced' })
      return remote
    }
    return payload
  }

  async function handleNext() {
    const problems = validateStep(step.id, form)
    setMissing(problems)
    if (problems.length) return
    if (blocked && step.id === 'consent') return
    try {
      await saveLocalYouth({ ...form, status: 'draft' }, { syncStatus: 'pending' })
    } catch {
      /* local draft best-effort */
    }
    setStepIndex((value) => Math.min(value + 1, steps.length - 1))
  }

  async function handleSubmit() {
    for (const item of steps) {
      if (item.id === 'review') continue
      const problems = validateStep(item.id, form)
      if (problems.length) {
        setMissing(problems)
        setStepIndex(steps.findIndex((stepItem) => stepItem.id === item.id))
        return
      }
    }
    setSaving(true)
    try {
      await persist('submitted')
      toast.success(online ? 'Youth profile saved.' : 'Saved offline. It will sync when you are online.')
      navigate('/youth')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const crumbLabel = id ? 'Edit profile' : 'Collect profile'

  if (loading) {
    return (
      <div className="page youth-page">
        <div className="youth-breadcrumbs">
          <Link to="/youth" className="btn btn-soft">
            <ArrowLeft size={16} /> Back
          </Link>
          <ol className="youth-breadcrumb-trail" aria-label="Breadcrumb">
            <li>
              <Link to="/youth">Youth Profiling</Link>
            </li>
            <li aria-current="page">{crumbLabel}</li>
          </ol>
        </div>
        <p className="muted">Loading youth profile...</p>
      </div>
    )
  }

  return (
    <div className="page youth-page">
      <div className="youth-breadcrumbs">
        <Link to="/youth" className="btn btn-soft">
          <ArrowLeft size={16} /> Back
        </Link>
        <ol className="youth-breadcrumb-trail" aria-label="Breadcrumb">
          <li>
            <Link to="/youth">Youth Profiling</Link>
          </li>
          <li aria-current="page">{crumbLabel}</li>
        </ol>
      </div>
      <div className="register-layout">
        <ol className="register-steps">
          {steps.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                className={index === stepIndex ? 'active' : index < stepIndex ? 'done' : ''}
                onClick={() => {
                  if (index <= stepIndex) {
                    setMissing([])
                    setStepIndex(index)
                  }
                }}
                disabled={index > stepIndex}
              >
                <span>{index < stepIndex ? <Check size={14} /> : index + 1}</span>
                <strong>{item.title}</strong>
                <small>{item.section}</small>
              </button>
            </li>
          ))}
        </ol>

        <form
          className="register-card"
          onSubmit={(event) => {
            event.preventDefault()
            if (step.id === 'review') handleSubmit()
            else handleNext()
          }}
        >
          <div className="youth-form-meta">
            <p className="eyebrow">
              Step {stepIndex + 1} of {steps.length} - {step.section}
            </p>
            <span className={`youth-online-pill${online ? '' : ' is-offline'}`}>
              {online ? <Wifi size={14} /> : <CloudOff size={14} />}
              {online ? 'Online' : 'Offline ? saves locally'}
            </span>
          </div>
          <h1>{step.title}</h1>
          <p className="muted">KISLAP Kabataan - Mauban Youth Profiling and Volunteerism Survey</p>

          {blocked && step.id === 'consent' ? <div className="alert">{blocked}</div> : null}
          {missing.length ? (
            <div className="alert" role="alert">
              Please complete: {missing.join(', ')}
            </div>
          ) : null}

          {step.id === 'consent' && (
            <>
              <p>
                Magandang araw, Kabataan ng Mauban! This survey helps KISLAP understand youth interests, skills, and
                willingness to volunteer. Participation does not make you a KISLAP member.
              </p>
              <ChoiceSet legend="1. Are you currently 14-30 years old?" hint="Age 14 is included to track youth becoming eligible for barangay SK voting at 15.">
                <RadioGrid
                  options={[[true, 'Yes'], [false, 'No']]}
                  value={form.age_eligible}
                  onChange={(value) => setValue('age_eligible', value)}
                  compact
                />
              </ChoiceSet>
              <ChoiceSet legend="2. Do you currently reside in the Municipality of Mauban, Quezon?">
                <RadioGrid
                  options={[[true, 'Yes'], [false, 'No']]}
                  value={form.resides_mauban}
                  onChange={(value) => setValue('resides_mauban', value)}
                  compact
                />
              </ChoiceSet>
              <ChoiceSet legend="3. Profiling participation agreement" hint="I understand the purpose of this survey and voluntarily agree to participate.">
                <RadioGrid
                  options={[
                    [true, 'Yes, I agree.'],
                    [false, 'No, I do not agree.'],
                  ]}
                  value={form.consent_agreed}
                  onChange={(value) => setValue('consent_agreed', value)}
                />
              </ChoiceSet>
              <ChoiceSet legend="Age band">
                <RadioGrid options={AGE_BANDS} value={form.age_band} onChange={(value) => setValue('age_band', value)} compact />
              </ChoiceSet>
              {needsGuardianAssent(form.age_band) && (
                <div className="youth-guardian-block">
                  <h2>Parent / guardian permission (ages 14-17)</h2>
                  <label className="field">
                    <span>Guardian name</span>
                    <input className="input" value={form.guardian_name} onChange={setField('guardian_name')} />
                  </label>
                  <ChoiceSet legend="Guardian permission obtained?">
                    <RadioGrid
                      options={[[true, 'Yes'], [false, 'No']]}
                      value={form.guardian_permission}
                      onChange={(value) => setValue('guardian_permission', value)}
                      compact
                    />
                  </ChoiceSet>
                  <ChoiceSet legend="Youth assent obtained?">
                    <RadioGrid
                      options={[[true, 'Yes'], [false, 'No']]}
                      value={form.youth_assent}
                      onChange={(value) => setValue('youth_assent', value)}
                      compact
                    />
                  </ChoiceSet>
                </div>
              )}
            </>
          )}

          {step.id === 'personal' && (
            <>
              <div className="field-row">
                <label className="field">
                  <span>First name</span>
                  <input className="input" value={form.first_name} onChange={setField('first_name')} required />
                </label>
                <label className="field">
                  <span>Middle name</span>
                  <input className="input" value={form.middle_name} onChange={setField('middle_name')} />
                </label>
              </div>
              <div className="field-row">
                <label className="field">
                  <span>Last name</span>
                  <input className="input" value={form.last_name} onChange={setField('last_name')} required />
                </label>
                <label className="field">
                  <span>Suffix</span>
                  <input className="input" value={form.suffix} onChange={setField('suffix')} placeholder="Jr., III" />
                </label>
              </div>
              <label className="field">
                <span>Nickname / preferred name</span>
                <input className="input" value={form.nickname} onChange={setField('nickname')} />
              </label>
              <label className="field">
                <span>Date of birth</span>
                <DateField value={form.date_of_birth} onChange={(value) => setValue('date_of_birth', value)} />
              </label>
              <ChoiceSet legend="Sex">
                <RadioGrid options={SEX_OPTIONS} value={form.sex} onChange={(value) => setValue('sex', value)} compact />
              </ChoiceSet>
              <ChoiceSet legend="Civil status">
                <RadioGrid options={CIVIL_STATUS_OPTIONS} value={form.civil_status} onChange={(value) => setValue('civil_status', value)} />
              </ChoiceSet>
              <ChoiceSet legend="Person with disability (PWD)" hint="Optional. Disclose only if comfortable.">
                <RadioGrid options={PWD_OPTIONS} value={form.pwd} onChange={(value) => setValue('pwd', value)} compact />
              </ChoiceSet>
              {form.pwd === 'yes' && (
                <>
                  <label className="field">
                    <span>Type of disability (optional)</span>
                    <select
                      className="input"
                      value={PWD_TYPES.includes(form.pwd_details) ? form.pwd_details : form.pwd_details ? 'Other / Prefer to describe' : ''}
                      onChange={(event) => setValue('pwd_details', event.target.value)}
                    >
                      <option value="">Prefer not to specify</option>
                      {PWD_TYPES.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {(form.pwd_details === 'Other / Prefer to describe' ||
                    (form.pwd_details && !PWD_TYPES.includes(form.pwd_details))) && (
                    <label className="field">
                      <span>Please describe (optional)</span>
                      <input
                        className="input"
                        value={PWD_TYPES.includes(form.pwd_details) ? '' : form.pwd_details}
                        onChange={(event) => setValue('pwd_details', event.target.value)}
                        placeholder="Short description"
                      />
                    </label>
                  )}
                </>
              )}
              <label className="field">
                <span>Current barangay of residence</span>
                <select className="input" value={form.barangay} onChange={setField('barangay')}>
                  <option value="">Select barangay</option>
                  {MAUBAN_BARANGAYS.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Collection barangay (where gathered)</span>
                <select className="input" value={form.collection_barangay} onChange={setField('collection_barangay')}>
                  <option value="">Same as residence</option>
                  {MAUBAN_BARANGAYS.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <ChoiceSet legend="Are you a registered voter?">
                <RadioGrid options={VOTER_STATUS} value={form.registered_voter} onChange={(value) => setValue('registered_voter', value)} />
              </ChoiceSet>
              {form.registered_voter === 'yes' && (
                <>
                  <label className="field">
                    <span>If yes, in which barangay are you registered?</span>
                    <select className="input" value={form.voter_barangay} onChange={setField('voter_barangay')}>
                      <option value="">Select</option>
                      {VOTER_BARANGAY_OPTIONS.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {form.voter_barangay === 'Registered in another municipality/city' && (
                    <label className="field">
                      <span>Other municipality/city</span>
                      <input className="input" value={form.voter_barangay_other} onChange={setField('voter_barangay_other')} />
                    </label>
                  )}
                </>
              )}
              <ChoiceSet legend="Are you the head of your family/household?">
                <RadioGrid options={YES_NO} value={form.is_household_head} onChange={(value) => setValue('is_household_head', value)} compact />
              </ChoiceSet>
              {form.is_household_head === 'no' && (
                <>
                  <ChoiceSet legend="Relationship to the head of household">
                    <RadioGrid
                      options={HOUSEHOLD_RELATIONSHIPS}
                      value={form.household_relationship}
                      onChange={(value) => setValue('household_relationship', value)}
                    />
                  </ChoiceSet>
                  {form.household_relationship === 'other' && (
                    <label className="field">
                      <span>Please specify</span>
                      <input className="input" value={form.household_relationship_other} onChange={setField('household_relationship_other')} />
                    </label>
                  )}
                </>
              )}
              <label className="field">
                <span>Current address</span>
                <input
                  className="input"
                  value={form.current_address}
                  onChange={(event) => {
                    const value = event.target.value
                    setForm((current) => ({
                      ...current,
                      current_address: value,
                      address: value,
                      permanent_address: current.same_as_current_address ? value : current.permanent_address,
                    }))
                  }}
                  placeholder="House no., street, sitio / purok"
                />
              </label>
              <label className="check-row youth-willing-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(form.same_as_current_address)}
                  onChange={(event) => {
                    const checked = event.target.checked
                    setForm((current) => ({
                      ...current,
                      same_as_current_address: checked,
                      permanent_address: checked ? current.current_address : current.permanent_address,
                    }))
                  }}
                />
                <span>Permanent address is the same as current address</span>
              </label>
              <label className="field">
                <span>Permanent address</span>
                <input
                  className="input"
                  value={form.permanent_address}
                  onChange={setField('permanent_address')}
                  placeholder="House no., street, sitio / purok, barangay / city"
                  disabled={Boolean(form.same_as_current_address)}
                />
              </label>
              <div className="field-row">
                <label className="field">
                  <span>Contact number (optional)</span>
                  <input className="input" value={form.contact_number} onChange={setField('contact_number')} />
                </label>
                <label className="field">
                  <span>Email (optional)</span>
                  <input className="input" type="email" value={form.email} onChange={setField('email')} />
                </label>
              </div>
            </>
          )}

          {step.id === 'education' && (
            <>
              <ChoiceSet legend="Current educational status">
                <RadioGrid options={EDUCATIONAL_STATUS} value={form.educational_status} onChange={(value) => setValue('educational_status', value)} />
              </ChoiceSet>
              <label className="field">
                <span>School / institution (optional)</span>
                <input className="input" value={form.school_name} onChange={setField('school_name')} />
              </label>
              <label className="field">
                <span>Course / strand / program (optional)</span>
                <input className="input" value={form.course_strand} onChange={setField('course_strand')} />
              </label>
              <ChoiceSet legend="Interested in continuing education or further training?">
                <RadioGrid options={CONTINUE_EDUCATION} value={form.continue_education} onChange={(value) => setValue('continue_education', value)} />
              </ChoiceSet>
            </>
          )}

          {step.id === 'employment' && (
            <>
              <ChoiceSet legend="Current employment status">
                <RadioGrid options={EMPLOYMENT_STATUS} value={form.employment_status} onChange={(value) => setValue('employment_status', value)} />
              </ChoiceSet>
              <ChoiceSet legend="Interested in livelihood or entrepreneurship programs?">
                <RadioGrid options={LIVELIHOOD_INTEREST} value={form.livelihood_interest} onChange={(value) => setValue('livelihood_interest', value)} compact />
              </ChoiceSet>
              <ChoiceSet legend="What opportunities would you like to access?" hint="Select all that apply">
                <CheckGrid options={OPPORTUNITIES} values={form.opportunities} onToggle={(value) => toggleList('opportunities', value)} />
              </ChoiceSet>
            </>
          )}

          {step.id === 'skills' && (
            <>
              <ChoiceSet legend="Skills or talents you currently possess" hint="Select all that apply">
                <CheckGrid options={SKILLS} values={form.skills} onToggle={(value) => toggleList('skills', value)} />
              </ChoiceSet>
              <label className="field">
                <span>Other skills or talents to share</span>
                <textarea className="input" rows={3} value={form.other_skills} onChange={setField('other_skills')} />
              </label>
              <ChoiceSet legend="Skills you would like to develop" hint="Select all that apply">
                <CheckGrid options={SKILLS_TO_DEVELOP} values={form.skills_to_develop} onToggle={(value) => toggleList('skills_to_develop', value)} />
              </ChoiceSet>
            </>
          )}

          {step.id === 'interests' && (
            <>
              <ChoiceSet legend="Activities you are interested in" hint="Select all that apply">
                <CheckGrid options={INTERESTS} values={form.interests} onToggle={(value) => toggleList('interests', value)} />
              </ChoiceSet>
              <label className="field">
                <span>What do you usually enjoy during free time?</span>
                <textarea className="input" rows={4} value={form.free_time} onChange={setField('free_time')} />
              </label>
            </>
          )}

          {step.id === 'volunteerism' && (
            <>
              <ChoiceSet legend="Have you participated in volunteer or community service before?">
                <RadioGrid options={YES_NO} value={form.volunteered_before} onChange={(value) => setValue('volunteered_before', value)} compact />
              </ChoiceSet>
              {form.volunteered_before === 'yes' && (
                <ChoiceSet legend="Activities participated in" hint="Select all that apply">
                  <CheckGrid
                    options={VOLUNTEER_ACTIVITIES}
                    values={form.volunteer_activities}
                    onToggle={(value) => toggleList('volunteer_activities', value)}
                  />
                </ChoiceSet>
              )}
              <ChoiceSet legend="What motivates you to volunteer?" hint="Select all that apply">
                <CheckGrid
                  options={VOLUNTEER_MOTIVATIONS}
                  values={form.volunteer_motivations}
                  onToggle={(value) => toggleList('volunteer_motivations', value)}
                />
              </ChoiceSet>
              <ChoiceSet legend="Are you interested in becoming a volunteer?">
                <RadioGrid options={VOLUNTEER_INTEREST} value={form.volunteer_interest} onChange={(value) => setValue('volunteer_interest', value)} />
              </ChoiceSet>
              <ChoiceSet legend="How often can you participate?">
                <RadioGrid options={VOLUNTEER_FREQUENCY} value={form.volunteer_frequency} onChange={(value) => setValue('volunteer_frequency', value)} />
              </ChoiceSet>
              <ChoiceSet legend="Days generally available">
                <CheckGrid options={AVAILABILITY_DAYS} values={form.availability_days} onToggle={(value) => toggleList('availability_days', value)} />
              </ChoiceSet>
              <ChoiceSet legend="Time generally available">
                <RadioGrid options={AVAILABILITY_TIME} value={form.availability_time} onChange={(value) => setValue('availability_time', value)} compact />
              </ChoiceSet>
            </>
          )}

          {step.id === 'community' && (
            <>
              <ChoiceSet legend="Most important issues affecting young people in your barangay" hint="Select up to five">
                <CheckGrid
                  options={COMMUNITY_ISSUES}
                  values={form.community_issues}
                  onToggle={(value) => toggleList('community_issues', value)}
                  max={5}
                />
              </ChoiceSet>
              <label className="field">
                <span>Programs or activities your barangay needs for its youth</span>
                <textarea className="input" rows={3} value={form.barangay_programs_needed} onChange={setField('barangay_programs_needed')} />
              </label>
              <label className="field">
                <span>Community project you would personally propose</span>
                <textarea className="input" rows={3} value={form.proposed_project} onChange={setField('proposed_project')} />
              </label>
              <label className="field">
                <span>Changes you would like to see for young people</span>
                <textarea className="input" rows={3} value={form.desired_changes} onChange={setField('desired_changes')} />
              </label>
            </>
          )}

          {step.id === 'programs' && (
            <>
              <ChoiceSet legend="KISLAP programs of interest" hint="Select all that apply">
                <CheckGrid options={KISLAP_PROGRAMS} values={form.kislap_programs} onToggle={(value) => toggleList('kislap_programs', value)} />
              </ChoiceSet>
              <ChoiceSet legend="Preferred contribution areas" hint="Select up to three">
                <CheckGrid
                  options={CONTRIBUTION_AREAS}
                  values={form.contribution_areas}
                  onToggle={(value) => toggleList('contribution_areas', value)}
                  max={3}
                />
              </ChoiceSet>
              <label className="field">
                <span>What would encourage you to become an active youth volunteer?</span>
                <textarea className="input" rows={3} value={form.volunteer_encouragement} onChange={setField('volunteer_encouragement')} />
              </label>
            </>
          )}

          {step.id === 'membership' && (
            <>
              <ChoiceSet legend="Before this survey, were you familiar with KISLAP Youth Volunteers?">
                <RadioGrid options={KISLAP_FAMILIARITY} value={form.kislap_familiarity} onChange={(value) => setValue('kislap_familiarity', value)} />
              </ChoiceSet>
              <ChoiceSet legend="After learning about KISLAP, are you interested in becoming part of the organization?">
                <RadioGrid options={MEMBERSHIP_INTEREST} value={form.membership_interest} onChange={(value) => setValue('membership_interest', value)} />
              </ChoiceSet>
              <ChoiceSet legend="Would you like KISLAP to contact you about activities, volunteer opportunities, and orientations?">
                <RadioGrid options={YES_NO} value={form.contact_opt_in} onChange={(value) => setValue('contact_opt_in', value)} compact />
              </ChoiceSet>
              {form.contact_opt_in === 'yes' && (
                <div className="field-row">
                  <label className="field">
                    <span>Preferred contact method</span>
                    <input className="input" value={form.preferred_contact_method} onChange={setField('preferred_contact_method')} placeholder="SMS, call, Facebook, email" />
                  </label>
                  <label className="field">
                    <span>Contact details</span>
                    <input className="input" value={form.preferred_contact_details} onChange={setField('preferred_contact_details')} />
                  </label>
                </div>
              )}
            </>
          )}

          {step.id === 'suggestions' && (
            <>
              <label className="field">
                <span>Suggestions to improve youth programs in Mauban</span>
                <textarea className="input" rows={3} value={form.suggestions} onChange={setField('suggestions')} />
              </label>
              <label className="field">
                <span>Anything else about your interests, abilities, or aspirations?</span>
                <textarea className="input" rows={3} value={form.additional_notes} onChange={setField('additional_notes')} />
              </label>
              <ChoiceSet
                legend="Optional: KISLAP communications agreement"
                hint="Agreeing does not make you a member. You may withdraw later."
              >
                <RadioGrid
                  options={[
                    ['yes', 'Yes, I agree to receive KISLAP communications.'],
                    ['no', 'No, I do not wish to receive KISLAP communications.'],
                  ]}
                  value={form.communications_agreement}
                  onChange={(value) => setValue('communications_agreement', value)}
                />
              </ChoiceSet>
              <div className="youth-privacy-note">
                <h2>Privacy notice</h2>
                <p>
                  KISLAP Youth Volunteers collects this information for youth profiling, program planning, volunteer
                  engagement, and optional membership recruitment. Access is limited to authorized KISLAP personnel.
                  Participation is voluntary. Information is retained only as needed for these purposes.
                </p>
              </div>
            </>
          )}

          {step.id === 'review' && (
            <div className="youth-review">
              <h2>{displayName}</h2>
              <dl className="youth-review-grid">
                <div>
                  <dt>Barangay</dt>
                  <dd>{form.barangay || '-'}</dd>
                </div>
                <div>
                  <dt>Current address</dt>
                  <dd>{form.current_address || '-'}</dd>
                </div>
                <div>
                  <dt>Permanent address</dt>
                  <dd>
                    {form.same_as_current_address
                      ? form.current_address || '-'
                      : form.permanent_address || '-'}
                  </dd>
                </div>
                <div>
                  <dt>PWD</dt>
                  <dd>
                    {labelOf(PWD_OPTIONS, form.pwd)}
                    {form.pwd === 'yes' && form.pwd_details ? ` - ${form.pwd_details}` : ''}
                  </dd>
                </div>
                <div>
                  <dt>Age band</dt>
                  <dd>{labelOf(AGE_BANDS, form.age_band)}</dd>
                </div>
                <div>
                  <dt>Volunteer interest</dt>
                  <dd>{labelOf(VOLUNTEER_INTEREST, form.volunteer_interest)}</dd>
                </div>
                <div>
                  <dt>Membership interest</dt>
                  <dd>{labelOf(MEMBERSHIP_INTEREST, form.membership_interest)}</dd>
                </div>
                <div>
                  <dt>Contribution areas</dt>
                  <dd>{(form.contribution_areas || []).join(', ') || '-'}</dd>
                </div>
                <div>
                  <dt>Contact opt-in</dt>
                  <dd>{labelOf(YES_NO, form.contact_opt_in)}</dd>
                </div>
              </dl>
              <p className="muted">
                Submitting saves this profile for KISLAP Kabataan collection only. It does not create an official KISLAP
                membership record.
              </p>
            </div>
          )}

          <div className="register-nav">
            <div className="register-actions">
              {stepIndex > 0 ? (
                <button type="button" className="btn btn-soft" onClick={() => setStepIndex((value) => value - 1)}>
                  <ArrowLeft size={16} /> Back
                </button>
              ) : (
                <Link to="/youth" className="btn btn-soft">
                  <ArrowLeft size={16} /> Cancel
                </Link>
              )}
              <button type="submit" className="btn btn-primary" disabled={saving || Boolean(blocked && step.id === 'consent')}>
                {step.id === 'review' ? (saving ? 'Saving?' : online ? 'Submit profile' : 'Save offline') : (
                  <>
                    Next <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
