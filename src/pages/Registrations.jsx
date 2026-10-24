import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, ClipboardList, Crop, Download, Minus, Pencil, Plus, Printer, RotateCcw, RotateCw, Search } from 'lucide-react'
import Avatar from '../components/Avatar'
import DateField from '../components/DateField'
import RegistrationPrint from '../components/RegistrationPrint'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { fetchTracker } from '../lib/api'
import { errorMessage } from '../lib/constants'
import {
  AVAILABILITY,
  COMMITTEES,
  DISCLOSURE,
  EDUCATION_LEVELS,
  RELIGIONS,
  STRANDS,
  WORK_STATUSES,
  ageFromDate,
  educationVisibility,
  fromRow,
  isSignatureImage,
  toPayload,
} from '../lib/registration'
import { cleanSignatureSource, cropSignature, rotateSignature, signatureFromFile } from '../lib/signature'
import { TRACKER_ROLES, listedOnTracker, memberCode } from '../lib/tracker'
import { supabase } from '../supabaseClient'

const MIN_SIGN = 0.7
const MAX_SIGN = 2.4
const SIGN_STEP = 0.2

function storedSignScale(memberNo) {
  try {
    const value = Number(sessionStorage.getItem(`kislap-sign-scale:${memberNo}`))
    if (value >= MIN_SIGN && value <= MAX_SIGN) return value
  } catch {
    /* keep the default size when storage is blocked */
  }
  return 1
}

function rememberSignScale(memberNo, scale) {
  try {
    sessionStorage.setItem(`kislap-sign-scale:${memberNo}`, String(scale))
  } catch {
    /* the size still applies to this preview */
  }
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'approved', label: 'Approved' },
  { key: 'submitted', label: 'On hold' },
  { key: 'missing', label: 'Not yet' },
]

