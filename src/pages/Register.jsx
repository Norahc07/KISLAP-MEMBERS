import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Pencil, Plus, Printer } from 'lucide-react'
import DateField from '../components/DateField'
import RegistrationPrint from '../components/RegistrationPrint'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import { memberCode } from '../lib/tracker'
import { errorMessage } from '../lib/constants'
import { loadBarangays, loadCities, loadProvinces } from '../lib/locations'
import { signatureFromFile } from '../lib/signature'
import {
  AVAILABILITY,
  COMMITTEES,
  DISCLOSURE,
  EDUCATION_LEVELS,
  RELIGIONS,
  STRANDS,
  WORK_STATUSES,
  educationVisibility,
  ageFromDate,
  emptyRegistration,
  fromRow,
  isSignatureImage,
  parseMemberNo,
  toPayload,
  validateStep,
} from '../lib/registration'

const APPLICANT_STEPS = [
  { id: 'personal', title: 'Personal information', section: 'Section A' },
  { id: 'additional', title: 'Additional information', section: 'Section B' },
  { id: 'education', title: 'Education', section: 'Section C' },
  { id: 'emergency', title: 'Emergency contact', section: 'Section D' },
  { id: 'interests', title: 'Volunteer interests', section: 'Section E' },
  { id: 'agreement', title: 'Requirements and agreement', section: 'Sections F–H' },
]

const REVIEW_STEP = { id: 'review', title: 'Review and submit', section: 'Final step' }
const STEPS = [...APPLICANT_STEPS, REVIEW_STEP]

