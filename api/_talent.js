const { authUserEmail, bearer, latestApplication, membershipStatus, rest, storageSign } = require('./_supabase');

// Work profile ("talent profile") rules shared by the talent routes.
const BUCKET = 'talent-photos';
const REQUIRED_SLOTS = ['headshot', 'full', 'third'];
const PHOTO_SLOTS = [...REQUIRED_SLOTS, 'extra1', 'extra2', 'extra3'];

const OPTIONS = {
  gender: ['Female', 'Male', 'Non-binary', 'Prefer not to say'],
  race: ['', 'Black African', 'Coloured', 'Indian/Asian', 'White', 'Other', 'Prefer not to say'],
  province: ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'],
  eye_colour: ['Brown', 'Dark brown', 'Hazel', 'Green', 'Blue', 'Grey', 'Other'],
  hair_colour: ['Black', 'Dark brown', 'Brown', 'Blonde', 'Red', 'Grey', 'Dyed / other'],
  tattoos: ['No', 'Yes, usually covered', 'Yes, visible'],
  piercings: ['No', 'Ears only', 'Yes, visible'],
  shirt_size: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
  experience: ['None yet', 'Under 1 year', '1–2 years', '3+ years'],
  licence: ['None', 'Learner\'s', 'Code A (motorbike)', 'Code B (car)', 'Code C/EB (heavy)'],
  own_transport: ['No', 'Yes'],
  travel: ['No', 'Within my city', 'Within my province', 'Anywhere in SA']
};
// Free-text fields and their maximum lengths
const TEXT = { full_name: 80, home_language: 80, city: 80, phone: 20, hair_style: 60, waist: 20, pants_size: 20, shoe_size: 10, availability: 120, skills: 200 };

// The signed-in, approved student making the request (or an error response).
async function currentStudent(req) {
  const email = await authUserEmail(bearer(req)).catch(() => '');
  if (!email) return { error: [401, 'Please sign in again.'] };
  const application = await latestApplication(email);
  const status = membershipStatus(application);
  if (status === 'expired') return { error: [403, 'Your StudentPerks membership has expired. Renew it to use jobs.'] };
  if (status !== 'approved') return { error: [403, 'Work profiles open once your student account is verified.'] };
  return { email };
}

async function loadProfile(email) {
  const rows = await rest(`student_profiles?student_email=eq.${encodeURIComponent(email)}&select=*&limit=1`);
  return rows && rows[0] || null;
}

function age(dob) {
  if (!dob) return null;
  const d = new Date(dob), now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a -= 1;
  return a;
}

// What's still missing before a student can apply for jobs.
function missing(profile) {
  const p = profile || {};
  const out = [];
  if (!p.full_name || !p.date_of_birth || !p.gender || !p.province || !p.city || !p.phone) out.push('About you');
  if (!p.height_cm || !p.eye_colour || !p.hair_colour) out.push('Appearance');
  if (!p.shirt_size || !p.waist || !p.pants_size || !p.shoe_size) out.push('Sizes');
  if (!p.experience || !p.availability) out.push('Skills');
  const photos = Array.isArray(p.photos) ? p.photos : [];
  if (REQUIRED_SLOTS.some(slot => !photos.find(ph => ph.slot === slot && ph.status !== 'rejected'))) out.push('3 photos');
  if (!p.adult_confirmed) out.push('Confirmation');
  return out;
}

// The profile as the student sees it, with temporary photo links.
async function forStudent(profile) {
  if (!profile) return null;
  const photos = Array.isArray(profile.photos) ? profile.photos : [];
  const signed = await storageSign(BUCKET, photos.map(p => p.path));
  return {
    ...profile,
    age: age(profile.date_of_birth),
    photos: photos.map(p => ({ slot: p.slot, status: p.status, url: signed[p.path] || '' })),
    missing: missing(profile)
  };
}

module.exports = { BUCKET, OPTIONS, PHOTO_SLOTS, REQUIRED_SLOTS, TEXT, age, currentStudent, forStudent, loadProfile, missing };
