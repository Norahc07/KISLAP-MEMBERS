import { COMMITTEES } from './registration'

/** Official 40 barangays of Mauban, Quezon — bundled for offline use. */
export const MAUBAN_BARANGAYS = [
  'Abo-abo',
  'Alitap',
  'Baao',
  'Bagong Bayan',
  'Balaybalay',
  'Bato',
  'Cagbalete I',
  'Cagbalete II',
  'Cagsiay I',
  'Cagsiay II',
  'Cagsiay III',
  'Concepcion',
  'Daungan',
  'Liwayway',
  'Lual',
  'Lual Rural',
  'Lucutan',
  'Luya-luya',
  'Mabato',
  'Macasin',
  'Polo',
  'Remedios I',
  'Remedios II',
  'Rizaliana',
  'Rosario',
  'Sadsaran',
  'San Gabriel',
  'San Isidro',
  'San Jose',
  'San Lorenzo',
  'San Miguel',
  'San Rafael',
  'San Roque',
  'San Vicente',
  'Santa Lucia',
  'Santo Angel',
  'Santo Niño',
  'Santol',
  'Soledad',
  'Tapucan',
]

export const VOTER_BARANGAY_OPTIONS = [
  ...MAUBAN_BARANGAYS,
  'Registered in another municipality/city',
  'Not applicable',
]

export const AGE_BANDS = [
  ['14', '14 (upcoming SK voter)'],
  ['15-17', '15–17'],
  ['18-20', '18–20'],
  ['21-24', '21–24'],
  ['25-27', '25–27'],
  ['28-30', '28–30'],
]

/** Age 14 — turning 15, the starting point for barangay SK voter eligibility. */
export const UPCOMING_SK_AGE_BAND = '14'

export function isUpcomingSkVoter(row) {
  return row?.age_band === UPCOMING_SK_AGE_BAND
}

export function needsGuardianAssent(ageBand) {
  return ageBand === UPCOMING_SK_AGE_BAND || ageBand === '15-17'
}

export const SEX_OPTIONS = [
  ['male', 'Male'],
  ['female', 'Female'],
  ['prefer_not', 'Prefer not to say'],
]

export const PWD_OPTIONS = [
  ['yes', 'Yes'],
  ['no', 'No'],
  ['prefer_not', 'Prefer not to say'],
]

export const PWD_TYPES = [
  'Physical / Mobility',
  'Visual',
  'Hearing / Speech',
  'Psychosocial',
  'Intellectual / Learning',
  'Chronic illness',
  'Multiple',
  'Other / Prefer to describe',
]

export const CIVIL_STATUS_OPTIONS = [
  ['single', 'Single'],
  ['married', 'Married'],
  ['widowed', 'Widowed'],
  ['other', 'Other'],
  ['prefer_not', 'Prefer not to say'],
]

export const VOTER_STATUS = [
  ['yes', 'Yes'],
  ['no', 'No'],
  ['planning', 'Not yet, but planning to register'],
  ['not_eligible', 'Not eligible to register yet'],
]

export const HOUSEHOLD_RELATIONSHIPS = [
  ['father', 'Father'],
  ['mother', 'Mother'],
  ['guardian', 'Guardian'],
  ['spouse', 'Spouse'],
  ['sibling', 'Brother / Sister'],
  ['grandparent', 'Grandparent'],
  ['other', 'Other (please specify)'],
]

export const EDUCATIONAL_STATUS = [
  ['elementary_level', 'Elementary Level'],
  ['elementary_graduate', 'Elementary Graduate'],
  ['jhs', 'Junior High School'],
  ['jhs_graduate', 'Junior High School Graduate'],
  ['shs', 'Senior High School'],
  ['shs_graduate', 'Senior High School Graduate'],
  ['college_undergrad', 'College Undergraduate'],
  ['college_graduate', 'College Graduate'],
  ['tesda_student', 'Technical-Vocational Student'],
  ['tesda_graduate', 'Technical-Vocational Graduate'],
  ['osy', 'Out-of-School Youth'],
  ['not_studying', 'Not Currently Studying'],
  ['other', 'Other'],
]

export const CONTINUE_EDUCATION = [
  ['yes', 'Yes'],
  ['no', 'No'],
  ['exploring', 'Still exploring my options'],
]

