import Logo from './Logo'
import { memberCode } from '../lib/tracker'
import {
  AVAILABILITY,
  DISCLOSURE,
  EDUCATION_LEVELS,
  WORK_STATUSES,
  educationVisibility,
  formatDisplayDate,
  isSignatureImage,
  labelOf,
  parseMemberNo,
} from '../lib/registration'

function renderFieldValue(value) {
  if (!value) return '—'
  if (isSignatureImage(value)) return <img className="sign-preview" src={value} alt="E-signature" />
  return value
}

export default function RegistrationPrint({ form, lookup, preview = false }) {
  const code = parseMemberNo(form.memberNo)
  const name = [form.firstName, form.middleName, form.surname, form.suffix].filter(Boolean).join(' ')
  const schools = educationVisibility(form.educationLevel, form.schoolWorkStatus)
  const educationRows = [
    ['Highest attainment', labelOf(EDUCATION_LEVELS, form.educationLevel)],
    ['School / work status', labelOf(WORK_STATUSES, form.schoolWorkStatus)],
  ]
  if (schools.elementary) educationRows.push(['Elementary school', form.elementarySchool])
  if (schools.highSchool) educationRows.push(['Secondary school', form.highSchool])
  if (schools.strand) educationRows.push(['Strand (SHS)', form.strand === 'Other' ? form.strandOther : form.strand])
  if (schools.college) {
    educationRows.push(['College school', form.collegeSchool])
    educationRows.push(['College course / major', form.course])
  }
  if (schools.vocational) educationRows.push(['Vocational / technical school', form.schoolName])
  if (schools.other) educationRows.push(['School name', form.schoolName])
  if (schools.grade) educationRows.push(['Current grade level or year', form.gradeLevel])
  const groups = [
    ['A. Personal information', [
      ['Surname', form.surname],
      ['First name', form.firstName],
      ['Middle name', form.middleName],
      ['Suffix', form.suffix],
      ['Sex', labelOf([['male', 'Male'], ['female', 'Female']], form.sex)],
      ['Age', form.age],
      ['Date of birth', formatDisplayDate(form.dateOfBirth), 'date'],
      ['Civil status', labelOf([['single', 'Single'], ['married', 'Married'], ['other', 'Other']], form.civilStatus)],
      ['Permanent address', form.address, 'wide'],
      ['Barangay', form.barangay],
      ['City / municipality', form.city],
      ['Province', form.province],
      ['Contact number', form.contactNumber],
      ['Email address', form.email, 'wide'],
      ['Facebook name', form.facebookName, 'wide'],
    ]],
    ['B. Parents', [
      ["Father's name", form.fatherName],
      ["Mother's name", form.motherName],
    ]],
    ['C. Additional information', [
      ['Person with disability', labelOf(DISCLOSURE, form.pwd)],
      ['Registered voter', labelOf(DISCLOSURE, form.registeredVoter)],
      ['Religion', form.religion === 'Other' ? form.religionOther : form.religion],
      ['Skills, talents, and expertise', form.skills, 'wide'],
    ]],
    ['D. Educational background', educationRows],
    ['E. Emergency guardian', [
      ['Guardian name', form.guardianName],
      ['Contact number', form.guardianContact],
      ['Relationship', form.guardianRelationship],
      ['Alternative contact', form.altContactName],
      ['Alternative number', form.altContactNumber],
    ]],
    ['F. Volunteer interests', [
      ['Areas', form.interests.join(', '), 'wide'],
      ['Preferred committee', form.preferredCommittee],
      ['Availability', form.availability.map((value) => labelOf(AVAILABILITY, value)).filter(Boolean).join(', ')],
      ['Other interests', form.otherInterests, 'wide'],
    ]],
    ['G. Requirements and consent', [
      ['Formal picture', labelOf([['submitted', 'Submitted'], ['pending', 'Pending']], form.photoStatus)],
      ['Applicant declaration', form.certified ? 'Agreed' : ''],
      ['Privacy consent', form.privacyConsent ? 'Yes' : ''],
      ['Announcements', form.announcementsConsent ? 'Yes' : ''],
      ['Public photo consent', form.photoPublicConsent ? 'Yes' : 'No'],
    ]],
  ]
  const signatures = [
    ['Applicant', form.applicantPrintedName, form.applicantSignature, formatDisplayDate(form.dateSigned)],
    ['Guardian', form.guardianName, form.guardianSignature, formatDisplayDate(form.guardianSignedDate)],
  ]

  return (
    <article className={preview ? 'registration-sheet' : 'registration-print'}>
      <header className="print-header">
        <div className="print-brand">
          <Logo size={preview ? 88 : 84} />
          <p>Kabataang Inspirasyon sa Serbisyo, Liderato at Pagpapaunlad</p>
          <h1>KISLAP Youth Volunteers</h1>
          <p>Membership Registration Form</p>
          <p>Mauban, Quezon</p>
        </div>
        <div className="print-photo">
          <span>2×2 / Passport Picture</span>
          <small>Attach photo here after printing</small>
        </div>
        <p className="print-id">
          <strong>{code ? memberCode(code) : 'KISLAP-26-___'}</strong>
          <span>{name || lookup?.row?.full_name || ''}</span>
        </p>
      </header>

      {groups.map(([title, rows]) => (
        <section key={title} className="print-section">
          <h2>{title}</h2>
          <dl className="print-fields">
            {rows.map(([label, value, kind]) => (
              <div key={label} className={kind === 'wide' ? 'wide' : ''}>
                <dt>{label}</dt>
                <dd className={kind === 'date' ? 'is-date' : ''}>{renderFieldValue(value)}</dd>
              </div>
            ))}
          </dl>
          {title.startsWith('G.') && (
            <div className="sign-board">
              {signatures.map(([role, printed, signature, signedOn]) => (
                <figure key={role} className="sign-block">
                  <figcaption>{role}</figcaption>
                  <p className="sign-name">{printed || '—'}</p>
                  <div className="sign-line">{renderFieldValue(signature)}</div>
                  <p className="sign-date"><span>Date</span><strong>{signedOn || '—'}</strong></p>
                </figure>
              ))}
            </div>
          )}
        </section>
      ))}
    </article>
  )
}
