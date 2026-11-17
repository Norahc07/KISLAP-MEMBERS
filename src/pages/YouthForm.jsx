import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, CloudOff, Wifi } from 'lucide-react'
import AddressLocationFields from '../components/AddressLocationFields'
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
  formatYouthAddress,
  fromRow,
  fullName,
  labelOf,
  needsGuardianAssent,
  validateStep,
} from '../lib/youthProfiling'
import { fetchYouthByClientId, fetchYouthProfile, upsertYouthProfile } from '../lib/youthApi'
import { getLocalYouth, isOnline, saveLocalYouth, subscribeOnline } from '../lib/youthOffline'

function optionPairs(options) {
  return (options || []).map((option) => (Array.isArray(option) ? option : [option, option]))
}

function SelectField({ label, hint, value, onChange, options, placeholder = 'Select an option' }) {
  const pairs = optionPairs(options)
  const raw = value === null || value === undefined || value === '' ? '' : String(value)
  return (
    <label className="field">
      <span>
        {label}
        {hint ? <small>{hint}</small> : null}
      </span>
      <select
        className="input"
        value={raw}
        onChange={(event) => {
          const next = event.target.value
          if (next === '') {
            onChange('')
            return
          }
          const match = pairs.find(([key]) => String(key) === next)
          onChange(match ? match[0] : next)
        }}
      >
        <option value="">{placeholder}</option>
        {pairs.map(([key, text]) => (
          <option key={String(key)} value={String(key)}>
            {text}
          </option>
        ))}
      </select>
    </label>
  )
}