export const EMPLOYMENT_STATUS = [
  ['student', 'Student'],
  ['employed_full', 'Employed – Full-time'],
  ['employed_part', 'Employed – Part-time'],
  ['self_employed', 'Self-employed'],
  ['entrepreneur', 'Entrepreneur / Business Owner'],
  ['unemployed', 'Unemployed'],
  ['looking', 'Looking for employment'],
  ['not_seeking', 'Not currently seeking employment'],
  ['other', 'Other'],
]

export const LIVELIHOOD_INTEREST = [
  ['yes', 'Yes'],
  ['no', 'No'],
  ['maybe', 'Maybe'],
]

export const OPPORTUNITIES = [
  'Skills training',
  'Entrepreneurship seminars',
  'Livelihood programs',
  'Employment readiness workshops',
  'Digital skills training',
  'Career guidance',
  'Financial literacy',
  'Scholarship or educational information',
  'Other',
]

export const SKILLS = [
  'Drawing and Painting',
  'Graphic Design',
  'Photography',
  'Videography',
  'Video Editing',
  'Music / Singing',
  'Dancing',
  'Writing',
  'Computer Literacy',
  'Microsoft Office / Google Workspace',
  'Web Development',
  'Programming',
  'Social Media Management',
  'Digital Marketing',
  'Technical Troubleshooting',
  'Public Speaking',
  'Leadership',
  'Event Hosting',
  'Communication',
  'Team Management',
  'Organization and Planning',
  'Research and Documentation',
  'Teaching / Tutoring',
  'Sports Coaching',
  'First Aid Training',
  'Environmental Activities',
  'Event Management',
  'Entrepreneurship',
  'Cooking',
  'Craftsmanship',
  'Other',
]

export const SKILLS_TO_DEVELOP = [
  'Leadership',
  'Public Speaking',
  'Communication',
  'Graphic Design',
  'Photography and Videography',
  'Digital Literacy',
  'Programming and Technology',
  'Research',
  'Project Management',
  'Entrepreneurship',
  'Financial Literacy',
  'First Aid and Safety',
  'Teaching and Facilitation',
  'Other',
]

export const INTERESTS = [
  'Sports and Recreation',
  'Arts and Culture',
  'Music and Entertainment',
  'Technology and Innovation',
  'Environmental Protection',
  'Community Outreach',
  'Education and Learning',
  'Leadership and Governance',
  'Entrepreneurship',
  'Health and Wellness',
  'Social Advocacy',
  'Volunteerism',
  'Research and Development',
  'Other',
]

export const VOLUNTEER_ACTIVITIES = [
  'Community Cleanups',
  'Tree Planting',
  'Coastal Cleanup',
  'Relief Operations',
  'Donation Drives',
  'Educational Outreach',
  'Youth Leadership Activities',
  'Barangay Events',
  'Health and Wellness Activities',
  'Environmental Campaigns',
  'Disaster Preparedness Activities',
  'Other',
]

export const VOLUNTEER_MOTIVATIONS = [
  'Desire to help other people',
  'Personal growth and development',
  'Leadership experience',
  'Learning new skills',
  'Meeting new people',
  'Contributing to community development',
  'Gaining volunteer experience',
  'Other',
]

export const VOLUNTEER_INTEREST = [
  ['yes', 'Yes'],
  ['maybe', 'Maybe'],
  ['not_now', 'Not at the moment'],
]

export const VOLUNTEER_FREQUENCY = [
  ['weekly', 'Weekly'],
  ['twice_month', 'Twice a month'],
  ['monthly', 'Monthly'],
  ['weekends', 'During weekends only'],
  ['breaks', 'During school or work breaks'],
  ['depends', 'Depending on my availability'],
]

export const AVAILABILITY_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

export const AVAILABILITY_TIME = [
  ['morning', 'Morning'],
  ['afternoon', 'Afternoon'],
  ['evening', 'Evening'],
  ['depends', 'Depends on the activity'],
]

export const COMMUNITY_ISSUES = [
  'Limited educational opportunities',
  'Unemployment and lack of livelihood opportunities',
  'Lack of youth activities',
  'Limited sports and recreational facilities',
  'Environmental problems',
  'Mental health and well-being concerns',
  'Bullying and discrimination',
  'Lack of leadership opportunities',
  'Limited access to technology',
  'Substance abuse prevention and awareness',
  'Disaster preparedness',
  'Poverty and economic difficulties',
  'Limited community participation',
  'Other',
]

