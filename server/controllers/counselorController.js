const { pool } = require('../database');

const registerCounselor = async (req, res) => {
  const { name, email, password, phone_number, location, category, years_experience, bio } = req.body;
  if (!name || !email || !password || !phone_number || !category)
    return res.status(400).json({ error: 'Required fields missing' });

  const bcrypt = require('bcryptjs');
  const jwt = require('jsonwebtoken');

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

    res.status(201).json({ message: 'Registration submitted. Awaiting admin approval.', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getCounselors = async (req, res) => {
  try {
    const { category } = req.query;
    let query = `
      SELECT c.id, u.name, c.category, c.bio, c.location, c.years_experience, c.profile_picture, c.status
      FROM counselors c JOIN users u ON c.user_id = u.id
      WHERE c.status = 'approved'
    `;
    const params = [];
    if (category) { query += ' AND c.category = $1'; params.push(category); }
    query += ' ORDER BY c.id DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
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
  const { bio, location, years_experience } = req.body;
  try {
    await pool.query(
      'UPDATE counselors SET bio=$1, location=$2, years_experience=$3 WHERE user_id=$4',
      [bio, location, years_experience, req.user.id]
    );
    res.json({ message: 'Profile updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { registerCounselor, getCounselors, getCounselorById, getDashboard, updateProfile };