function MultiSelectField({
  label,
  hint,
  values,
  onChange,
  options,
  max,
  placeholder = 'Select to add…',
}) {
  const selected = values || []
  const pairs = optionPairs(options)
  const available = pairs.filter(([key]) => !selected.includes(key))
  const atMax = Boolean(max && selected.length >= max)

  function add(key) {
    if (!key || selected.includes(key) || atMax) return
    onChange([...selected, key])
  }

  function remove(key) {
    onChange(selected.filter((item) => item !== key))
  }

  return (
    <div className="field youth-multi-select">
      <span>
        {label}
        {hint ? <small>{hint}</small> : null}
      </span>
      <select
        className="input"
        value=""
        disabled={atMax || !available.length}
        onChange={(event) => {
          add(event.target.value)
          event.target.value = ''
        }}
      >
        <option value="">
          {atMax ? `Maximum of ${max} selected` : available.length ? placeholder : 'All options selected'}
        </option>
        {available.map(([key, text]) => (
          <option key={String(key)} value={key}>
            {text}
          </option>
        ))}
      </select>
      {selected.length ? (
        <ul className="youth-multi-chips">
          {selected.map((key) => {
            const text = pairs.find(([item]) => item === key)?.[1] || key
            return (
              <li key={key}>
                <span>{text}</span>
                <button type="button" aria-label={`Remove ${text}`} onClick={() => remove(key)}>
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="muted youth-multi-empty">No selections yet.</p>
      )}
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

  function setList(key, values) {
    setForm((current) => ({ ...current, [key]: values }))
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
      collection_barangay: form.barangay,
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
              <SelectField
                label="1. Are you currently 14-30 years old?"
                hint="Age 14 is included to track youth becoming eligible for barangay SK voting at 15."
                options={[
                  [true, 'Yes'],
                  [false, 'No'],
                ]}
                value={form.age_eligible}
                onChange={(value) => setValue('age_eligible', value === '' ? null : value)}
                placeholder="Select yes or no"
              />
              <SelectField
                label="2. Do you currently reside in the Municipality of Mauban, Quezon?"
                options={[
                  [true, 'Yes'],
                  [false, 'No'],
                ]}
                value={form.resides_mauban}
                onChange={(value) => setValue('resides_mauban', value === '' ? null : value)}
                placeholder="Select yes or no"
              />
              <SelectField
                label="3. Profiling participation agreement"
                hint="I understand the purpose of this survey and voluntarily agree to participate."
                options={[
                  [true, 'Yes, I agree.'],
                  [false, 'No, I do not agree.'],
                ]}
                value={form.consent_agreed}
                onChange={(value) => setValue('consent_agreed', value === '' ? null : value)}
                placeholder="Select your response"
              />
              <SelectField
                label="Age band"
                options={AGE_BANDS}
                value={form.age_band}
                onChange={(value) => setValue('age_band', value)}
                placeholder="Select age band"
              />
              {needsGuardianAssent(form.age_band) && (
                <div className="youth-guardian-block">
                  <h2>Parent / guardian permission (ages 14-17)</h2>
                  <label className="field">
                    <span>Guardian name</span>
                    <input className="input" value={form.guardian_name} onChange={setField('guardian_name')} placeholder="Full name of parent or guardian" />
                  </label>
                  <SelectField
                    label="Guardian permission obtained?"
                    options={[
                      [true, 'Yes'],
                      [false, 'No'],
                    ]}
                    value={form.guardian_permission}
                    onChange={(value) => setValue('guardian_permission', value === '' ? null : value)}
                    placeholder="Select yes or no"
                  />
                  <SelectField
                    label="Youth assent obtained?"
                    options={[
                      [true, 'Yes'],
                      [false, 'No'],
                    ]}
                    value={form.youth_assent}
                    onChange={(value) => setValue('youth_assent', value === '' ? null : value)}
                    placeholder="Select yes or no"
                  />
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
              <SelectField label="Sex" options={SEX_OPTIONS} value={form.sex} onChange={(value) => setValue('sex', value)} placeholder="Select sex" />
              <SelectField
                label="Civil status"
                options={CIVIL_STATUS_OPTIONS}
                value={form.civil_status}
                onChange={(value) => setValue('civil_status', value)}
                placeholder="Select civil status"
              />
              <SelectField
                label="Person with disability (PWD)"
                hint="Optional. Disclose only if comfortable."
                options={PWD_OPTIONS}
                value={form.pwd}
                onChange={(value) => setValue('pwd', value)}
                placeholder="Select an option"
              />
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
                <select
                  className="input"
                  value={form.barangay}
                  onChange={(event) => {
                    const barangay = event.target.value
                    setForm((current) => {
                      const next = { ...current, barangay }
                      if (current.current_city === 'Mauban' || !current.current_barangay) {
                        next.current_barangay = barangay
                        if (current.same_as_current_address) next.permanent_barangay = barangay
                      }
                      return next
                    })
                  }}
                >
                  <option value="">Select barangay</option>
                  {MAUBAN_BARANGAYS.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <SelectField
                label="Are you a registered voter?"
                options={VOTER_STATUS}
                value={form.registered_voter}
                onChange={(value) => setValue('registered_voter', value)}
                placeholder="Select voter status"
              />
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
              <SelectField
                label="Are you the head of your family/household?"
                options={YES_NO}
                value={form.is_household_head}
                onChange={(value) => setValue('is_household_head', value)}
                placeholder="Select yes or no"
              />
              {form.is_household_head === 'no' && (
                <>
                  <SelectField
                    label="Relationship to the head of household"
                    options={HOUSEHOLD_RELATIONSHIPS}
                    value={form.household_relationship}
                    onChange={(value) => setValue('household_relationship', value)}
                    placeholder="Select relationship"
                  />
                  {form.household_relationship === 'other' && (
                    <label className="field">
                      <span>Please specify</span>
                      <input
                        className="input"
                        value={form.household_relationship_other}
                        onChange={setField('household_relationship_other')}
                        placeholder="Describe your relationship"
                      />
                    </label>
                  )}
                </>
              )}
              <AddressLocationFields
                title="Current address"
                street={form.current_street}
                province={form.current_province}
                city={form.current_city}
                barangay={form.current_barangay}
                onChange={({ street, province, city, barangay }) => {
                  setForm((current) => {
                    const next = {
                      ...current,
                      current_street: street,
                      current_province: province,
                      current_city: city,
                      current_barangay: barangay,
                    }
                    if (current.same_as_current_address) {
                      next.permanent_street = street
                      next.permanent_province = province
                      next.permanent_city = city
                      next.permanent_barangay = barangay
                    }
                    return next
                  })
                }}
              />
              <label className="check-row youth-willing-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(form.same_as_current_address)}
                  onChange={(event) => {
                    const checked = event.target.checked
                    setForm((current) => ({
                      ...current,
                      same_as_current_address: checked,
                      permanent_street: checked ? current.current_street : current.permanent_street,
                      permanent_province: checked ? current.current_province : current.permanent_province,
                      permanent_city: checked ? current.current_city : current.permanent_city,
                      permanent_barangay: checked ? current.current_barangay : current.permanent_barangay,
                    }))
                  }}
                />
                <span>Permanent address is the same as current address</span>
              </label>
              <AddressLocationFields
                title="Permanent address"
                street={form.permanent_street}
                province={form.permanent_province}
                city={form.permanent_city}
                barangay={form.permanent_barangay}
                disabled={Boolean(form.same_as_current_address)}
                onChange={({ street, province, city, barangay }) => {
                  setForm((current) => ({
                    ...current,
                    permanent_street: street,
                    permanent_province: province,
                    permanent_city: city,
                    permanent_barangay: barangay,
                  }))
                }}
              />
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
              <SelectField
                label="Current educational status"
                options={EDUCATIONAL_STATUS}
                value={form.educational_status}
                onChange={(value) => setValue('educational_status', value)}
                placeholder="Select educational status"
              />
              <label className="field">
                <span>School / institution (optional)</span>
                <input
                  className="input"
                  value={form.school_name}
                  onChange={setField('school_name')}
                  placeholder="e.g. Mauban South Central School"
                />
              </label>
              <label className="field">
                <span>Course / strand / program (optional)</span>
                <input
                  className="input"
                  value={form.course_strand}
                  onChange={setField('course_strand')}
                  placeholder="e.g. STEM, BSIT, Electrical Installation"
                />
              </label>
              <SelectField
                label="Interested in continuing education or further training?"
                options={CONTINUE_EDUCATION}
                value={form.continue_education}
                onChange={(value) => setValue('continue_education', value)}
                placeholder="Select an option"
              />
            </>
          )}

          {step.id === 'employment' && (
            <>
              <SelectField
                label="Current employment status"
                options={EMPLOYMENT_STATUS}
                value={form.employment_status}
                onChange={(value) => setValue('employment_status', value)}
                placeholder="Select employment status"
              />
              <SelectField
                label="Interested in livelihood or entrepreneurship programs?"
                options={LIVELIHOOD_INTEREST}
                value={form.livelihood_interest}
                onChange={(value) => setValue('livelihood_interest', value)}
                placeholder="Select yes, no, or maybe"
              />
              <MultiSelectField
                label="What opportunities would you like to access?"
                hint="Select all that apply"
                options={OPPORTUNITIES}
                values={form.opportunities}
                onChange={(values) => setList('opportunities', values)}
                placeholder="Select an opportunity to add"
              />
            </>
          )}

          {step.id === 'skills' && (
            <>
              <MultiSelectField
                label="Skills or talents you currently possess"
                hint="Select all that apply"
                options={SKILLS}
                values={form.skills}
                onChange={(values) => setList('skills', values)}
                placeholder="Select a skill to add"
              />
              <label className="field">
                <span>Other skills or talents to share</span>
                <textarea
                  className="input"
                  rows={3}
                  value={form.other_skills}
                  onChange={setField('other_skills')}
                  placeholder="List any other skills or talents not included above"
                />
              </label>
              <MultiSelectField
                label="Skills you would like to develop"
                hint="Select all that apply"
                options={SKILLS_TO_DEVELOP}
                values={form.skills_to_develop}
                onChange={(values) => setList('skills_to_develop', values)}
                placeholder="Select a skill to add"
              />
            </>
          )}

          {step.id === 'interests' && (
            <>
              <MultiSelectField
                label="Activities you are interested in"
                hint="Select all that apply"
                options={INTERESTS}
                values={form.interests}
                onChange={(values) => setList('interests', values)}
                placeholder="Select an activity to add"
              />
              <label className="field">
                <span>What do you usually enjoy during free time?</span>
                <textarea
                  className="input"
                  rows={4}
                  value={form.free_time}
                  onChange={setField('free_time')}
                  placeholder="Describe hobbies, sports, creative work, or other activities you enjoy"
                />
              </label>
            </>
          )}

          {step.id === 'volunteerism' && (
            <>
              <SelectField
                label="Have you participated in volunteer or community service before?"
                options={YES_NO}
                value={form.volunteered_before}
                onChange={(value) => setValue('volunteered_before', value)}
                placeholder="Select yes or no"
              />
              {form.volunteered_before === 'yes' && (
                <MultiSelectField
                  label="Activities participated in"
                  hint="Select all that apply"
                  options={VOLUNTEER_ACTIVITIES}
                  values={form.volunteer_activities}
                  onChange={(values) => setList('volunteer_activities', values)}
                  placeholder="Select an activity to add"
                />
              )}
              <MultiSelectField
                label="What motivates you to volunteer?"
                hint="Select all that apply"
                options={VOLUNTEER_MOTIVATIONS}
                values={form.volunteer_motivations}
                onChange={(values) => setList('volunteer_motivations', values)}
                placeholder="Select a motivation to add"
              />
              <SelectField
                label="Are you interested in becoming a volunteer?"
                options={VOLUNTEER_INTEREST}
                value={form.volunteer_interest}
                onChange={(value) => setValue('volunteer_interest', value)}
                placeholder="Select volunteer interest"
              />
              <SelectField
                label="How often can you participate?"
                options={VOLUNTEER_FREQUENCY}
                value={form.volunteer_frequency}
                onChange={(value) => setValue('volunteer_frequency', value)}
                placeholder="Select frequency"
              />
              <MultiSelectField
                label="Days generally available"
                hint="Select all that apply"
                options={AVAILABILITY_DAYS}
                values={form.availability_days}
                onChange={(values) => setList('availability_days', values)}
                placeholder="Select a day to add"
              />
              <SelectField
                label="Time generally available"
                options={AVAILABILITY_TIME}
                value={form.availability_time}
                onChange={(value) => setValue('availability_time', value)}
                placeholder="Select preferred time"
              />
            </>
          )}

          {step.id === 'community' && (
            <>
              <MultiSelectField
                label="Most important issues affecting young people in your barangay"
                hint="Select up to five"
                options={COMMUNITY_ISSUES}
                values={form.community_issues}
                onChange={(values) => setList('community_issues', values)}
                max={5}
                placeholder="Select an issue to add"
              />
              <label className="field">
                <span>Programs or activities your barangay needs for its youth</span>
                <textarea
                  className="input"
                  rows={3}
                  value={form.barangay_programs_needed}
                  onChange={setField('barangay_programs_needed')}
                  placeholder="e.g. sports leagues, skills training, mental health sessions"
                />
              </label>
              <label className="field">
                <span>Community project you would personally propose</span>
                <textarea
                  className="input"
                  rows={3}
                  value={form.proposed_project}
                  onChange={setField('proposed_project')}
                  placeholder="Briefly describe a project you would like to lead or support"
                />
              </label>
              <label className="field">
                <span>Changes you would like to see for young people</span>
                <textarea
                  className="input"
                  rows={3}
                  value={form.desired_changes}
                  onChange={setField('desired_changes')}
                  placeholder="Share the improvements you hope to see in your community"
                />
              </label>
            </>
          )}

          {step.id === 'programs' && (
            <>
              <MultiSelectField
                label="KISLAP programs of interest"
                hint="Select all that apply"
                options={KISLAP_PROGRAMS}
                values={form.kislap_programs}
                onChange={(values) => setList('kislap_programs', values)}
                placeholder="Select a program to add"
              />
              <MultiSelectField
                label="Preferred contribution areas"
                hint="Select up to three"
                options={CONTRIBUTION_AREAS}
                values={form.contribution_areas}
                onChange={(values) => setList('contribution_areas', values)}
                max={3}
                placeholder="Select a contribution area to add"
              />
              <label className="field">
                <span>What would encourage you to become an active youth volunteer?</span>
                <textarea
                  className="input"
                  rows={3}
                  value={form.volunteer_encouragement}
                  onChange={setField('volunteer_encouragement')}
                  placeholder="e.g. training, mentorship, flexible schedules, recognition"
                />
              </label>
            </>
          )}

          {step.id === 'membership' && (
            <>
              <SelectField
                label="Before this survey, were you familiar with KISLAP Youth Volunteers?"
                options={KISLAP_FAMILIARITY}
                value={form.kislap_familiarity}
                onChange={(value) => setValue('kislap_familiarity', value)}
                placeholder="Select familiarity"
              />
              <SelectField
                label="After learning about KISLAP, are you interested in becoming part of the organization?"
                options={MEMBERSHIP_INTEREST}
                value={form.membership_interest}
                onChange={(value) => setValue('membership_interest', value)}
                placeholder="Select membership interest"
              />
              <SelectField
                label="Would you like KISLAP to contact you about activities, volunteer opportunities, and orientations?"
                options={YES_NO}
                value={form.contact_opt_in}
                onChange={(value) => setValue('contact_opt_in', value)}
                placeholder="Select yes or no"
              />
              {form.contact_opt_in === 'yes' && (
                <div className="field-row">
                  <label className="field">
                    <span>Preferred contact method</span>
                    <input
                      className="input"
                      value={form.preferred_contact_method}
                      onChange={setField('preferred_contact_method')}
                      placeholder="SMS, call, Facebook, email"
                    />
                  </label>
                  <label className="field">
                    <span>Contact details</span>
                    <input
                      className="input"
                      value={form.preferred_contact_details}
                      onChange={setField('preferred_contact_details')}
                      placeholder="Phone number, Facebook name, or email"
                    />
                  </label>
                </div>
              )}
            </>
          )}

          {step.id === 'suggestions' && (
            <>
              <label className="field">
                <span>Suggestions to improve youth programs in Mauban</span>
                <textarea
                  className="input"
                  rows={3}
                  value={form.suggestions}
                  onChange={setField('suggestions')}
                  placeholder="Share ideas that could help improve youth programs and services"
                />
              </label>
              <label className="field">
                <span>Anything else about your interests, abilities, or aspirations?</span>
                <textarea
                  className="input"
                  rows={3}
                  value={form.additional_notes}
                  onChange={setField('additional_notes')}
                  placeholder="Optional notes about your goals, strengths, or other information"
                />
              </label>
              <SelectField
                label="Optional: KISLAP communications agreement"
                hint="Agreeing does not make you a member. You may withdraw later."
                options={[
                  ['yes', 'Yes, I agree to receive KISLAP communications.'],
                  ['no', 'No, I do not wish to receive KISLAP communications.'],
                ]}
                value={form.communications_agreement}
                onChange={(value) => setValue('communications_agreement', value)}
                placeholder="Select your preference"
              />
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
                  <dd>
                    {formatYouthAddress({
                      street: form.current_street,
                      barangay: form.current_barangay,
                      city: form.current_city,
                      province: form.current_province,
                    }) || '-'}
                  </dd>
                </div>
                <div>
                  <dt>Permanent address</dt>
                  <dd>
                    {formatYouthAddress(
                      form.same_as_current_address
                        ? {
                            street: form.current_street,
                            barangay: form.current_barangay,
                            city: form.current_city,
                            province: form.current_province,
                          }
                        : {
                            street: form.permanent_street,
                            barangay: form.permanent_barangay,
                            city: form.permanent_city,
                            province: form.permanent_province,
                          },
                    ) || '-'}
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