export default function Register() {
  const { isAdmin, profile, ready } = useAuth()
  const [params] = useSearchParams()
  const requestedMember = params.get('member') || ''
  const steps = STEPS
  const [stepIndex, setStepIndex] = useState(0)
  const [form, setForm] = useState(emptyRegistration)
  const [lookup, setLookup] = useState(null)
  const [missing, setMissing] = useState([])
  const [looking, setLooking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [done, setDone] = useState(null)
  const [roster, setRoster] = useState([])
  const [gate, setGate] = useState('checking')
  const [editing, setEditing] = useState(false)
  const [savedStatus, setSavedStatus] = useState('')

  const step = steps[Math.min(stepIndex, steps.length - 1)]
  const setField = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  function toggleList(key, value) {
    setForm((current) => {
      const list = current[key]
      return { ...current, [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value] }
    })
  }

  async function findMember(raw = form.memberNo) {
    const memberNo = parseMemberNo(raw)
    if (!memberNo) {
      const next = { status: 'invalid' }
      setLookup(next)
      return next
    }
    setLooking(true)
    const { data, error } = await supabase
      .from('membership_tracker')
      .select('member_no, full_name, registration_form')
      .eq('member_no', memberNo)
      .maybeSingle()
    setLooking(false)
    if (error) {
      const next = { status: 'error', message: error.code === 'PGRST205' ? 'missing-table' : error.message }
      setLookup(next)
      return next
    }
    if (!data) {
      const next = { status: 'missing' }
      setLookup(next)
      return next
    }
    const next = { status: 'found', row: data }
    setLookup(next)
    setForm((current) => ({ ...current, memberNo: String(memberNo) }))
    const existing = await supabase.from('registrations').select('*').eq('member_no', memberNo).maybeSingle()
    if (existing.data) {
      setForm(fromRow(existing.data))
      setSavedStatus(existing.data.application_status || 'pending')
      if (!isAdmin) setGate(existing.data.application_status === 'approved' ? 'verified' : 'pending')
    } else {
      setForm({ ...emptyRegistration(), memberNo: String(memberNo) })
      setSavedStatus('')
      if (!isAdmin) setGate('open')
    }
    return next
  }

  useEffect(() => {
    if (!isAdmin) return undefined
    let ignore = false
    supabase
      .from('membership_tracker')
      .select('member_no, full_name')
      .order('member_no')
      .then(({ data }) => {
        if (!ignore) {
          setRoster((data || []).filter((row) => row.full_name.trim() || row.member_no === 23))
        }
      })
    return () => {
      ignore = true
    }
  }, [isAdmin])

  useEffect(() => {
    if (!ready) return undefined
    if (isAdmin) {
      setGate('open')
      const member = requestedMember
      if (member) findMember(member).catch(() => {})
      return undefined
    }
    if (!profile?.member_no) {
      setGate('open')
      return undefined
    }
    findMember(String(profile.member_no)).catch(() => setGate('open'))
    return undefined
  }, [isAdmin, ready, profile?.member_no, requestedMember])

  async function handleNext() {
    const currentLookup = step.id === 'id' ? await findMember() : lookup
    const problems = validateStep(step.id, form, currentLookup)
    setMissing(problems)
    if (!problems.length) setStepIndex((index) => Math.min(index + 1, steps.length - 1))
  }

  async function handleSubmit() {
    if (!parseMemberNo(form.memberNo)) {
      setSubmitError(isAdmin ? 'Select the member this registration belongs to.' : 'Your membership ID is not linked to this account yet.')
      return
    }
    const problems = APPLICANT_STEPS.flatMap((item) => validateStep(item.id, form, lookup))
    setMissing(problems)
    if (problems.length) {
      setSubmitError('Some required answers are still missing. Go back and complete the highlighted step.')
      return
    }
    setSaving(true)
    setSubmitError('')
    const { error } = await supabase.rpc('submit_registration', { payload: toPayload(form) })
    setSaving(false)
    if (!error) {
      supabase.rpc('log_audit', {
        p_action: 'registration_submitted',
        p_summary: `Submitted the registration for ${memberCode(parseMemberNo(form.memberNo))}`,
        p_detail: { member_no: parseMemberNo(form.memberNo) },
      }).then(() => {}, () => {})
    }
    if (error) {
      setSubmitError(
        error.code === 'PGRST202'
          ? 'The registration form is not set up in Supabase yet. An officer needs to run supabase/registration-form.sql.'
          : errorMessage(error),
      )
      return
    }
    setDone(parseMemberNo(form.memberNo))
  }

  function setBirthDate(iso) {
    setForm((current) => ({ ...current, dateOfBirth: iso, age: ageFromDate(iso) }))
  }

  if (done) {
    return (
      <RegisterShell form={form} lookup={lookup}>
        <section className="register-official register-saved">
          <header className="register-official-bar">
            <div>
              <p className="eyebrow">
                <CheckCircle2 size={18} /> {savedStatus ? 'Saved' : 'Submitted'}
              </p>
              <h1>{savedStatus ? 'Registration updated' : 'Registration received'}</h1>
              <p>
                {savedStatus ? (
                  savedStatus === 'approved' ? (
                    <>
                      <strong>{memberCode(done)}</strong> is updated. The approved form now shows these details.
                    </>
                  ) : (
                    <>
                      <strong>{memberCode(done)}</strong> is updated. An officer can still verify the registration.
                    </>
                  )
                ) : (
                  <>
                    <strong>{memberCode(done)}</strong> is saved. You can open this form again from My account to correct any details.
                  </>
                )}
              </p>
            </div>
            <div className="register-nav">
              <button type="button" className="btn btn-soft" onClick={() => window.print()}>
                <Printer size={16} /> Print
              </button>
              <Link to="/account" className="btn btn-primary">
                Back to my account
              </Link>
              {isAdmin && (
                <Link to="/tracker" className="btn btn-soft">
                  Open tracker
                </Link>
              )}
            </div>
          </header>
          <RegistrationPrint form={form} lookup={lookup} preview />
        </section>
      </RegisterShell>
    )
  }

  if (gate === 'checking') {
    return (
      <RegisterShell>
        <section className="register-card">
          <h1>Registration</h1>
          <p className="muted">Loading your registration…</p>
        </section>
      </RegisterShell>
    )
  }

  if (!isAdmin && !editing && (gate === 'pending' || gate === 'verified')) {
    const approved = gate === 'verified'
    return (
      <RegisterShell form={form} lookup={lookup}>
        <section className="register-official">
          <header className="register-official-bar">
            <div>
              <p className="eyebrow">{approved ? 'Approved' : 'Submitted'}</p>
              <h1>Your registration form</h1>
              <p>
                {approved
                  ? 'This registration is approved. Review the form below and update any missing or incorrect details.'
                  : 'This registration is submitted. Review the form below and update any missing or incorrect details.'}
              </p>
            </div>
            <div className="register-nav">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setEditing(true)
                  setStepIndex(0)
                  setMissing([])
                  setSubmitError('')
                }}
              >
                <Pencil size={16} /> Edit details
              </button>
              <button type="button" className="btn btn-soft" onClick={() => window.print()}>
                <Printer size={16} /> Print
              </button>
              <Link to="/account" className="btn btn-ghost">
                Back to my account
              </Link>
            </div>
          </header>
          <RegistrationPrint form={form} lookup={lookup} preview />
        </section>
      </RegisterShell>
    )
  }

  return (
    <RegisterShell form={form} lookup={lookup}>
      <div className="register-layout">
        <ol className="register-steps">
          {steps.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                className={index === stepIndex ? 'active' : index < stepIndex ? 'done' : ''}
                onClick={() => {
                  if (isAdmin || savedStatus || index <= stepIndex) {
                    setMissing([])
                    setStepIndex(index)
                  }
                }}
                disabled={!isAdmin && !savedStatus && index > stepIndex}
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
          <p className="eyebrow">
            Step {stepIndex + 1} of {steps.length} · {step.section}
          </p>
          <h1>{step.title}</h1>
          {isAdmin ? (
            <label className="field">
              <span>Registration for</span>
              <select
                className="input"
                value={form.memberNo}
                onChange={(event) => findMember(event.target.value)}
              >
                <option value="">Select a member</option>
                {roster.map((row) => (
                  <option key={row.member_no} value={row.member_no}>
                    {memberCode(row.member_no)} · {row.full_name.trim() || 'No name yet'}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="muted">
              Membership ID <strong>{profile?.member_no ? memberCode(profile.member_no) : '—'}</strong>
              {lookup?.row?.full_name ? ` · ${lookup.row.full_name}` : ''}
              {savedStatus ? ' · update any detail, then save.' : ''}
            </p>
          )}

          {step.id === 'personal' && <PersonalStep form={form} setForm={setForm} setField={setField} setBirthDate={setBirthDate} />}
          {step.id === 'additional' && <AdditionalStep form={form} setField={setField} setForm={setForm} />}
          {step.id === 'education' && <EducationStep form={form} setField={setField} setForm={setForm} />}
          {step.id === 'emergency' && <EmergencyStep form={form} setField={setField} />}
          {step.id === 'interests' && <InterestsStep form={form} setField={setField} toggleList={toggleList} />}
          {step.id === 'agreement' && <AgreementStep form={form} setField={setField} setForm={setForm} />}
          {step.id === 'review' && <ReviewStep form={form} lookup={lookup} />}

          {!!missing.length && (
            <div className="alert">
              Please complete: {missing.join(', ')}.
            </div>
          )}
          {submitError && <div className="alert">{submitError}</div>}

          <div className="register-nav">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setMissing([])
                setStepIndex((index) => index - 1)
              }}
              disabled={stepIndex === 0 || saving}
            >
              <ArrowLeft size={16} /> Back
            </button>
            {step.id === 'review' ? (
              <div className="register-actions">
                <button type="button" className="btn btn-soft" onClick={() => window.print()}>
                  <Printer size={16} /> Print
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : savedStatus ? 'Save updates' : 'Submit registration'}
                </button>
              </div>
            ) : (
              <div className="register-actions">
                {isAdmin && (
                  <button
                    type="button"
                    className="btn btn-soft"
                    onClick={() => {
                      setMissing([])
                      setStepIndex((index) => Math.min(index + 1, steps.length - 1))
                    }}
                  >
                    Skip
                  </button>
                )}
                <button type="submit" className="btn btn-primary" disabled={looking}>
                  Next <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </RegisterShell>
  )
}

function RegisterShell({ children, form, lookup }) {
  return (
    <div className="register-shell">
      <div className="screen-only">
        <main className="register-main register-main-inset">{children}</main>
      </div>
      {form && <RegistrationPrint form={form} lookup={lookup} />}
    </div>
  )
}

function PersonalStep({ form, setForm, setField, setBirthDate }) {
  const locations = useLocations(form.province, form.city)

  function setProvince(event) {
    const province = event.target.value
    setForm((current) => ({ ...current, province, city: '', barangay: '' }))
  }

  function setCity(event) {
    const city = event.target.value
    setForm((current) => ({ ...current, city, barangay: '' }))
  }

  function setCivilStatus(value) {
    setForm((current) => ({ ...current, civilStatus: current.civilStatus === value ? '' : value }))
  }

  return (
    <div className="form">
      <p className="muted">Please provide accurate and complete information.</p>
      <div className="field-row">
        <TextField label="Surname / Apelyido" value={form.surname} onChange={setField('surname')} required autoComplete="family-name" placeholder="Dela Cruz" />
        <TextField label="First name / Pangalan" value={form.firstName} onChange={setField('firstName')} required autoComplete="given-name" placeholder="Juan" />
      </div>
      <div className="field-row">
        <TextField label="Middle name" value={form.middleName} onChange={setField('middleName')} autoComplete="additional-name" placeholder="Santos" />
        <TextField label="Suffix (if applicable)" value={form.suffix} onChange={setField('suffix')} placeholder="Jr., III" />
      </div>
      <section className="form-block">
        <h2>Parents</h2>
        <p className="muted">Father and mother are part of this membership registration. They stay separate from the emergency guardian.</p>
        <div className="field-row">
          <TextField label="Father's name" value={form.fatherName} onChange={setField('fatherName')} required placeholder="Pedro Dela Cruz" />
          <TextField label="Mother's name" value={form.motherName} onChange={setField('motherName')} required placeholder="Maria Dela Cruz" />
        </div>
      </section>
      <SelectField
        label="Sex"
        required
        value={form.sex}
        onChange={setField('sex')}
        placeholder="Select sex"
        options={[
          ['male', 'Male'],
          ['female', 'Female'],
        ]}
      />
      <div className="field-row">
        <DateField label="Date of birth" hint="DD / MM / YYYY" value={form.dateOfBirth} onChange={setBirthDate} />
        <TextField
          label="Age"
          value={form.age}
          readOnly
          tabIndex={-1}
          placeholder="Filled from date of birth"
          hint="Filled automatically when you enter your date of birth."
        />
      </div>
      <CheckGroup
        label="Civil status"
        value={form.civilStatus}
        onChange={setCivilStatus}
        options={[
          ['single', 'Single'],
          ['married', 'Married'],
          ['other', 'Other'],
        ]}
      />
      <TextField label="Permanent address" hint="House no., street, sitio, or purok" value={form.address} onChange={setField('address')} required placeholder="123 Rizal Street, Purok 1" />
      <div className="field-row">
        <SelectField
          label="Province"
          required
          value={form.province}
          onChange={setProvince}
          placeholder="Select province"
          loading={locations.loadingProvinces}
          options={locations.provinces.map((item) => [item.name, item.name])}
        />
        <SelectField
          label="City / municipality"
          required
          value={form.city}
          onChange={setCity}
          placeholder={form.province ? 'Select city or municipality' : 'Select a province first'}
          loading={locations.loadingCities}
          disabled={!form.province || locations.loadingCities}
          options={locations.cities.map((item) => [item.name, item.name])}
        />
        <SelectField
          label="Barangay"
          required
          value={form.barangay}
          onChange={setField('barangay')}
          placeholder={form.city ? 'Select barangay' : 'Select a city first'}
          loading={locations.loadingBarangays}
          disabled={!form.city || locations.loadingBarangays}
          options={locations.barangays.map((item) => [item.name, item.name])}
        />
      </div>
      {locations.error && <div className="alert">{locations.error}</div>}
      <div className="field-row">
        <TextField label="Personal contact number" value={form.contactNumber} onChange={setField('contactNumber')} required inputMode="tel" autoComplete="tel" placeholder="09XX XXX XXXX" />
        <TextField label="Email address" type="email" value={form.email} onChange={setField('email')} required autoComplete="email" placeholder="name@email.com" />
      </div>
      <TextField label="Facebook name (optional)" value={form.facebookName} onChange={setField('facebookName')} placeholder="Your Facebook name" />
    </div>
  )
}

function useLocations(provinceName, cityName) {
  const [provinces, setProvinces] = useState([])
  const [cities, setCities] = useState([])
  const [barangays, setBarangays] = useState([])
  const [citySource, setCitySource] = useState('')
  const [barangaySource, setBarangaySource] = useState('')
  const [loadingProvinces, setLoadingProvinces] = useState(true)
  const [error, setError] = useState('')
  const province = provinces.find((item) => item.name === provinceName)
  const citiesForProvince = useMemo(() => (citySource === provinceName ? cities : []), [cities, citySource, provinceName])
  const barangaysForCity = useMemo(() => (barangaySource === cityName ? barangays : []), [barangays, barangaySource, cityName])

  useEffect(() => {
    let ignore = false
    loadProvinces()
      .then((rows) => {
        if (!ignore) setProvinces(rows)
      })
      .catch(() => {
        if (!ignore) setError('The province list could not be loaded. Check your connection and open this step again.')
      })
      .finally(() => {
        if (!ignore) setLoadingProvinces(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    if (!province) {
      setCities([])
      setCitySource('')
      return undefined
    }
    let ignore = false
    setCitySource('')
    setError('')
    loadCities(province)
      .then((rows) => {
        if (!ignore) {
          setCities(rows)
          setCitySource(province.name)
        }
      })
      .catch(() => {
        if (!ignore) setError('The city and municipality list could not be loaded. Check your connection and choose the province again.')
      })
    return () => {
      ignore = true
    }
  }, [provinceName, provinces])

  useEffect(() => {
    const city = citiesForProvince.find((item) => item.name === cityName)
    if (!city) return undefined
    let ignore = false
    setBarangaySource('')
    setError('')
    loadBarangays(city.code)
      .then((rows) => {
        if (!ignore) {
          setBarangays(rows)
          setBarangaySource(city.name)
        }
      })
      .catch(() => {
        if (!ignore) setError('The barangay list could not be loaded. Check your connection and choose the city again.')
      })
    return () => {
      ignore = true
    }
  }, [cityName, citiesForProvince])

  return {
    provinces,
    cities: citiesForProvince,
    barangays: barangaysForCity,
    loadingProvinces,
    loadingCities: Boolean(province) && citySource !== provinceName,
    loadingBarangays: Boolean(cityName) && barangaySource !== cityName,
    error,
  }
}

function AdditionalStep({ form, setField, setForm }) {
  return (
    <div className="form">
      <p className="muted">These questions are optional. Share only what you are comfortable sharing.</p>
      <Choice label="Person with disability (PWD)" hint="Optional. Disclose only if comfortable." value={form.pwd} onChange={setField('pwd')} options={DISCLOSURE} />
      <Choice label="Registered voter" hint="For voluntary demographic information." value={form.registeredVoter} onChange={setField('registeredVoter')} options={DISCLOSURE} />
      <SelectField
        label="Religion"
        value={form.religion}
        onChange={setField('religion')}
        placeholder="Select religion"
        options={RELIGIONS}
      />
      {form.religion === 'Other' && (
        <TextField label="Specify religion" value={form.religionOther} onChange={setField('religionOther')} required placeholder="Enter your religion" />
      )}
      <label className="field">
        <span>Skills, talents, and areas of expertise</span>
        <textarea
          className="input textarea"
          rows={4}
          value={form.skills}
          onChange={setField('skills')}
          placeholder="Examples: graphic design, documentation, public speaking, event management, first aid, sports, teaching, photography, or technical skills."
        />
      </label>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm((current) => ({ ...current, pwd: '', registeredVoter: '', religion: '', religionOther: '', skills: '' }))}>
        Clear this section
      </button>
    </div>
  )
}

function EducationStep({ form, setField, setForm }) {
  const fields = educationVisibility(form.educationLevel, form.schoolWorkStatus)

  function setLevel(educationLevel) {
    setForm((current) => ({
      ...current,
      educationLevel,
      gradeLevel: educationVisibility(educationLevel, current.schoolWorkStatus).grade ? current.gradeLevel : '',
    }))
  }

  function setStatus(event) {
    const schoolWorkStatus = event.target.value
    setForm((current) => ({
      ...current,
      schoolWorkStatus,
      gradeLevel: educationVisibility(current.educationLevel, schoolWorkStatus).grade ? current.gradeLevel : '',
    }))
  }

  return (
    <div className="form">
      <div className="field">
        <span>Highest educational attainment *</span>
        <p className="muted small">Add the highest level reached. A college student fills elementary, secondary, and college. A college graduate keeps those schools, plus strand and course.</p>
        <AddPicker options={EDUCATION_LEVELS} value={form.educationLevel} onChange={setLevel} />
      </div>
      <Choice label="School / work status" value={form.schoolWorkStatus} onChange={setStatus} options={WORK_STATUSES} />
      {fields.elementary && (
        <TextField label="Elementary / primary school" value={form.elementarySchool} onChange={setField('elementarySchool')} required placeholder="Mauban South Elementary School" />
      )}
      {fields.highSchool && (
        <TextField label="Secondary school" value={form.highSchool} onChange={setField('highSchool')} required placeholder="Mauban National High School" />
      )}
      {fields.strand && (
        <>
          <SelectField label="Strand (Senior High School)" required={fields.strandRequired} value={form.strand} onChange={setField('strand')} placeholder="Select strand" options={STRANDS} />
          {form.strand === 'Other' && (
            <TextField label="Specify strand" value={form.strandOther} onChange={setField('strandOther')} required={fields.strandRequired} placeholder="Enter the strand" />
          )}
        </>
      )}
      {fields.college && (
        <>
          <TextField label="College school" value={form.collegeSchool} onChange={setField('collegeSchool')} required placeholder="Southern Luzon State University" />
          <TextField label="College course / major" value={form.course} onChange={setField('course')} required placeholder="BS Information Technology" />
        </>
      )}
      {fields.vocational && (
        <TextField label="Vocational / technical school" value={form.schoolName} onChange={setField('schoolName')} required placeholder="Technical school name" />
      )}
      {fields.other && (
        <TextField label="School name" value={form.schoolName} onChange={setField('schoolName')} required placeholder="School name" />
      )}
      {fields.grade && (
        <TextField label="Current grade level or year" hint="Shown while this member is still studying" value={form.gradeLevel} onChange={setField('gradeLevel')} required placeholder="Grade 12 or 2nd year" />
      )}
    </div>
  )
}

function EmergencyStep({ form, setField }) {
  const minor = Number(form.age) > 0 && Number(form.age) < 18
  return (
    <div className="form">
      <p className="muted">
        Name someone who can be reached in an emergency. This guardian is separate from the father and mother already entered.
        {minor ? ' Because you are under 18, choose an adult who can be contacted.' : ''}
      </p>
      <TextField label="Emergency guardian name" value={form.guardianName} onChange={setField('guardianName')} required placeholder="Ana Reyes" />
      <div className="field-row">
        <TextField label="Contact number" value={form.guardianContact} onChange={setField('guardianContact')} required inputMode="tel" placeholder="09XX XXX XXXX" />
        <TextField label="Relationship to applicant" value={form.guardianRelationship} onChange={setField('guardianRelationship')} required placeholder="Aunt, uncle, or guardian" />
      </div>
      <div className="field-row">
        <TextField label="Alternative emergency contact (optional)" value={form.altContactName} onChange={setField('altContactName')} placeholder="Pedro Dela Cruz" />
        <TextField label="Alternative contact number" value={form.altContactNumber} onChange={setField('altContactNumber')} inputMode="tel" placeholder="09XX XXX XXXX" />
      </div>
    </div>
  )
}

function InterestsStep({ form, setField, toggleList }) {
  return (
    <div className="form">
      <div className="field">
        <span>Volunteer areas *</span>
        <p className="muted small">Add every area you want to join. {form.interests.length ? `${form.interests.length} added.` : 'None added yet.'}</p>
        {!!form.interests.length && (
          <div className="pick-chips">
            {form.interests.map((name) => (
              <button key={name} type="button" className="pick-chip" onClick={() => toggleList('interests', name)}>
                {name}
                <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}
        <AddPicker options={COMMITTEES.map((name) => [name, name])} value={form.interests} multiple onChange={(name) => toggleList('interests', name)} />
      </div>
      <label className="field">
        <span>Preferred committee / area of service</span>
        <select className="input" value={form.preferredCommittee} onChange={setField('preferredCommittee')}>
          <option value="">No preference yet</option>
          {COMMITTEES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Other volunteer interests or proposed contributions</span>
        <textarea className="input textarea" rows={3} value={form.otherInterests} onChange={setField('otherInterests')} placeholder="Other ways you would like to help" />
      </label>
      <div className="field">
        <span>Availability *</span>
        <p className="muted small">Add the times you can join activities.</p>
        <AddPicker options={AVAILABILITY} value={form.availability} multiple onChange={(value) => toggleList('availability', value)} compact />
      </div>
    </div>
  )
}

function AddPicker({ options, value, onChange, multiple = false, compact = false }) {
  const selected = multiple ? value : [value]
  return (
    <div className={`add-grid ${compact ? 'add-grid-compact' : ''}`}>
      {options.map(([key, label]) => {
        const on = selected.includes(key)
        return (
          <button key={key} type="button" className={`add-card ${on ? 'active' : ''}`} onClick={() => onChange(key)} aria-pressed={on}>
            <span className="add-icon">{on ? <Check size={15} /> : <Plus size={15} />}</span>
            <strong>{label}</strong>
          </button>
        )
      })}
    </div>
  )
}

function AgreementStep({ form, setField, setForm }) {
  const minor = Number(form.age) > 0 && Number(form.age) < 18
  return (
    <div className="form">
      <section className="form-block">
        <h2>Formal picture</h2>
        <p className="muted">
          One recent passport-size photograph: clear, front-facing, formal attire, and a plain background. Mark whether you have submitted it to KISLAP.
        </p>
        <Choice label="Picture status" value={form.photoStatus} onChange={setField('photoStatus')} options={[['submitted', 'Submitted'], ['pending', 'Pending']]} />
      </section>

      <section className="form-block">
        <h2>Applicant declaration</h2>
        <p className="notice">
          I certify that the information I have provided is true and correct to the best of my knowledge. I understand that membership in KISLAP Youth Volunteers involves respect for fellow members, responsible conduct, active participation, and compliance with the organization's policies and activities.
        </p>
        <label className="check">
          <input type="checkbox" checked={form.certified} onChange={(event) => setForm((current) => ({ ...current, certified: event.target.checked }))} />
          <span>I agree to this declaration.</span>
        </label>
        <TextField label="Applicant's printed name" value={form.applicantPrintedName} onChange={setField('applicantPrintedName')} required placeholder="Juan Dela Cruz" />
        <SignatureField label="Applicant e-signature" required value={form.applicantSignature} onChange={(signature) => setForm((current) => ({ ...current, applicantSignature: signature }))} />
        <DateField label="Date signed" value={form.dateSigned} onChange={(iso) => setForm((current) => ({ ...current, dateSigned: iso }))} />
        <p className="muted small">Applicants under 18 also need the emergency guardian's e-signature.</p>
        <SignatureField label="Guardian e-signature" required={minor} value={form.guardianSignature} onChange={(signature) => setForm((current) => ({ ...current, guardianSignature: signature }))} />
        <DateField label="Guardian date" value={form.guardianSignedDate} onChange={(iso) => setForm((current) => ({ ...current, guardianSignedDate: iso }))} />
      </section>

      <section className="form-block">
        <h2>Data privacy notice</h2>
        <p className="notice">
          KISLAP Youth Volunteers in Mauban, Quezon collects this information to process membership, contact you about activities, and reach your emergency contact. Only authorized officers can access it. Records are kept while you are a member and for up to one year after you leave, unless a longer period is required. You may ask the organization to review or correct your information. Using your photo in public posts is optional and is not a condition of membership.
        </p>
        <label className="check">
          <input type="checkbox" checked={form.privacyConsent} onChange={(event) => setForm((current) => ({ ...current, privacyConsent: event.target.checked }))} />
          <span>I have read the notice and consent to the stated processing of my membership information.</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={form.announcementsConsent} onChange={(event) => setForm((current) => ({ ...current, announcementsConsent: event.target.checked }))} />
          <span>I agree to receive organization-related announcements through the contact details I provided.</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={form.photoPublicConsent} onChange={(event) => setForm((current) => ({ ...current, photoPublicConsent: event.target.checked }))} />
          <span>Optional: I separately consent to the use of my photograph in public organizational posts or promotional materials.</span>
        </label>
        <p className="muted small">The applicant e-signature above also covers this privacy consent.</p>
      </section>
    </div>
  )
}

function ReviewStep({ form, lookup }) {
  return (
    <div className="review-list">
      <p className="muted">
        Check the finished form. After you submit, Registration Form is checked for this membership ID on the tracker.
      </p>
      <RegistrationPrint form={form} lookup={lookup} preview />
    </div>
  )
}

function SelectField({ label, required, value, onChange, placeholder, options, disabled, loading }) {
  const known = options.some(([option]) => option === value)
  return (
    <label className="field">
      <span>
        {label}
        {required ? ' *' : ''}
      </span>
      <select className="input" value={value} onChange={onChange} disabled={disabled || loading} required={required}>
        <option value="">{loading ? 'Loading…' : placeholder}</option>
        {value && !known && <option value={value}>{value}</option>}
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
    </label>
  )
}

function CheckGroup({ label, options, value, onChange }) {
  return (
    <fieldset className="choice-set">
      <legend>{label} *</legend>
      <div className="check-row">
        {options.map(([option, text]) => (
          <label key={option} className="check">
            <input type="checkbox" checked={value === option} onChange={() => onChange(option)} />
            <span>{text}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function TextField({ label, hint, required, ...props }) {
  return (
    <label className="field">
      <span>
        {label}
        {required ? ' *' : ''}
      </span>
      <input className="input" {...props} />
      {hint && <small className="muted">{hint}</small>}
    </label>
  )
}

function Choice({ label, hint, options, value, onChange }) {
  return (
    <fieldset className="choice-set">
      <legend>
        {label}
        {hint && <small>{hint}</small>}
      </legend>
      <div className="choice-grid">
        {options.map(([option, text]) => (
          <label key={option} className={`choice ${value === option ? 'active' : ''}`}>
            <input type="radio" name={label} value={option} checked={value === option} onChange={onChange} />
            {text}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function SignatureField({ label, required, value, onChange }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setError('')
    try {
      onChange(await signatureFromFile(file))
    } catch (err) {
      setError(err.message || 'The signature could not be prepared.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="field">
      <span>
        {label}
        {required ? ' *' : ''}
      </span>
      <p className="muted small">Upload a signature on white or light paper. The background is removed automatically.</p>
      <label className="sign-pad">
        {isSignatureImage(value) ? <img src={value} alt="" /> : <span>{busy ? 'Preparing signature…' : 'Choose signature image'}</span>}
        {!isSignatureImage(value) && value ? <small>A typed signature is already saved. Upload an image to replace it.</small> : null}
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} disabled={busy} />
      </label>
      {isSignatureImage(value) && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange('')}>Remove signature</button>
      )}
      {error && <div className="alert">{error}</div>}
    </div>
  )
}

