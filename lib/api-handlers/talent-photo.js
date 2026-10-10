const crypto = require('crypto');
const { json, readBody, requireServiceKey, rest, storageRemove, storageUpload } = require('../../api/_supabase');
const { BUCKET, PHOTO_SLOTS, currentStudent, forStudent, loadProfile } = require('../../api/_talent');

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 3 * 1024 * 1024;

// Upload or remove one work-profile photo. The browser shrinks photos
// before sending, so they arrive as a small data URL.
//   POST   { slot, image: 'data:image/jpeg;base64,...' } -> { profile }
//   DELETE { slot }                                        -> { profile }
module.exports = async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'POST, DELETE');
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (!requireServiceKey(res)) return;
  const student = await currentStudent(req);
  if (student.error) return json(res, student.error[0], { error: student.error[1] });

  try {
    const body = await readBody(req);
    const slot = String(body.slot || '');
    if (!PHOTO_SLOTS.includes(slot)) return json(res, 400, { error: 'Unknown photo slot.' });

    let profile = await loadProfile(student.email);
    if (!profile) {
      const created = await rest('student_profiles?select=*', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ student_email: student.email }) });
      profile = created && created[0];
    }
    const photos = (Array.isArray(profile.photos) ? profile.photos : []).filter(p => p.slot !== slot);
    const old = (profile.photos || []).find(p => p.slot === slot);

    if (req.method === 'POST') {
      const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image || ''));
      if (!match) return json(res, 400, { error: 'Please upload a JPG, PNG or WebP photo.' });
      const buffer = Buffer.from(match[2], 'base64');
      if (buffer.length > MAX_BYTES) return json(res, 400, { error: 'That photo is too large. Please choose a smaller one.' });
      const owner = crypto.createHash('sha256').update(student.email).digest('hex').slice(0, 24);
      const path = `${owner}/${slot}-${crypto.randomBytes(6).toString('hex')}.${TYPES[match[1]]}`;
      await storageUpload(BUCKET, path, buffer, match[1]);
      photos.push({ slot, path, status: 'pending', uploaded_at: new Date().toISOString() });
    }
    if (old) await storageRemove(BUCKET, [old.path]);

    const saved = await rest(`student_profiles?id=eq.${profile.id}&select=*`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ photos, updated_at: new Date().toISOString() })
    });
    return json(res, 200, { profile: await forStudent(saved && saved[0]) });
  } catch (error) {
    console.error('talent-photo', error);
    return json(res, 500, { error: 'Could not save that photo. Please try again.' });
  }
};
