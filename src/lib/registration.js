export const COMMITTEES = [
  'Volunteer and Membership',
  'Community Outreach and Partnership',
  'Environmental and Sustainability',
  'Youth Leadership and Training',
  'Project Development',
  'Finance and Audit',
  'Research Development',
  'Educational Resources',
  'Social Inclusion and Equality',
  'Media and Publicity',
  'Safety and Security',
  'Health and Well-being',
  'Economic and Innovation',
  'Secretariat',
]

export const EDUCATION_LEVELS = [
  ['elementary', 'Elementary / Primary'],
  ['secondary', 'Secondary'],
  ['college_undergraduate', 'College'],
  ['vocational', 'Vocational'],
  ['college_graduate', 'College graduate'],
  ['other', 'Other'],
]

export const WORK_STATUSES = [
  ['student', 'Student'],
  ['employed', 'Employed'],
  ['self_employed', 'Self-employed'],
  ['unemployed', 'Unemployed'],
  ['other', 'Other'],
]

export const AVAILABILITY = [
  ['weekdays', 'Weekdays'],
  ['weekends', 'Weekends'],
  ['holidays', 'Holidays'],
  ['flexible', 'Flexible'],
]

export const DISCLOSURE = [
  ['yes', 'Yes'],
  ['no', 'No'],
  ['prefer_not', 'Prefer not to say'],
]

export const RELIGIONS = [
  'Agnostic',
  'Animism',
  'Atheist',
  'Bahá\'í',
  'Baptist',
  'Born Again Christian',
  'Buddhism',
  'Confucianism',
  'Evangelical',
  'Hinduism',
  'Iglesia ni Cristo',
  'Indigenous / Traditional beliefs',
  'Islam',
  'Jainism',
  'Jehovah\'s Witnesses',
  'Jesus Is Lord Church',
  'Judaism',
  'Lutheran',
  'Members Church of God International',
  'Methodist',
  'Orthodox Christian',
  'Pentecostal',
  'Philippine Independent Church (Aglipayan)',
  'Presbyterian',
  'Protestant',
  'Roman Catholic',
  'Seventh-day Adventist',
  'Shinto',
  'Sikhism',
  'Taoism',
  'The Church of Jesus Christ of Latter-day Saints',
  'United Church of Christ in the Philippines',
  'Victory Christian Fellowship',
  'Zoroastrianism',
  'None',
  'Prefer not to say',
  'Other',
].map((name) => [name, name])

export const STRANDS = [
  ['STEM', 'STEM'],
  ['HUMSS', 'HUMSS'],
  ['ABM', 'ABM'],
  ['GAS', 'GAS'],
  ['TVL — Home Economics', 'TVL — Home Economics'],
  ['TVL — ICT', 'TVL — ICT'],
  ['TVL — Industrial Arts', 'TVL — Industrial Arts'],
  ['TVL — Agri-Fishery Arts', 'TVL — Agri-Fishery Arts'],
  ['Arts and Design', 'Arts and Design'],
  ['Sports', 'Sports'],
  ['Other', 'Other'],
]

const SECONDARY_LEVELS = ['secondary', 'junior_high', 'senior_high']
const COLLEGE_NOW = ['college_undergraduate', 'postgraduate']
const COLLEGE_DONE = ['college_graduate']

export function educationVisibility(level, status) {
  const collegeNow = COLLEGE_NOW.includes(level)
  const collegeDone = COLLEGE_DONE.includes(level)
  const college = collegeNow || collegeDone
  const secondary = SECONDARY_LEVELS.includes(level) || level === 'vocational' || college
  return {
    elementary: level === 'elementary' || secondary,
    highSchool: secondary,
    college,
    strand: SECONDARY_LEVELS.includes(level) || college || level === 'vocational',
    strandRequired: SECONDARY_LEVELS.includes(level) || college,
    course: college,
    vocational: level === 'vocational',
    other: level === 'other',
    grade: collegeNow || (status === 'student' && Boolean(level) && !collegeDone && level !== 'other'),
  }
}

export function primarySchool(form) {
  const fields = educationVisibility(form.educationLevel, form.schoolWorkStatus)
  if (fields.college) return form.collegeSchool.trim()
  if (fields.vocational || fields.other) return form.schoolName.trim()
  if (fields.highSchool) return form.highSchool.trim()
  if (fields.elementary) return form.elementarySchool.trim()
  return form.schoolName.trim()
}