export default function Registrations() {
  const { rolesByMember } = useData()
  const toast = useToast()
  const [roster, setRoster] = useState([])
  const [members, setMembers] = useState([])
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [previewing, setPreviewing] = useState(null)
  const [previewForm, setPreviewForm] = useState(null)
  const [picked, setPicked] = useState(() => new Set())
  const [job, setJob] = useState(null)

  const load = useCallback(async () => {
    try {
      const [tracker, registrations] = await Promise.all([
        fetchTracker(),
        supabase.from('registrations').select('*'),
      ])
      if (registrations.error) throw registrations.error
      setRoster(tracker.rows)
      setMembers(tracker.members)
      setForms(registrations.data || [])
      setError('')
    } catch (err) {
      setError(err?.code === 'PGRST205' ? 'missing' : errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const membersById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members])
  const formsByNo = useMemo(() => new Map(forms.map((row) => [row.member_no, row])), [forms])

  const people = useMemo(() => {
    return roster
      .filter((row) => listedOnTracker(row) && (row.full_name.trim() || formsByNo.has(row.member_no)))
      .map((row) => {
        const registration = formsByNo.get(row.member_no) || null
        const person = row.member_id ? membersById.get(row.member_id) : null
        return {
          tracker: row,
          registration,
          photo: person?.photo_url || null,
          name: row.full_name.trim() || 'No name yet',
          position: positionOf(row, rolesByMember),
          status: statusOf(registration),
        }
      })
      .sort((a, b) => a.tracker.member_no - b.tracker.member_no)
  }, [formsByNo, membersById, roster, rolesByMember])

  const submittedCount = people.filter((person) => person.registration).length
  const missingCount = people.length - submittedCount
  const q = query.trim().toLowerCase()
  const visible = people.filter((person) => {
    if (filter === 'approved' && person.status.key !== 'approved') return false
    if (filter === 'submitted' && person.status.key !== 'submitted') return false
    if (filter === 'missing' && person.registration) return false
    if (!q) return true
    return (
      person.name.toLowerCase().includes(q)
      || memberCode(person.tracker.member_no).toLowerCase().includes(q)
      || person.position.toLowerCase().includes(q)
    )
  })

  const approved = people.filter((person) => person.status.key === 'approved')
  const visibleApproved = visible.filter((person) => person.status.key === 'approved')
  const allVisiblePicked = visibleApproved.length > 0 && visibleApproved.every((person) => picked.has(person.tracker.member_no))
  const peopleRef = useRef(people)
  peopleRef.current = people
  const printPeople = (job?.nos || [])
    .map((memberNo) => people.find((person) => person.tracker.member_no === memberNo))
    .filter((person) => person?.registration)

  useEffect(() => {
    if (!job) return undefined
    let cancel = false
    const timer = window.setTimeout(async () => {
      if (cancel) return
      const started = Date.now()
      while (!cancel && Date.now() - started < 2000) {
        if (!document.querySelector('.ereg-print-target [data-sign-ready="0"]')) break
        await new Promise((resolve) => window.setTimeout(resolve, 40))
      }
      if (cancel) return
      if (job.kind === 'download') {
        const selected = job.nos
          .map((memberNo) => peopleRef.current.find((person) => person.tracker.member_no === memberNo))
          .filter((person) => person?.registration)
        await savePrintedForms(selected)
        if (!cancel) setJob(null)
        return
      }
      window.print()
    }, 80)
    function done() {
      setJob(null)
    }
    if (job.kind === 'print') window.addEventListener('afterprint', done)
    return () => {
      cancel = true
      window.clearTimeout(timer)
      window.removeEventListener('afterprint', done)
    }
  }, [job])

  function togglePicked(memberNo) {
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(memberNo)) next.delete(memberNo)
      else next.add(memberNo)
      return next
    })
  }

  function toggleVisibleApproved() {
    setPicked((current) => {
      const next = new Set(current)
      if (allVisiblePicked) visibleApproved.forEach((person) => next.delete(person.tracker.member_no))
      else visibleApproved.forEach((person) => next.add(person.tracker.member_no))
      return next
    })
  }

  function startJob(memberNos, kind) {
    const ids = memberNos.filter((memberNo) => people.some((person) => person.tracker.member_no === memberNo && person.registration))
    if (!ids.length || job) return
    setJob({ nos: ids, kind })
  }

  const previewPerson = people.find((person) => person.tracker.member_no === previewing) || null
  const chosen = [...picked].filter((memberNo) => approved.some((person) => person.tracker.member_no === memberNo))

  if (previewPerson?.registration) {
    return (
      <>
        <div className="screen-only">
          <RegistrationReview
            person={previewPerson}
            onBack={() => setPreviewing(null)}
            onForm={setPreviewForm}
            onUpdated={() => {
              load()
              toast.success('Responses updated')
            }}
            onPrint={() => startJob([previewPerson.tracker.member_no], 'print')}
            onDownload={() => startJob([previewPerson.tracker.member_no], 'download')}
            onSaved={() => {
              setPreviewing(null)
              load()
              toast.success('Organization review saved')
            }}
          />
        </div>
        <PrintCopies people={printPeople} previewNo={previewing} previewForm={previewForm} />
      </>
    )
  }

  return (
    <>
    <div className="screen-only">
    <div className="page page-wide">
      <header className="page-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>eRegForms</h1>
          <p className="muted">Submitted membership forms, and who still needs to send one.</p>
        </div>
      </header>

      <section className="stats">
        <article className="stat stat-green">
          <span className="stat-icon"><ClipboardList size={20} /></span>
          <div>
            <strong>{submittedCount}</strong>
            <span>Submitted</span>
          </div>
        </article>
        <article className="stat stat-amber">
          <span className="stat-icon"><ClipboardList size={20} /></span>
          <div>
            <strong>{missingCount}</strong>
            <span>Not yet</span>
          </div>
        </article>
      </section>

      {error === 'missing' && <div className="alert">Run <code>supabase/registration-form.sql</code> in the Supabase SQL Editor, then refresh this page.</div>}
      {error && error !== 'missing' && <div className="alert">{error}</div>}

      <div className="toolbar">
        <div className="search">
          <Search size={17} />
          <input placeholder="Search name, member ID, or position" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="segmented">
          {FILTERS.map((item) => (
            <button key={item.key} type="button" className={filter === item.key ? 'active' : ''} onClick={() => setFilter(item.key)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {chosen.length > 0 && (
        <div className="ereg-bulk">
          <p>{chosen.length} selected</p>
          <div className="ereg-actions">
            <button type="button" className="btn btn-soft" disabled={!!job} onClick={() => startJob(chosen, 'print')}>
              <Printer size={16} /> Print ({chosen.length})
            </button>
            <button type="button" className="btn btn-primary" disabled={!!job} onClick={() => startJob(chosen, 'download')}>
              <Download size={16} /> Download ({chosen.length})
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="skeleton-card">
          <div className="skeleton line w80" />
          <div className="skeleton line w60" />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>
                  <input
                    className="ereg-pick"
                    type="checkbox"
                    checked={allVisiblePicked}
                    disabled={!visibleApproved.length}
                    onChange={toggleVisibleApproved}
                    aria-label="Select approved forms"
                  />
                </th>
                <th>Profile</th>
                <th>Name</th>
                <th>Position</th>
                <th>Member ID</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((person) => (
                <tr key={person.tracker.member_no}>
                  <td>
                    {person.status.key === 'approved' ? (
                      <input
                        className="ereg-pick"
                        type="checkbox"
                        checked={picked.has(person.tracker.member_no)}
                        onChange={() => togglePicked(person.tracker.member_no)}
                        aria-label={`Select ${person.name}`}
                      />
                    ) : null}
                  </td>
                  <td><Avatar src={person.photo} name={person.name} size={40} /></td>
                  <td><strong>{person.name}</strong></td>
                  <td>{person.position}</td>
                  <td className="member-code">{memberCode(person.tracker.member_no)}</td>
                  <td><span className={`badge badge-${person.status.key}`}>{person.status.label}</span></td>
                  <td>
                    {person.registration ? (
                      <button type="button" className="btn btn-soft btn-sm" onClick={() => setPreviewing(person.tracker.member_no)}>
                        Preview
                      </button>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td colSpan={7}>No members match this list.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </div>
    <PrintCopies people={printPeople} previewNo={previewing} previewForm={previewForm} />
    </>
  )
}

async function savePrintedForms(people) {
  const root = document.querySelector('.ereg-print-target')
  if (!root || !people.length) return
  const clone = root.cloneNode(true)
  await inlineImages(root, clone)
  const css = await collectCss()
  const filename = people.length === 1
    ? `${memberCode(people[0].tracker.member_no)}-registration.html`
    : `KISLAP-registrations-${people.length}.html`
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${filename}</title><style>${css}</style></head><body>${clone.innerHTML}</body></html>`
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

async function collectCss() {
  const parts = []
  for (const sheet of document.styleSheets) {
    try {
      parts.push([...sheet.cssRules].map((rule) => rule.cssText).join('\n'))
    } catch {
      if (sheet.href) parts.push(await (await fetch(sheet.href)).text())
    }
  }
  return `${parts.join('\n').replaceAll('@media print', '@media all')}
.registration-print{display:block !important;background:#fff;color:#111}`
}

async function inlineImages(liveRoot, cloneRoot) {
  const live = [...liveRoot.querySelectorAll('img')]
  const copy = [...cloneRoot.querySelectorAll('img')]
  await Promise.all(live.map(async (img, index) => {
    const node = copy[index]
    if (!node) return
    if (img.currentSrc.startsWith('data:') || img.src.startsWith('data:')) {
      node.setAttribute('src', img.currentSrc || img.src)
      return
    }
    try {
      const response = await fetch(img.src)
      const blob = await response.blob()
      node.setAttribute('src', await blobToDataUrl(blob))
    } catch {
      node.setAttribute('src', img.src)
    }
  }))
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function PrintCopies({ people, previewNo, previewForm }) {
  if (!people.length) return null
  return (
    <div className="ereg-print-target">
      {people.map((person) => (
        <RegistrationPrint
          key={person.tracker.member_no}
          form={person.tracker.member_no === previewNo && previewForm ? previewForm : fromRow(person.registration)}
          signatureScale={storedSignScale(person.tracker.member_no)}
        />
      ))}
    </div>
  )
}

function RegistrationReview({ person, onBack, onPrint, onDownload, onSaved, onForm, onUpdated }) {
  const [confirmed, setConfirmed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(() => (person?.registration ? fromRow(person.registration) : null))
  const [snapshot, setSnapshot] = useState(null)
  const [scale, setScale] = useState(() => storedSignScale(person?.tracker?.member_no))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedNote, setSavedNote] = useState('')

  const registration = person?.registration
  const memberNo = person?.tracker?.member_no

  useEffect(() => {
    setConfirmed(false)
    setEditing(false)
    setSnapshot(null)
    setSavedNote('')
    setError('')
    setScale(storedSignScale(memberNo))
    if (!registration) {
      setForm(null)
      return undefined
    }
    const base = fromRow(registration)
    setForm(base)
    let live = true
    Promise.all([
      cleanSignatureSource(base.applicantSignature),
      cleanSignatureSource(base.guardianSignature),
    ]).then(([applicant, guardian]) => {
      if (!live) return
      setForm((current) => (
        current && current.memberNo === base.memberNo
          ? { ...current, applicantSignature: applicant || current.applicantSignature, guardianSignature: guardian || current.guardianSignature }
          : current
      ))
    })
    return () => {
      live = false
    }
  }, [registration, memberNo])

  useEffect(() => {
    onForm?.(form)
  }, [form, onForm])

  if (!person?.registration || !form) {
    return (
      <div className="page page-wide">
        <button type="button" className="btn btn-ghost" onClick={onBack}><ArrowLeft size={16} /> Back</button>
        <p className="muted">This registration is no longer available.</p>
      </div>
    )
  }

  function setField(key) {
    return (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  }

  function resizeSignature(direction) {
    setScale((current) => {
      const next = Math.round((current + direction * SIGN_STEP) * 100) / 100
      const clamped = Math.min(MAX_SIGN, Math.max(MIN_SIGN, next))
      rememberSignScale(person.tracker.member_no, clamped)
      return clamped
    })
  }

  function beginEdit() {
    setSnapshot(form)
    setSavedNote('')
    setError('')
    setEditing(true)
  }

  function cancelEdit() {
    if (snapshot) setForm(snapshot)
    setEditing(false)
    setError('')
  }

  async function saveResponses() {
    setSaving(true)
    setError('')
    const { error: saveError } = await supabase.rpc('submit_registration', { payload: toPayload(form) })
    setSaving(false)
    if (saveError) {
      setError(saveError.code === 'PGRST202'
        ? 'The registration form is not set up in Supabase yet. Run supabase/registration-form.sql.'
        : errorMessage(saveError))
      return
    }
    setEditing(false)
    setSnapshot(null)
    setSavedNote('Responses updated. Confirm the form when it looks right.')
    onUpdated?.()
  }

  async function saveReview() {
    const status = form.applicationStatus
    if (!status) {
      setError('Select an application status.')
      return
    }
    if (status === 'approved' && form.interviewAssessment !== 'recommended') {
      setError('This is saved as approved only when the interview assessment is Recommended.')
      return
    }
    if (status === 'declined' && !form.remarks.trim()) {
      setError('Write a remark the member can read, explaining why this registration was declined.')
      return
    }
    const approved = status === 'approved'
    const review = {
      ...form,
      applicationStatus: approved ? 'approved' : status,
      remarks: status === 'declined' ? form.remarks.trim() : '',
      approvalDate: approved ? todayIso() : '',
    }
    setSaving(true)
    setError('')
    const { error: saveError } = await supabase.rpc('submit_registration', { payload: toPayload(review) })
    setSaving(false)
    if (saveError) {
      setError(
        saveError.code === 'PGRST202'
          ? 'The registration form is not set up in Supabase yet. Run supabase/registration-form.sql.'
          : errorMessage(saveError),
      )
      return
    }
    supabase.rpc('log_audit', {
      p_action: 'registration_reviewed',
      p_summary: `Reviewed the registration for ${memberCode(person.tracker.member_no)}`,
      p_detail: {
        member_no: person.tracker.member_no,
        application_status: review.applicationStatus,
        assigned_position: form.assignedPosition,
      },
    }).then(() => {}, () => {})
    onSaved()
  }

  return (
    <div className="page page-wide reg-review">
      <div className="page-header">
        <div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
            <ArrowLeft size={16} /> All eRegForms
          </button>
          <h1>{person.name}</h1>
          <p className="muted">{memberCode(person.tracker.member_no)} · {person.position}</p>
        </div>
        <div className="ereg-actions">
          <button type="button" className="btn btn-soft" onClick={onPrint}>
            <Printer size={16} /> Print
          </button>
          <Link className="btn btn-soft" to={`/register?member=${person.tracker.member_no}`}>
            <Pencil size={16} /> Full form
          </Link>
          <button type="button" className="btn btn-primary" onClick={onDownload}>
            <Download size={16} /> Download
          </button>
          <span className={`badge badge-${person.status.key}`}>{person.status.label}</span>
        </div>
      </div>

      <RegistrationPrint form={form} preview signatureScale={scale} />

      {!confirmed && editing && (
        <ResponseEditor form={form} setForm={setForm} saving={saving} error={error} onSave={saveResponses} onCancel={cancelEdit} />
      )}

      {!confirmed ? (
        <section className="reg-confirm">
          <div className="sign-size">
            <span>Signature size</span>
            <button type="button" className="btn btn-soft btn-sm" onClick={() => resizeSignature(-1)} disabled={scale <= MIN_SIGN} aria-label="Decrease signature size">
              <Minus size={16} /> Smaller
            </button>
            <strong>{Math.round(scale * 100)}%</strong>
            <button type="button" className="btn btn-soft btn-sm" onClick={() => resizeSignature(1)} disabled={scale >= MAX_SIGN} aria-label="Increase signature size">
              <Plus size={16} /> Larger
            </button>
          </div>
          <div>
            <strong>Confirm this registration</strong>
            <p className="muted">
              {savedNote || 'Check the form above. You can update the answers before organization review opens.'}
            </p>
          </div>
          <div className="ereg-actions">
            {editing ? (
              <button type="button" className="btn btn-ghost" onClick={cancelEdit}>Cancel editing</button>
            ) : (
              <button type="button" className="btn btn-soft" onClick={beginEdit}>
                <Pencil size={16} /> Edit responses
              </button>
            )}
            {!editing && (
              <button type="button" className="btn btn-primary" onClick={() => setConfirmed(true)}>
                <CheckCircle2 size={16} /> Confirm and review
              </button>
            )}
          </div>
        </section>
      ) : (
        <OrganizationReview form={form} setField={setField} setForm={setForm} saving={saving} error={error} onSave={saveReview} />
      )}
    </div>
  )
}

function ResponseEditor({ form, setForm, saving, error, onSave, onCancel }) {
  const schools = educationVisibility(form.educationLevel, form.schoolWorkStatus)

  function patch(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function toggle(key, value) {
    setForm((current) => {
      const list = current[key] || []
      return {
        ...current,
        [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value],
      }
    })
  }

  return (
    <section className="response-editor">
      <div>
        <h2>Edit submitted responses</h2>
        <p className="muted">These answers update the form above. Organization review stays as it is until you confirm.</p>
      </div>
      <h3>Personal information</h3>
      <div className="response-grid">
        <Text label="Surname" value={form.surname} onChange={(value) => patch('surname', value)} />
        <Text label="First name" value={form.firstName} onChange={(value) => patch('firstName', value)} />
        <Text label="Middle name" value={form.middleName} onChange={(value) => patch('middleName', value)} />
        <Text label="Suffix" value={form.suffix} onChange={(value) => patch('suffix', value)} />
        <Select label="Sex" value={form.sex} onChange={(value) => patch('sex', value)} options={[['male', 'Male'], ['female', 'Female']]} />
        <Text label="Age" value={form.age} onChange={(value) => patch('age', value)} />
        <DateField label="Date of birth" value={form.dateOfBirth} onChange={(iso) => setForm((current) => ({ ...current, dateOfBirth: iso, age: ageFromDate(iso) || current.age }))} />
        <Select label="Civil status" value={form.civilStatus} onChange={(value) => patch('civilStatus', value)} options={[['single', 'Single'], ['married', 'Married'], ['other', 'Other']]} />
        <Text label="Permanent address" wide value={form.address} onChange={(value) => patch('address', value)} />
        <Text label="Barangay" value={form.barangay} onChange={(value) => patch('barangay', value)} />
        <Text label="City / municipality" value={form.city} onChange={(value) => patch('city', value)} />
        <Text label="Province" value={form.province} onChange={(value) => patch('province', value)} />
        <Text label="Contact number" value={form.contactNumber} onChange={(value) => patch('contactNumber', value)} />
        <Text label="Email address" wide value={form.email} onChange={(value) => patch('email', value)} />
        <Text label="Facebook name" wide value={form.facebookName} onChange={(value) => patch('facebookName', value)} />
      </div>
      <h3>Parents and additional information</h3>
      <div className="response-grid">
        <Text label="Father's name" value={form.fatherName} onChange={(value) => patch('fatherName', value)} />
        <Text label="Mother's name" value={form.motherName} onChange={(value) => patch('motherName', value)} />
        <Select label="Person with disability" value={form.pwd} onChange={(value) => patch('pwd', value)} options={DISCLOSURE} />
        <Select label="Registered voter" value={form.registeredVoter} onChange={(value) => patch('registeredVoter', value)} options={DISCLOSURE} />
        <Select label="Religion" value={form.religion} onChange={(value) => patch('religion', value)} options={RELIGIONS} />
        {form.religion === 'Other' && <Text label="Other religion" value={form.religionOther} onChange={(value) => patch('religionOther', value)} />}
        <Text label="Skills, talents, and expertise" wide value={form.skills} onChange={(value) => patch('skills', value)} />
      </div>
      <h3>Education</h3>
      <div className="response-grid">
        <Select label="Highest attainment" value={form.educationLevel} onChange={(value) => patch('educationLevel', value)} options={EDUCATION_LEVELS} />
        <Select label="School / work status" value={form.schoolWorkStatus} onChange={(value) => patch('schoolWorkStatus', value)} options={WORK_STATUSES} />
        {schools.elementary && <Text label="Elementary school" value={form.elementarySchool} onChange={(value) => patch('elementarySchool', value)} />}
        {schools.highSchool && <Text label="Secondary school" value={form.highSchool} onChange={(value) => patch('highSchool', value)} />}
        {schools.strand && <Select label="Strand (SHS)" value={form.strand} onChange={(value) => patch('strand', value)} options={STRANDS} />}
        {schools.strand && form.strand === 'Other' && <Text label="Other strand" value={form.strandOther} onChange={(value) => patch('strandOther', value)} />}
        {schools.college && <Text label="College school" value={form.collegeSchool} onChange={(value) => patch('collegeSchool', value)} />}
        {schools.course && <Text label="College course / major" value={form.course} onChange={(value) => patch('course', value)} />}
        {(schools.vocational || schools.other) && <Text label={schools.other ? 'School name' : 'Vocational / technical school'} value={form.schoolName} onChange={(value) => patch('schoolName', value)} />}
        {schools.grade && <Text label="Current grade level or year" value={form.gradeLevel} onChange={(value) => patch('gradeLevel', value)} />}
      </div>
      <h3>Emergency guardian</h3>
      <div className="response-grid">
        <Text label="Guardian name" value={form.guardianName} onChange={(value) => patch('guardianName', value)} />
        <Text label="Contact number" value={form.guardianContact} onChange={(value) => patch('guardianContact', value)} />
        <Text label="Relationship" value={form.guardianRelationship} onChange={(value) => patch('guardianRelationship', value)} />
        <Text label="Alternative contact" value={form.altContactName} onChange={(value) => patch('altContactName', value)} />
        <Text label="Alternative number" value={form.altContactNumber} onChange={(value) => patch('altContactNumber', value)} />
      </div>
      <h3>Volunteer interests</h3>
      <Checks label="Areas" options={COMMITTEES.map((name) => [name, name])} value={form.interests} onToggle={(value) => toggle('interests', value)} />
      <div className="response-grid">
        <Text label="Preferred committee" value={form.preferredCommittee} onChange={(value) => patch('preferredCommittee', value)} />
        <Text label="Other interests" value={form.otherInterests} onChange={(value) => patch('otherInterests', value)} />
      </div>
      <Checks label="Availability" options={AVAILABILITY} value={form.availability} onToggle={(value) => toggle('availability', value)} />
      <h3>Consent and signatures</h3>
      <div className="response-grid">
        <Select label="Formal picture" value={form.photoStatus} onChange={(value) => patch('photoStatus', value)} options={[['submitted', 'Submitted'], ['pending', 'Pending']]} />
        <Text label="Applicant printed name" value={form.applicantPrintedName} onChange={(value) => patch('applicantPrintedName', value)} />
        <DateField label="Date signed" value={form.dateSigned} onChange={(iso) => patch('dateSigned', iso)} />
        <DateField label="Guardian date" value={form.guardianSignedDate} onChange={(iso) => patch('guardianSignedDate', iso)} />
        <SignatureReplace label="Applicant e-signature" value={form.applicantSignature} onChange={(value) => patch('applicantSignature', value)} />
        <SignatureReplace label="Guardian e-signature" value={form.guardianSignature} onChange={(value) => patch('guardianSignature', value)} />
      </div>
      <Checks
        label="Consent"
        options={[
          ['certified', 'Applicant declaration agreed'],
          ['privacyConsent', 'Privacy consent'],
          ['announcementsConsent', 'Announcements'],
          ['photoPublicConsent', 'Public photo consent'],
        ]}
        value={['certified', 'privacyConsent', 'announcementsConsent', 'photoPublicConsent'].filter((key) => form[key])}
        onToggle={(key) => patch(key, !form[key])}
      />
      {error && <div className="alert">{error}</div>}
      <div className="register-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save responses'}
        </button>
      </div>
    </section>
  )
}

function Text({ label, value, onChange, wide = false }) {
  return (
    <label className={`field ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      <input className="input" value={value || ''} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select className="input" value={value || ''} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select</option>
        {options.map(([option, text]) => <option key={option} value={option}>{text}</option>)}
      </select>
    </label>
  )
}

function Checks({ label, options, value, onToggle }) {
  return (
    <fieldset className="choice-set">
      <legend>{label}</legend>
      <div className="choice-grid">
        {options.map(([option, text]) => (
          <label key={option} className="check">
            <input type="checkbox" checked={value.includes(option)} onChange={() => onToggle(option)} />
            <span>{text}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function SignatureReplace({ label, value, onChange }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [cropping, setCropping] = useState(false)
  const [box, setBox] = useState({ x: 0.06, y: 0.08, w: 0.88, h: 0.84 })
  const stageRef = useRef(null)
  const dragRef = useRef(null)
  const image = isSignatureImage(value)

  async function run(task) {
    setBusy(true)
    setError('')
    try {
      onChange(await task())
    } catch (err) {
      setError(err.message || 'The signature could not be changed.')
    } finally {
      setBusy(false)
    }
  }

  async function onFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setCropping(false)
    await run(() => signatureFromFile(file))
  }

  function pointOf(event) {
    const rect = stageRef.current.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
      rect,
    }
  }

  function onPointerDown(event) {
    if (!cropping || !stageRef.current) return
    const point = pointOf(event)
    const edgeX = 14 / point.rect.width
    const edgeY = 14 / point.rect.height
    const inside = point.x >= box.x && point.y >= box.y && point.x <= box.x + box.w && point.y <= box.y + box.h
    let handle = 'new'
    if (inside) {
      const north = point.y <= box.y + edgeY
      const south = point.y >= box.y + box.h - edgeY
      const west = point.x <= box.x + edgeX
      const east = point.x >= box.x + box.w - edgeX
      handle = `${north ? 'n' : south ? 's' : ''}${west ? 'w' : east ? 'e' : ''}` || 'move'
    }
    dragRef.current = { handle, x: point.x, y: point.y, box: { ...box } }
    if (handle === 'new') setBox({ x: point.x, y: point.y, w: 0.08, h: 0.08 })
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* dragging still follows the pointer without capture */
    }
  }

  function onPointerMove(event) {
    const drag = dragRef.current
    if (!drag) return
    const point = pointOf(event)
    const dx = point.x - drag.x
    const dy = point.y - drag.y
    const start = drag.box
    let next = { ...start }
    if (drag.handle === 'move') {
      next.x = start.x + dx
      next.y = start.y + dy
    } else if (drag.handle === 'new') {
      next = { x: drag.x, y: drag.y, w: point.x - drag.x, h: point.y - drag.y }
    } else {
      if (drag.handle.includes('w')) {
        next.x = start.x + dx
        next.w = start.w - dx
      }
      if (drag.handle.includes('e')) next.w = start.w + dx
      if (drag.handle.includes('n')) {
        next.y = start.y + dy
        next.h = start.h - dy
      }
      if (drag.handle.includes('s')) next.h = start.h + dy
    }
    setBox(fitCrop(next))
  }

  function onPointerUp() {
    dragRef.current = null
  }

  return (
    <div className="field sign-adjust">
      <span>{label}</span>
      {image && (
        <div
          className={`sign-stage ${cropping ? 'is-cropping' : ''}`}
          ref={stageRef}
          role="application"
          aria-label={`${label} crop`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <img src={value} alt="" draggable="false" />
          {cropping && (
            <div
              className="sign-crop"
              style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }}
            />
          )}
        </div>
      )}
      {image && (
        <div className="sign-tools">
          <button type="button" className="btn btn-soft btn-sm" disabled={busy} onClick={() => run(() => rotateSignature(value, -1))}>
            <RotateCcw size={16} /> Rotate left
          </button>
          <button type="button" className="btn btn-soft btn-sm" disabled={busy} onClick={() => run(() => rotateSignature(value, 1))}>
            <RotateCw size={16} /> Rotate right
          </button>
          {cropping ? (
            <>
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(async () => { const next = await cropSignature(value, box); setCropping(false); return next })}>
                Apply crop
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setCropping(false)}>Cancel crop</button>
            </>
          ) : (
            <button type="button" className="btn btn-soft btn-sm" disabled={busy} onClick={() => { setBox({ x: 0.06, y: 0.08, w: 0.88, h: 0.84 }); setCropping(true) }}>
              <Crop size={16} /> Crop
            </button>
          )}
        </div>
      )}
      <input className="input" type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} disabled={busy} />
      <small className="muted">
        {busy ? 'Updating the signature…' : cropping ? 'Drag the box to keep the ink, then apply the crop.' : 'Upload a replacement, or rotate and crop the signature above. Save responses to keep it.'}
      </small>
      {error && <div className="alert">{error}</div>}
    </div>
  )
}

function fitCrop(box) {
  let { x, y, w, h } = box
  if (w < 0) {
    x += w
    w = -w
  }
  if (h < 0) {
    y += h
    h = -h
  }
  w = Math.max(0.08, Math.min(1, w))
  h = Math.max(0.08, Math.min(1, h))
  x = Math.min(Math.max(0, x), 1 - w)
  y = Math.min(Math.max(0, y), 1 - h)
  return { x, y, w, h }
}

function OrganizationReview({ form, setField, setForm, saving, error, onSave }) {
  const { units, positionsByUnit, loading } = useData()
  const registered = units.flatMap((unit) =>
    (positionsByUnit.get(unit.id) || []).map((position) => `${position.title} — ${unit.name}`),
  )
  const known = registered.includes(form.assignedPosition)

  return (
    <section className="reg-org">
      <h2>Organization review</h2>
      <p className="muted">Approved is saved only when the interview assessment is Recommended. Pending keeps the form on hold. Declined needs a remark the member can read before submitting again.</p>
      <div className="field-row">
        <DateField label="Date received" value={form.dateReceived} onChange={(iso) => setForm((current) => ({ ...current, dateReceived: iso }))} />
        <DateField label="Interview date" value={form.interviewDate} onChange={(iso) => setForm((current) => ({ ...current, interviewDate: iso }))} />
      </div>
      <Choice label="Application status" value={form.applicationStatus} onChange={setField('applicationStatus')} options={[['pending', 'Pending — on hold'], ['approved', 'Approved'], ['declined', 'Declined']]} />
      <Choice label="Interview assessment" value={form.interviewAssessment} onChange={setField('interviewAssessment')} options={[['recommended', 'Recommended'], ['review', 'For further review'], ['not_recommended', 'Not recommended']]} />
      <label className="field">
        <span>Assigned position</span>
        <select className="input" value={form.assignedPosition} onChange={setField('assignedPosition')}>
          <option value="">{loading ? 'Loading positions…' : 'Select a registered position'}</option>
          {form.assignedPosition && !known && <option value={form.assignedPosition}>{form.assignedPosition}</option>}
          {units.map((unit) => {
            const positions = positionsByUnit.get(unit.id) || []
            if (!positions.length) return null
            return (
              <optgroup key={unit.id} label={unit.name}>
                {positions.map((position) => {
                  const label = `${position.title} — ${unit.name}`
                  return <option key={position.id} value={label}>{label}</option>
                })}
              </optgroup>
            )
          })}
        </select>
      </label>
      <label className="field">
        <span>Reviewed by</span>
        <input className="input" value={form.reviewedBy} onChange={setField('reviewedBy')} placeholder="Officer name" />
      </label>
      {form.applicationStatus === 'declined' && (
        <label className="field">
          <span>Remarks for the member</span>
          <textarea className="input textarea" rows={4} value={form.remarks} onChange={setField('remarks')} placeholder="Explain why this registration was declined" />
          <small className="muted">The member sees this on their account and can submit a new registration.</small>
        </label>
      )}
      {error && <div className="alert">{error}</div>}
      <div className="register-actions">
        <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save organization review'}
        </button>
      </div>
    </section>
  )
}

function Choice({ label, options, value, onChange }) {
  return (
    <fieldset className="choice-set">
      <legend>{label}</legend>
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

function statusOf(registration) {
  if (!registration) return { key: 'muted', label: 'Not yet' }
  if (registration.application_status === 'approved') return { key: 'approved', label: 'Approved' }
  if (registration.application_status === 'declined') return { key: 'declined', label: 'Declined' }
  return { key: 'submitted', label: 'On hold' }
}

function todayIso() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function positionOf(row, rolesByMember) {
  const roles = row.member_id ? rolesByMember.get(row.member_id) || [] : []
  if (roles.length) {
    return roles
      .map(({ position, unit }) => (position.level === 'member' ? `${unit?.name || 'Committee'} · Member` : position.title))
      .join(', ')
  }
  return TRACKER_ROLES.find((item) => item.value === row.tracker_role)?.label || '—'
}