export const KISLAP_PROGRAMS = [
  'KISLAP Youth Leadership Academy',
  'KISLAP Lingkod Barangay',
  'KISLAP Skills and Talent Development',
  'KISLAP Edukasyon at Pagbabahagi',
  'KISLAP Bayanihan Initiative',
  'KISLAP Youth Wellness and Sports',
  'KISLAP Youth Innovation and Livelihood',
  'KISLAP Environment and Sustainability',
  'KISLAP Youth Research and Development',
  'KISLAP Social Inclusion Initiative',
  'KISLAP Community Safety Program',
  'KISLAP Project Development',
  'KISLAP Information and Advocacy',
  'KISLAP Youth Coordination and Records',
]

export const CONTRIBUTION_AREAS = [...COMMITTEES]

export const KISLAP_FAMILIARITY = [
  ['yes', 'Yes'],
  ['no', 'No'],
  ['heard_little', 'I have heard about the organization but know little about it.'],
]

export const MEMBERSHIP_INTEREST = [
  ['apply', 'Yes, I would like to apply for membership.'],
  ['orientation', 'I would like to attend an orientation first.'],
  ['volunteer_only', 'I am interested in volunteering but not yet in membership.'],
  ['learn_more', 'I would like to learn more.'],
  ['not_now', 'Not at the moment.'],
]

export const WILLING_MEMBERSHIP_KEYS = ['apply', 'orientation']

export const YES_NO = [
  ['yes', 'Yes'],
  ['no', 'No'],
]

export const YES_NO_BOOL = [
  [true, 'Yes'],
  [false, 'No'],
]

export const YOUTH_STEPS = [
  { id: 'consent', title: 'Consent and eligibility', section: 'Section 1' },
  { id: 'personal', title: 'Personal information', section: 'Section 2' },
  { id: 'education', title: 'Educational background', section: 'Section 3' },
  { id: 'employment', title: 'Employment and economic', section: 'Section 4' },
  { id: 'skills', title: 'Skills and talents', section: 'Section 5' },
  { id: 'interests', title: 'Interests and hobbies', section: 'Section 6' },
  { id: 'volunteerism', title: 'Volunteerism', section: 'Section 7' },
  { id: 'community', title: 'Community concerns', section: 'Section 8' },
  { id: 'programs', title: 'KISLAP program interests', section: 'Section 9' },
  { id: 'membership', title: 'Membership interest', section: 'Section 10' },
  { id: 'suggestions', title: 'Suggestions and privacy', section: 'Section 11' },
  { id: 'review', title: 'Review and submit', section: 'Final step' },
]

export function newClientId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function emptyYouthProfile() {
  return {
    client_id: newClientId(),
    age_eligible: null,
    resides_mauban: null,
    consent_agreed: null,
    age_band: '',
    guardian_name: '',
    guardian_permission: null,
    youth_assent: null,
    first_name: '',
    middle_name: '',
    last_name: '',
    suffix: '',
    nickname: '',
    date_of_birth: '',
    sex: '',
    civil_status: '',
    pwd: '',
    pwd_details: '',
    barangay: '',
    registered_voter: '',
    voter_barangay: '',
    voter_barangay_other: '',
    is_household_head: '',
    household_relationship: '',
    household_relationship_other: '',
    address: '',
    current_address: '',
    permanent_address: '',
    same_as_current_address: false,
    contact_number: '',
    email: '',
    educational_status: '',
    school_name: '',
    course_strand: '',
    continue_education: '',
    employment_status: '',
    livelihood_interest: '',
    opportunities: [],
    skills: [],
    other_skills: '',
    skills_to_develop: [],
    interests: [],
    free_time: '',
    volunteered_before: '',
    volunteer_activities: [],
    volunteer_motivations: [],
    volunteer_interest: '',
    volunteer_frequency: '',
    availability_days: [],
    availability_time: '',
    community_issues: [],
    barangay_programs_needed: '',
    proposed_project: '',
    desired_changes: '',
    kislap_programs: [],
    contribution_areas: [],
    volunteer_encouragement: '',
    kislap_familiarity: '',
    membership_interest: '',
    contact_opt_in: '',
    preferred_contact_method: '',
    preferred_contact_details: '',
    communications_agreement: '',
    suggestions: '',
    additional_notes: '',
    status: 'submitted',
    collected_by: null,
    collection_barangay: '',
  }
}

