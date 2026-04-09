const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../database');
const { sendPasswordResetEmail } = require('../services/emailService');

// Generate secure random reset token
const generateResetToken = () => crypto.randomBytes(32).toString('hex');

const register = async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'All fields are required' });

  try {
    const exists = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1,$2,$3) RETURNING id, name, email, role',
      [name, email, hashed]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id=$1', [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password)
    return res.status(400).json({ error: 'Both fields required' });
  try {
    const result = await pool.query('SELECT password FROM users WHERE id=$1', [req.user.id]);
    const valid = await bcrypt.compare(current_password, result.rows[0].password);
    if (!valid) return res.status(401).json({ error: 'Current password incorrect' });
    const hashed = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password=$1 WHERE id=$2', [hashed, req.user.id]);
    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const userRes = await pool.query('SELECT id, name FROM users WHERE email=$1', [email]);
    if (!userRes.rows.length) {
      // Don't reveal if email exists (security best practice)
      return res.json({ message: 'If email exists, a reset link has been sent' });
    }

    const user = userRes.rows[0];
    const resetToken = generateResetToken();
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Save reset token to database
    await pool.query(
      'INSERT INTO password_resets (user_id, reset_token, reset_token_expiry) VALUES ($1, $2, $3)',
      [user.id, resetToken, resetTokenExpiry]
    );

    // Create reset link
    const resetLink = `http://localhost:3000/reset.html?token=${resetToken}`;

    // Send email with reset link
    await sendPasswordResetEmail(email, user.name, resetLink).catch(err =>
      console.error('[EMAIL ERROR]', err.message)
    );

    console.log('[FORGOT_PASSWORD] Reset token generated for:', email);
    res.json({ message: 'If email exists, a reset link has been sent' });
  } catch (err) {
    console.error('[FORGOT_PASSWORD ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
};

const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  // Validate required fields
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    console.log('[RESET_PASSWORD] Attempting reset with token:', token.substring(0, 10) + '...');

    // Find valid reset token (not expired)
    const resetRes = await pool.query(
      `SELECT user_id FROM password_resets 
       WHERE reset_token=$1 AND reset_token_expiry > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [token]
    );

    if (!resetRes.rows.length) {
      console.log('[RESET_PASSWORD] Invalid or expired token');
      return res.status(400).json({ error: 'Invalid or expired reset code' });
    }

    const userId = resetRes.rows[0].user_id;

    // Hash new password
    const hashed = await bcrypt.hash(newPassword, 10);

    // Update user password
    await pool.query('UPDATE users SET password=$1 WHERE id=$2', [hashed, userId]);

    // Delete the used reset token
    await pool.query('DELETE FROM password_resets WHERE reset_token=$1', [token]);

    console.log('[PASSWORD RESET SUCCESS] Password reset for user:', userId);
    res.json({ message: 'Password updated successfully. You can now login with your new password.' });
  } catch (err) {
    console.error('[RESET_PASSWORD ERROR]', err.message);
    res.status(500).json({ error: 'An error occurred while resetting your password. Please try again.' });
  }
};

module.exports = { register, login, getProfile, changePassword, forgotPassword, resetPassword };
