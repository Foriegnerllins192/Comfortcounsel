const { pool } = require('../database');

const registerCounselor = async (req, res) => {
  const { name, email, password, phone_number, location, category, years_experience, bio } = req.body;
  if (!name || !email || !password || !phone_number || !category)
    return res.status(400).json({ error: 'Required fields missing' });

  const bcrypt = require('bcryptjs');
  const jwt = require('jsonwebtoken');
  const { sendPendingApprovalEmail } = require('../services/emailService');

  try {
    const exists = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const userResult = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role',
      [name, email, hashed, 'counselor']
    );
    const user = userResult.rows[0];

    await pool.query(
      'INSERT INTO counselors (user_id, category, bio, phone_number, location, years_experience) VALUES ($1,$2,$3,$4,$5,$6)',
      [user.id, category, bio || '', phone_number, location || '', years_experience || 0]
    );

    // Send pending approval email
    console.log('[COUNSELOR_REGISTRATION] Sending pending approval email to:', email);
    await sendPendingApprovalEmail(name, email)
      .then(() => console.log('[COUNSELOR_REGISTRATION] Email sent successfully to:', email))
      .catch(err => console.error('[COUNSELOR_REGISTRATION] Email failed:', err.message));

    res.status(201).json({ message: 'Registration submitted. Awaiting admin approval.', user });
  } catch (err) {
    console.error('[COUNSELOR_REGISTRATION] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

const getCounselors = async (req, res) => {
  try {
    const { category } = req.query;
    let query = `
      SELECT c.id, u.name, c.category, c.bio, c.location, c.years_experience,
             c.profile_picture, c.status, c.is_available,
             EXISTS (
               SELECT 1 FROM sessions s
               WHERE s.counselor_id = c.id
                 AND s.session_status IN ('scheduled','active')
                 AND s.payment_status = 'paid'
                 AND s.expires_at > NOW()
             ) AS has_active_session
      FROM counselors c JOIN users u ON c.user_id = u.id
      WHERE c.status = 'approved'
    `;
    const params = [];
    if (category) { query += ' AND c.category = $1'; params.push(category); }
    query += ' ORDER BY c.id DESC';

    const result = await pool.query(query, params);
    
    // Map the results to show is_available as false if they have active session OR manually set unavailable
    const counselors = result.rows.map(c => ({
      id: c.id,
      name: c.name,
      category: c.category,
      bio: c.bio,
      location: c.location,
      years_experience: c.years_experience,
      profile_picture: c.profile_picture,
      status: c.status,
      is_available: c.is_available && !c.has_active_session
    }));
    
    res.json(counselors);
  } catch (err) {
    console.error('getCounselors error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

const getCounselorById = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, u.name, c.category, c.bio, c.location, c.years_experience, c.profile_picture, c.phone_number
       FROM counselors c JOIN users u ON c.user_id = u.id
       WHERE c.id = $1 AND c.status = 'approved'`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Counselor not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getDashboard = async (req, res) => {
  try {
    const counselor = await pool.query(
      'SELECT c.*, u.name, u.email FROM counselors c JOIN users u ON c.user_id=u.id WHERE c.user_id=$1',
      [req.user.id]
    );
    if (!counselor.rows.length) return res.status(404).json({ error: 'Counselor profile not found' });

    const c = counselor.rows[0];
    const sessions = await pool.query(
      `SELECT s.*, u.name as user_name FROM sessions s
       JOIN users u ON s.user_id=u.id WHERE s.counselor_id=$1 ORDER BY s.created_at DESC`,
      [c.id]
    );
    const earnings = await pool.query(
      `SELECT COALESCE(SUM(p.amount),0) as total FROM payments p
       JOIN sessions s ON p.session_id=s.id WHERE s.counselor_id=$1 AND p.status='success'`,
      [c.id]
    );

    res.json({
      profile: c,
      sessions: sessions.rows,
      total_sessions: sessions.rows.length,
      earnings: earnings.rows[0].total
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateProfile = async (req, res) => {
  const { bio, location, years_experience, phone_number, name } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE counselors SET bio=$1, location=$2, years_experience=$3, phone_number=$4 WHERE user_id=$5',
      [bio, location, years_experience, phone_number, req.user.id]
    );
    if (name) {
      await client.query('UPDATE users SET name=$1 WHERE id=$2', [name, req.user.id]);
    }
    await client.query('COMMIT');
    res.json({ message: 'Profile updated' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

const uploadProfilePicture = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file provided' });

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(req.file.mimetype))
    return res.status(400).json({ error: 'Only JPEG, PNG, WebP or GIF images are allowed' });

  if (req.file.size > 2 * 1024 * 1024)
    return res.status(400).json({ error: 'Image must be under 2MB' });

  const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

  try {
    await pool.query(
      'UPDATE counselors SET profile_picture=$1 WHERE user_id=$2',
      [dataUrl, req.user.id]
    );
    res.json({ message: 'Profile picture updated', profile_picture: dataUrl });
  } catch (err) {
    console.error('uploadProfilePicture error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

const updateAvailability = async (req, res) => {
  const { is_available } = req.body;
  if (typeof is_available !== 'boolean') {
    return res.status(400).json({ error: 'is_available must be a boolean' });
  }

  try {
    await pool.query(
      'UPDATE counselors SET is_available=$1 WHERE user_id=$2',
      [is_available, req.user.id]
    );
    res.json({ message: `Availability updated to ${is_available ? 'Available' : 'Unavailable'}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { registerCounselor, getCounselors, getCounselorById, getDashboard, updateProfile, uploadProfilePicture, updateAvailability };