export function fullName(row) {
  return [row.first_name, row.middle_name, row.last_name, row.suffix]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ')
}

export function labelOf(options, value) {
  const found = options.find((item) => (Array.isArray(item) ? item[0] === value : item === value))
  if (!found) return value || '—'
  return Array.isArray(found) ? found[1] : found
}

export function fromRow(row) {
  if (!row) return emptyYouthProfile()
  return {
    ...emptyYouthProfile(),
    ...row,
    client_id: row.client_id || newClientId(),
    date_of_birth: row.date_of_birth || '',
    opportunities: row.opportunities || [],
    skills: row.skills || [],
    skills_to_develop: row.skills_to_develop || [],
    interests: row.interests || [],
    volunteer_activities: row.volunteer_activities || [],
    volunteer_motivations: row.volunteer_motivations || [],
    availability_days: row.availability_days || [],
    community_issues: row.community_issues || [],
    kislap_programs: row.kislap_programs || [],
    contribution_areas: row.contribution_areas || [],
    age_eligible: row.age_eligible ?? null,
    resides_mauban: row.resides_mauban ?? null,
    consent_agreed: row.consent_agreed ?? null,
    guardian_permission: row.guardian_permission ?? null,
    youth_assent: row.youth_assent ?? null,
    current_address: row.current_address || row.address || '',
    permanent_address: row.permanent_address || '',
    same_as_current_address: Boolean(
      (row.current_address || row.address) &&
        row.permanent_address &&
        String(row.current_address || row.address).trim() === String(row.permanent_address).trim(),
    ),
  }
}

export function toPayload(form, { collectedBy = null } = {}) {
  const payload = {
    client_id: form.client_id,
    age_eligible: form.age_eligible,
    resides_mauban: form.resides_mauban,
    consent_agreed: form.consent_agreed,
    age_band: form.age_band || null,
    guardian_name: form.guardian_name || '',
    guardian_permission: form.guardian_permission,
    youth_assent: form.youth_assent,
    first_name: form.first_name.trim(),
    middle_name: form.middle_name.trim(),
    last_name: form.last_name.trim(),
    suffix: form.suffix.trim(),
    nickname: form.nickname.trim(),
    date_of_birth: form.date_of_birth || null,
    sex: form.sex || null,
    civil_status: form.civil_status || null,
    pwd: form.pwd || null,
    pwd_details: form.pwd_details.trim(),
    barangay: form.barangay,
    registered_voter: form.registered_voter || null,
    voter_barangay: form.voter_barangay || null,
    voter_barangay_other: form.voter_barangay_other || '',
    is_household_head: form.is_household_head || null,
    household_relationship: form.household_relationship || null,
    household_relationship_other: form.household_relationship_other || '',
    current_address: form.current_address.trim(),
    permanent_address: form.same_as_current_address
      ? form.current_address.trim()
      : form.permanent_address.trim(),
    address: form.current_address.trim(),
    contact_number: form.contact_number.trim(),
    email: form.email.trim(),
    educational_status: form.educational_status || null,
    school_name: form.school_name.trim(),
    course_strand: form.course_strand.trim(),
    continue_education: form.continue_education || null,
    employment_status: form.employment_status || null,
    livelihood_interest: form.livelihood_interest || null,
    opportunities: form.opportunities || [],
    skills: form.skills || [],
    other_skills: form.other_skills.trim(),
    skills_to_develop: form.skills_to_develop || [],
    interests: form.interests || [],
    free_time: form.free_time.trim(),
    volunteered_before: form.volunteered_before || null,
    volunteer_activities: form.volunteer_activities || [],
    volunteer_motivations: form.volunteer_motivations || [],
    volunteer_interest: form.volunteer_interest || null,
    volunteer_frequency: form.volunteer_frequency || null,
    availability_days: form.availability_days || [],
    availability_time: form.availability_time || null,
    community_issues: form.community_issues || [],
    barangay_programs_needed: form.barangay_programs_needed.trim(),
    proposed_project: form.proposed_project.trim(),
    desired_changes: form.desired_changes.trim(),
    kislap_programs: form.kislap_programs || [],
    contribution_areas: form.contribution_areas || [],
    volunteer_encouragement: form.volunteer_encouragement.trim(),
    kislap_familiarity: form.kislap_familiarity || null,
    membership_interest: form.membership_interest || null,
    contact_opt_in: form.contact_opt_in || null,
    preferred_contact_method: form.preferred_contact_method.trim(),
    preferred_contact_details: form.preferred_contact_details.trim(),
    communications_agreement: form.communications_agreement || null,
    suggestions: form.suggestions.trim(),
    additional_notes: form.additional_notes.trim(),
    status: form.status || 'submitted',
    collected_by: collectedBy,
    collection_barangay: form.collection_barangay || form.barangay || '',
  }
  return payload
}

