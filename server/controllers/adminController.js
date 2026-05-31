const { pool } = require('../database');
const bcrypt = require('bcryptjs');
const { sendApprovalEmail, sendRejectionEmail, sendRevocationEmail } = require('../services/emailService');

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

const getAllCounselors = async (req, res) => {
  const { status } = req.query; // pending | approved | rejected (optional)
  try {
    const params = [];
    let where = '';
    if (status) { where = 'WHERE c.status=$1'; params.push(status); }
    const result = await pool.query(
      `SELECT c.*, u.name, u.email FROM counselors c
       JOIN users u ON c.user_id=u.id
       ${where} ORDER BY c.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const approveCounselor = async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;
  const status = action === 'approve' ? 'approved' : 'rejected';
  try {
    await pool.query('UPDATE counselors SET status=$1 WHERE id=$2', [status, id]);

    // Fetch counselor name + email for notification
    const result = await pool.query(
      `SELECT u.name, u.email FROM counselors c
       JOIN users u ON c.user_id = u.id WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length) {
      const { name, email } = result.rows[0];
      // Fire-and-forget — email failure must not block the response
      if (status === 'approved') {
        sendApprovalEmail(name, email).catch(err =>
          console.error(`Approval email failed for ${email}:`, err.message)
        );
      } else {
        sendRejectionEmail(name, email).catch(err =>
          console.error(`Rejection email failed for ${email}:`, err.message)
        );
      }
    }

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

const getStats = async (req, res) => {
  try {
    // Total users count
    const usersRes = await pool.query('SELECT COUNT(*) as count FROM users');
    const totalUsers = parseInt(usersRes.rows[0].count);

    // Total sessions count
    const sessionsRes = await pool.query('SELECT COUNT(*) as count FROM sessions');
    const totalSessions = parseInt(sessionsRes.rows[0].count);

    // Total revenue (sum of successful payments)
    const revenueRes = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status='success'"
    );
    const totalRevenue = parseFloat(revenueRes.rows[0].total);

    // Paid sessions count
    const paidSessionsRes = await pool.query(
      "SELECT COUNT(*) as count FROM sessions WHERE payment_status='paid'"
    );
    const paidSessions = parseInt(paidSessionsRes.rows[0].count);

    res.json({
      total_users: totalUsers,
      total_sessions: totalSessions,
      total_revenue: totalRevenue,
      paid_sessions: paidSessions
    });
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

const getAdmins = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, created_at FROM users WHERE role='admin' ORDER BY created_at"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const addAdmin = async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'name, email and password required' });
  try {
    const exists = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email already registered' });
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,'admin')",
      [name, email, hashed]
    );
    res.status(201).json({ message: 'Admin created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const removeAdmin = async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.id)
    return res.status(400).json({ error: 'Cannot remove yourself' });
  try {
    await pool.query("UPDATE users SET role='user' WHERE id=$1 AND role='admin'", [id]);
    res.json({ message: 'Admin removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getAdminWallet = async (req, res) => {
  try {
    const wallet = await pool.query('SELECT balance FROM wallets WHERE user_id=$1', [req.user.id]);
    const txns = await pool.query(
      'SELECT * FROM wallet_transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30',
      [req.user.id]
    );
    res.json({ balance: wallet.rows[0]?.balance || 0, transactions: txns.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getPayoutOverview = async (req, res) => {
  try {
    // Total collected (GH₵50 per paid session)
    const revenueRes = await pool.query(
      "SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE status='success'"
    );
    // Total platform cut (GH₵15 per completed session)
    const platformRes = await pool.query(
      "SELECT COALESCE(SUM(amount),0) as total FROM wallet_transactions WHERE user_id=(SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1) AND type='credit'"
    );
    // Pending payouts to counselors
    const pendingRes = await pool.query(
      `SELECT cp.id, cp.amount, cp.status, cp.created_at, cp.paid_at, cp.note,
              u.name as counselor_name, u.email as counselor_email, c.phone_number
       FROM counselor_payouts cp
       JOIN counselors c ON cp.counselor_id = c.id
       JOIN users u ON c.user_id = u.id
       WHERE cp.status = 'pending'
       ORDER BY cp.created_at DESC`
    );
    // Paid out history
    const paidRes = await pool.query(
      `SELECT cp.id, cp.amount, cp.status, cp.created_at, cp.paid_at, cp.note,
              u.name as counselor_name, u.email as counselor_email
       FROM counselor_payouts cp
       JOIN counselors c ON cp.counselor_id = c.id
       JOIN users u ON c.user_id = u.id
       WHERE cp.status = 'paid'
       ORDER BY cp.paid_at DESC LIMIT 50`
    );

    res.json({
      total_collected: parseFloat(revenueRes.rows[0].total),
      platform_cut: parseFloat(platformRes.rows[0].total),
      counselor_share: parseFloat(revenueRes.rows[0].total) - parseFloat(platformRes.rows[0].total),
      pending_payouts: pendingRes.rows,
      paid_history: paidRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const payCounselor = async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;
  try {
    const result = await pool.query(
      "UPDATE counselor_payouts SET status='paid', paid_at=NOW(), note=$1 WHERE id=$2 AND status='pending' RETURNING *",
      [note || 'Paid by admin', id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Payout not found or already paid' });
    res.json({ message: 'Payout marked as paid', payout: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const revokeCounselor = async (req, res) => {
  const { id } = req.params;
  try {
    // Update counselor status to rejected (revoked)
    await pool.query('UPDATE counselors SET status=$1 WHERE id=$2', ['rejected', id]);

    // Fetch counselor name + email for notification
    const result = await pool.query(
      `SELECT u.name, u.email FROM counselors c
       JOIN users u ON c.user_id = u.id WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length) {
      const { name, email } = result.rows[0];
      // Send revocation email (fire-and-forget)
      sendRevocationEmail(name, email).catch(err =>
        console.error(`Revocation email failed for ${email}:`, err.message)
      );
    }

    res.json({ message: 'Counselor approval revoked and notification sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getPendingCounselors, getAllCounselors, approveCounselor, revokeCounselor, getUsers, getStats, getSessions, getPayments,
  getAdmins, addAdmin, removeAdmin, getAdminWallet, getPayoutOverview, payCounselor
};
