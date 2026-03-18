const { pool } = require('../database');

const getPendingCounselors = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, u.name, u.email FROM counselors c
       JOIN users u ON c.user_id=u.id WHERE c.status='pending' ORDER BY c.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const approveCounselor = async (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'approve' or 'reject'
  const status = action === 'approve' ? 'approved' : 'rejected';
  try {
    await pool.query('UPDATE counselors SET status=$1 WHERE id=$2', [status, id]);
    res.json({ message: `Counselor ${status}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getUsers = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getSessions = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, u.name as user_name, cu.name as counselor_name, c.category
       FROM sessions s
       JOIN users u ON s.user_id=u.id
       JOIN counselors c ON s.counselor_id=c.id
       JOIN users cu ON c.user_id=cu.id
       ORDER BY s.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getPayments = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, u.name as user_name, u.email
       FROM payments p JOIN users u ON p.user_id=u.id
       ORDER BY p.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getPendingCounselors, approveCounselor, getUsers, getSessions, getPayments };