function requireValue(value, label, missing) {
  if (value === null || value === undefined || value === '') missing.push(label)
}

export function validateStep(stepId, form) {
  const missing = []

  if (stepId === 'consent') {
    requireValue(form.age_eligible === true || form.age_eligible === false ? String(form.age_eligible) : '', 'Age eligibility', missing)
    if (form.age_eligible === false) missing.push('Only respondents aged 14-30 may continue')
    requireValue(form.resides_mauban === true || form.resides_mauban === false ? String(form.resides_mauban) : '', 'Mauban residency', missing)
    if (form.resides_mauban === false) missing.push('Only Mauban residents may continue')
    requireValue(form.consent_agreed === true || form.consent_agreed === false ? String(form.consent_agreed) : '', 'Participation agreement', missing)
    if (form.consent_agreed === false) missing.push('Consent is required to continue')
    requireValue(form.age_band, 'Age band', missing)
    if (needsGuardianAssent(form.age_band)) {
      requireValue(form.guardian_name?.trim(), 'Guardian name', missing)
      if (form.guardian_permission !== true) missing.push('Guardian permission')
      if (form.youth_assent !== true) missing.push('Youth assent')
    }
  }

  if (stepId === 'personal') {
    requireValue(form.first_name?.trim(), 'First name', missing)
    requireValue(form.last_name?.trim(), 'Last name', missing)
    requireValue(form.date_of_birth, 'Date of birth', missing)
    requireValue(form.sex, 'Sex', missing)
    requireValue(form.civil_status, 'Civil status', missing)
    requireValue(form.barangay, 'Barangay', missing)
    requireValue(form.registered_voter, 'Registered voter', missing)
    if (form.registered_voter === 'yes') {
      requireValue(form.voter_barangay, 'Voter registration barangay', missing)
      if (form.voter_barangay === 'Registered in another municipality/city') {
        requireValue(form.voter_barangay_other?.trim(), 'Other voter location', missing)
      }
    }
    requireValue(form.is_household_head, 'Household head', missing)
    if (form.is_household_head === 'no') {
      requireValue(form.household_relationship, 'Relationship to household head', missing)
      if (form.household_relationship === 'other') {
        requireValue(form.household_relationship_other?.trim(), 'Other relationship', missing)
      }
    }
  }

  if (stepId === 'education') {
    requireValue(form.educational_status, 'Educational status', missing)
    requireValue(form.continue_education, 'Interest in further education', missing)
  }

  if (stepId === 'employment') {
    requireValue(form.employment_status, 'Employment status', missing)
    requireValue(form.livelihood_interest, 'Livelihood interest', missing)
  }

  if (stepId === 'skills') {
    if (!(form.skills || []).length) missing.push('Skills or talents')
    if (!(form.skills_to_develop || []).length) missing.push('Skills to develop')
  }

  if (stepId === 'interests') {
    if (!(form.interests || []).length) missing.push('Interests')
  }

  if (stepId === 'volunteerism') {
    requireValue(form.volunteered_before, 'Prior volunteer experience', missing)
    if (form.volunteered_before === 'yes' && !(form.volunteer_activities || []).length) {
      missing.push('Volunteer activities')
    }
    if (!(form.volunteer_motivations || []).length) missing.push('Volunteer motivations')
    requireValue(form.volunteer_interest, 'Volunteer interest', missing)
    requireValue(form.volunteer_frequency, 'Volunteer frequency', missing)
    if (!(form.availability_days || []).length) missing.push('Available days')
    requireValue(form.availability_time, 'Available time', missing)
  }

  if (stepId === 'community') {
    const issues = form.community_issues || []
    if (!issues.length) missing.push('Community issues')
    if (issues.length > 5) missing.push('Select up to five community issues')
  }

  if (stepId === 'programs') {
    if (!(form.kislap_programs || []).length) missing.push('KISLAP programs')
    const areas = form.contribution_areas || []
    if (!areas.length) missing.push('Contribution areas')
    if (areas.length > 3) missing.push('Select up to three contribution areas')
  }

  if (stepId === 'membership') {
    requireValue(form.kislap_familiarity, 'Familiarity with KISLAP', missing)
    requireValue(form.membership_interest, 'Membership interest', missing)
    requireValue(form.contact_opt_in, 'Contact preference', missing)
    if (form.contact_opt_in === 'yes') {
      requireValue(form.preferred_contact_method?.trim(), 'Preferred contact method', missing)
      requireValue(form.preferred_contact_details?.trim(), 'Contact details', missing)
    }
  }

  if (stepId === 'suggestions') {
    requireValue(form.communications_agreement, 'Communications agreement', missing)
  }

  return missing
}