export function religionValue(form) {
  if (form.religion === 'Other') return form.religionOther.trim()
  return form.religion.trim()
}

export function strandValue(form) {
  if (form.strand === 'Other') return form.strandOther.trim()
  return form.strand.trim()
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function emptyRegistration() {
  return {
    memberNo: '',
    surname: '',
    firstName: '',
    middleName: '',
    suffix: '',
    fatherName: '',
    motherName: '',
    sex: '',
    age: '',
    dateOfBirth: '',
    civilStatus: '',
    address: '',
    barangay: '',
    city: 'Mauban',
    province: 'Quezon',
    contactNumber: '',
    email: '',
    facebookName: '',
    pwd: '',
    registeredVoter: '',
    religion: '',
    religionOther: '',
    skills: '',
    educationLevel: '',
    elementarySchool: '',
    highSchool: '',
    collegeSchool: '',
    schoolName: '',
    strand: '',
    strandOther: '',
    gradeLevel: '',
    course: '',
    schoolWorkStatus: '',
    guardianName: '',
    guardianContact: '',
    guardianRelationship: '',
    altContactName: '',
    altContactNumber: '',
    interests: [],
    preferredCommittee: '',
    otherInterests: '',
    availability: [],
    photoStatus: '',
    certified: false,
    applicantPrintedName: '',
    applicantSignature: '',
    dateSigned: '',
    guardianSignature: '',
    guardianSignedDate: '',
    privacyConsent: false,
    announcementsConsent: false,
    photoPublicConsent: false,
    privacySignature: '',
    privacyDate: '',
    dateReceived: '',
    interviewDate: '',
    applicationStatus: '',
    interviewAssessment: '',
    assignedPosition: '',
    remarks: '',
    reviewedBy: '',
    approvalDate: '',
  }
}

export function parseMemberNo(value) {
  const text = String(value || '').trim().toUpperCase()
  const labeled = text.match(/^KISLAP-26-(\d{1,3})$/)
  const digits = labeled?.[1] || text.match(/^\d{1,3}$/)?.[0]
  if (!digits) return null
  const number = Number(digits)
  return number >= 1 && number <= 999 ? number : null
}

export function isValidDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '')
  if (!match) return false
  const date = new Date(`${iso}T00:00:00`)
  return date.getFullYear() === Number(match[1]) && date.getMonth() + 1 === Number(match[2]) && date.getDate() === Number(match[3])
}

export function formatDisplayDate(iso) {
  if (!isValidDate(iso)) return ''
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

export function ageFromDate(iso) {
  if (!isValidDate(iso)) return ''
  const birth = new Date(`${iso}T00:00:00`)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const month = today.getMonth() - birth.getMonth()
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age -= 1
  return age >= 0 ? String(age) : ''
}

export function labelOf(options, value) {
  return options.find(([key]) => key === value)?.[1] || ''
}

export function isSignatureImage(value) {
  return typeof value === 'string' && (value.startsWith('data:image/') || /^https?:\/\//.test(value))
}

export function hasSignature(value) {
  const text = String(value || '').trim()
  if (!text) return false
  if (isSignatureImage(text)) return true
  return !text.startsWith('data:')
}

export function validateStep(stepId, form, lookup) {
  const missing = []
  const need = (ok, label) => {
    if (!ok) missing.push(label)
  }

  if (stepId === 'id') {
    const memberNo = parseMemberNo(form.memberNo)
    need(memberNo, 'Membership ID, such as KISLAP-26-001')
    if (memberNo) need(lookup?.status === 'found', 'A membership ID that is already on the tracker')
  }

  if (stepId === 'personal') {
    need(form.surname.trim(), 'Surname')
    need(form.firstName.trim(), 'First name')
    need(form.fatherName.trim(), "Father's name")
    need(form.motherName.trim(), "Mother's name")
    need(form.sex, 'Sex')
    need(isValidDate(form.dateOfBirth) && form.dateOfBirth <= todayIso(), 'Date of birth')
    need(Number(form.age) >= 1 && Number(form.age) <= 120, 'Age')
    need(form.civilStatus, 'Civil status')
    need(form.address.trim(), 'Permanent address')
    need(form.barangay.trim(), 'Barangay')
    need(form.city.trim(), 'City / municipality')
    need(form.province.trim(), 'Province')
    need(form.contactNumber.trim(), 'Contact number')
    need(EMAIL.test(form.email.trim()), 'Email address')
  }

  if (stepId === 'additional' && form.religion === 'Other') {
    need(form.religionOther.trim(), 'Religion')
  }

  if (stepId === 'education') {
    const fields = educationVisibility(form.educationLevel, form.schoolWorkStatus)
    need(form.educationLevel, 'Highest educational attainment')
    need(form.schoolWorkStatus, 'School / work status')
    if (fields.elementary) need(form.elementarySchool.trim(), 'Elementary school')
    if (fields.highSchool) need(form.highSchool.trim(), 'Secondary school')
    if (fields.college) need(form.collegeSchool.trim(), 'College school')
    if (fields.strandRequired) need(strandValue(form), 'Strand (Senior High School)')
    if (fields.course) need(form.course.trim(), 'College course')
    if (fields.vocational) need(form.schoolName.trim(), 'Vocational / technical school')
    if (fields.other) need(form.schoolName.trim(), 'School name')
    if (fields.grade) need(form.gradeLevel.trim(), 'Current grade level or year')
  }

  if (stepId === 'emergency') {
    need(form.guardianName.trim(), 'Parent, guardian, or emergency contact name')
    need(form.guardianContact.trim(), 'Emergency contact number')
    need(form.guardianRelationship.trim(), 'Relationship to the applicant')
  }

  if (stepId === 'interests') {
    need(form.interests.length > 0, 'At least one volunteer area')
    need(form.availability.length > 0, 'At least one availability')
  }

  if (stepId === 'agreement') {
    const minor = Number(form.age) > 0 && Number(form.age) < 18
    need(form.photoStatus, 'Formal picture status')
    need(form.certified, 'The applicant declaration')
    need(form.applicantPrintedName.trim(), 'Applicant printed name')
    need(hasSignature(form.applicantSignature), 'Applicant e-signature')
    need(isValidDate(form.dateSigned), 'Date signed')
    if (minor) {
      need(hasSignature(form.guardianSignature), 'Parent or guardian e-signature')
      need(isValidDate(form.guardianSignedDate), 'Parent or guardian date')
    }
    need(form.privacyConsent, 'Data privacy consent')
    need(form.announcementsConsent, 'Consent to receive announcements')
  }

  return missing
}

export function toPayload(form) {
  const schools = educationVisibility(form.educationLevel, form.schoolWorkStatus)
  return {
    member_no: parseMemberNo(form.memberNo),
    surname: form.surname.trim(),
    first_name: form.firstName.trim(),
    middle_name: form.middleName.trim(),
    suffix: form.suffix.trim(),
    father_name: form.fatherName.trim(),
    mother_name: form.motherName.trim(),
    sex: form.sex,
    age: Number(form.age),
    date_of_birth: form.dateOfBirth,
    civil_status: form.civilStatus,
    address: form.address.trim(),
    barangay: form.barangay.trim(),
    city: form.city.trim(),
    province: form.province.trim(),
    contact_number: form.contactNumber.trim(),
    email: form.email.trim(),
    facebook_name: form.facebookName.trim(),
    pwd: form.pwd || null,
    registered_voter: form.registeredVoter || null,
    religion: religionValue(form),
    skills: form.skills.trim(),
    education_level: form.educationLevel,
    school_name: primarySchool(form),
    elementary_school: schools.elementary ? form.elementarySchool.trim() : '',
    high_school: schools.highSchool ? form.highSchool.trim() : '',
    college_school: schools.college ? form.collegeSchool.trim() : '',
    strand: schools.strand ? strandValue(form) : '',
    grade_level: schools.grade ? form.gradeLevel.trim() : '',
    course: schools.course ? form.course.trim() : '',
    school_work_status: form.schoolWorkStatus,
    guardian_name: form.guardianName.trim(),
    guardian_contact: form.guardianContact.trim(),
    guardian_relationship: form.guardianRelationship.trim(),
    alt_contact_name: form.altContactName.trim(),
    alt_contact_number: form.altContactNumber.trim(),
    interests: form.interests,
    preferred_committee: form.preferredCommittee,
    other_interests: form.otherInterests.trim(),
    availability: form.availability,
    photo_status: form.photoStatus,
    applicant_printed_name: form.applicantPrintedName.trim(),
    applicant_signature: form.applicantSignature.trim(),
    date_signed: form.dateSigned,
    guardian_signature: form.guardianSignature.trim(),
    guardian_signed_date: form.guardianSignedDate || null,
    privacy_consent: form.privacyConsent,
    announcements_consent: form.announcementsConsent,
    photo_public_consent: form.photoPublicConsent,
    privacy_signature: form.applicantSignature.trim(),
    privacy_date: form.dateSigned,
    date_received: form.dateReceived || null,
    interview_date: form.interviewDate || null,
    application_status: form.applicationStatus || null,
    interview_assessment: form.interviewAssessment || null,
    assigned_position: form.assignedPosition.trim(),
    remarks: form.remarks.trim(),
    reviewed_by: form.reviewedBy.trim(),
    approval_date: form.approvalDate || null,
  }
}

export function fromRow(row) {
  const form = emptyRegistration()
  form.memberNo = String(row.member_no)
  form.surname = row.surname || ''
  form.firstName = row.first_name || ''
  form.middleName = row.middle_name || ''
  form.suffix = row.suffix || ''
  form.fatherName = row.father_name || ''
  form.motherName = row.mother_name || ''
  form.sex = row.sex || ''
  form.age = row.age ? String(row.age) : ''
  form.dateOfBirth = row.date_of_birth || ''
  form.civilStatus = row.civil_status || ''
  form.address = row.address || ''
  form.barangay = row.barangay || ''
  form.city = row.city || ''
  form.province = row.province || ''
  form.contactNumber = row.contact_number || ''
  form.email = row.email || ''
  form.facebookName = row.facebook_name || ''
  form.pwd = row.pwd || ''
  form.registeredVoter = row.registered_voter || ''
  const savedReligion = row.religion || ''
  const knownReligion = RELIGIONS.some(([name]) => name === savedReligion)
  form.religion = savedReligion && !knownReligion ? 'Other' : savedReligion
  form.religionOther = savedReligion && !knownReligion ? savedReligion : ''
  form.skills = row.skills || ''
  form.educationLevel = normalizeEducation(row.education_level || '')
  form.elementarySchool = row.elementary_school || ''
  form.highSchool = row.high_school || ''
  form.collegeSchool = row.college_school || ''
  form.schoolName = row.school_name || ''
  const savedStrand = row.strand || ''
  const knownStrand = STRANDS.some(([name]) => name === savedStrand)
  form.strand = savedStrand && !knownStrand ? 'Other' : savedStrand
  form.strandOther = savedStrand && !knownStrand ? savedStrand : ''
  form.gradeLevel = row.grade_level || ''
  form.course = row.course || ''
  const schools = educationVisibility(form.educationLevel, row.school_work_status || '')
  if (!form.elementarySchool && !form.highSchool && !form.collegeSchool && form.schoolName) {
    if (schools.college) form.collegeSchool = form.schoolName
    else if (schools.highSchool && !schools.vocational) form.highSchool = form.schoolName
    else if (schools.elementary && !schools.vocational && !schools.other) form.elementarySchool = form.schoolName
  }
  form.schoolWorkStatus = row.school_work_status || ''
  form.guardianName = row.guardian_name || ''
  form.guardianContact = row.guardian_contact || ''
  form.guardianRelationship = row.guardian_relationship || ''
  form.altContactName = row.alt_contact_name || ''
  form.altContactNumber = row.alt_contact_number || ''
  form.interests = row.interests || []
  form.preferredCommittee = row.preferred_committee || ''
  form.otherInterests = row.other_interests || ''
  form.availability = row.availability || []
  form.photoStatus = row.photo_status || ''
  form.certified = true
  form.applicantPrintedName = row.applicant_printed_name || ''
  form.applicantSignature = row.applicant_signature || ''
  form.dateSigned = row.date_signed || ''
  form.guardianSignature = row.guardian_signature || ''
  form.guardianSignedDate = row.guardian_signed_date || ''
  form.privacyConsent = Boolean(row.privacy_consent)
  form.announcementsConsent = Boolean(row.announcements_consent)
  form.photoPublicConsent = Boolean(row.photo_public_consent)
  form.privacySignature = row.privacy_signature || ''
  form.privacyDate = row.privacy_date || ''
  form.dateReceived = row.date_received || ''
  form.interviewDate = row.interview_date || ''
  form.applicationStatus = row.application_status || ''
  form.interviewAssessment = row.interview_assessment || ''
  form.assignedPosition = row.assigned_position || ''
  form.remarks = row.remarks || ''
  form.reviewedBy = row.reviewed_by || ''
  form.approvalDate = row.approval_date || ''
  return form
}

function normalizeEducation(level) {
  if (level === 'junior_high' || level === 'senior_high') return 'secondary'
  if (level === 'postgraduate') return 'college_undergraduate'
  return level
}

function todayIso() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}