export function isWillingMember(row) {
  return WILLING_MEMBERSHIP_KEYS.includes(row?.membership_interest)
}

export function isPwdYouth(row) {
  return row?.pwd === 'yes'
}

export function membershipInterestLabel(value) {
  return labelOf(MEMBERSHIP_INTEREST, value)
}

export function countBy(rows, key) {
  const map = new Map()
  rows.forEach((row) => {
    const value = row[key] || 'Unspecified'
    map.set(value, (map.get(value) || 0) + 1)
  })
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

export function countArrayField(rows, key) {
  const map = new Map()
  rows.forEach((row) => {
    ;(row[key] || []).forEach((item) => {
      map.set(item, (map.get(item) || 0) + 1)
    })
  })
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

export function toCsv(rows, columns) {
  const escape = (value) => {
    const text = value == null ? '' : String(value)
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
    return text
  }
  const header = columns.map((col) => escape(col.label)).join(',')
  const body = rows
    .map((row) => columns.map((col) => escape(typeof col.value === 'function' ? col.value(row) : row[col.key])).join(','))
    .join('\n')
  return `${header}\n${body}`
}

export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Mauban barangay map points as [lng, lat].
 * Sourced from PhilAtlas barangay coordinates (PSA geography).
 */
export const MAUBAN_BARANGAY_COORDS = {
  'Abo-abo': [121.6813, 14.2083],
  Alitap: [121.7418, 14.1219],
  Baao: [121.7108, 14.1589],
  'Bagong Bayan': [121.7291, 14.1859],
  Balaybalay: [121.6914, 14.1335],
  Bato: [121.7083, 14.2],
  'Cagbalete I': [121.8239, 14.2582],
  'Cagbalete II': [121.817, 14.2995],
  'Cagsiay I': [121.7464, 14.2201],
  'Cagsiay II': [121.6964, 14.2536],
  'Cagsiay III': [121.6596, 14.3656],
  Concepcion: [121.6921, 14.1814],
  Daungan: [121.7333, 14.192],
  Liwayway: [121.6887, 14.1081],
  Lual: [121.7299, 14.191],
  'Lual Rural': [121.7153, 14.1883],
  Lucutan: [121.7079, 14.1505],
  'Luya-luya': [121.7364, 14.1543],
  Mabato: [121.7308, 14.192],
  Macasin: [121.725, 14.1401],
  Polo: [121.7192, 14.1782],
  'Remedios I': [121.6737, 14.1905],
  'Remedios II': [121.6631, 14.2029],
  Rizaliana: [121.73, 14.1884],
  Rosario: [121.7618, 14.0882],
  Sadsaran: [121.7314, 14.1858],
  'San Gabriel': [121.7326, 14.1286],
  'San Isidro': [121.7088, 14.1643],
  'San Jose': [121.7884, 14.0802],
  'San Lorenzo': [121.7397, 14.1959],
  'San Miguel': [121.6866, 14.1415],
  'San Rafael': [121.6802, 14.1482],
  'San Roque': [121.6961, 14.2238],
  'San Vicente': [121.6911, 14.1927],
  'Santa Lucia': [121.753, 14.1088],
  'Santo Angel': [121.703, 14.1545],
  'Santo Niño': [121.8145, 14.0784],
  Santol: [121.7058, 14.1806],
  Soledad: [121.7218, 14.2091],
  Tapucan: [121.7239, 14.162],
}
