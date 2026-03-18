const { pool } = require('../database');
const axios = require('axios');

const COUNSELOR_SHARE = 35;
const ADMIN_SHARE = 15;
const SESSION_PRICE = 50; // GHS
const SESSION_DURATION_MINUTES = 30;

const creditWallet = async (client, userId, amount, description) => {
  await client.query(
    `INSERT INTO wallets (user_id, balance) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + $2, updated_at = NOW()`,
    [userId, amount]
  );
  await client.query(
    'INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES ($1,$2,$3,$4)',
    [userId, amount, 'credit', description]
  );
};

const initiateBooking = async (req, res) => {
  const { counselor_id, caller_phone } = req.body;
  if (!counselor_id) return res.status(400).json({ error: 'counselor_id required' });
  if (!caller_phone) return res.status(400).json({ error: 'caller_phone required' });

  try {
    // Ensure no active paid session already exists for this user
    const existing = await pool.query(
      `SELECT id FROM sessions WHERE user_id=$1 AND payment_status='paid'
       AND session_status IN ('scheduled','active') AND expires_at > NOW()`,
      [req.user.id]
    );
    if (existing.rows.length)
      return res.status(409).json({ error: 'You already have an active session' });

    const counselor = await pool.query(
      "SELECT id, phone_number FROM counselors WHERE id=$1 AND status='approved'",
      [counselor_id]
    );
    if (!counselor.rows.length) return res.status(404).json({ error: 'Counselor not available' });

    const counselorPhone = counselor.rows[0].phone_number;

    // Create pending session with phone numbers stored
    const session = await pool.query(
      'INSERT INTO sessions (user_id, counselor_id, caller_phone, counselor_phone) VALUES ($1,$2,$3,$4) RETURNING id',
      [req.user.id, counselor_id, caller_phone, counselorPhone]
    );
    const sessionId = session.rows[0].id;

    const user = await pool.query('SELECT email, name FROM users WHERE id=$1', [req.user.id]);
    const { email, name } = user.rows[0];
    const reference = `CC-${sessionId}-${Date.now()}`;

    await pool.query(
      'INSERT INTO payments (user_id, session_id, amount, paystack_reference) VALUES ($1,$2,$3,$4)',
      [req.user.id, sessionId, SESSION_PRICE, reference]
    );

    const paystackRes = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: SESSION_PRICE * 100,
        reference,
        currency: 'GHS',
        metadata: { session_id: sessionId, user_name: name, caller_phone }
      },
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );

    res.json({
      session_id: sessionId,
      payment_url: paystackRes.data.data.authorization_url,
      reference
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Shared: activate session after confirmed payment
const activateSession = async (reference) => {
  const expires = new Date(Date.now() + SESSION_DURATION_MINUTES * 60 * 1000);
  await pool.query("UPDATE payments SET status='success' WHERE paystack_reference=$1", [reference]);
  await pool.query(
    `UPDATE sessions SET payment_status='paid', session_status='scheduled', expires_at=$1
     WHERE id=(SELECT session_id FROM payments WHERE paystack_reference=$2)`,
    [expires, reference]
  );
};

const verifyPayment = async (req, res) => {
  const { reference } = req.params;
  try {
    const paystackRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );
    const data = paystackRes.data.data;
    if (data.status === 'success') {
      await activateSession(reference);
      res.json({ message: 'Payment verified. Call the hotline to connect with your counselor.' });
    } else {
      await pool.query("UPDATE payments SET status='failed' WHERE paystack_reference=$1", [reference]);
      res.status(400).json({ error: 'Payment not successful' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const paystackWebhook = async (req, res) => {
  const crypto = require('crypto');
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');
  if (hash !== req.headers['x-paystack-signature']) return res.status(401).send('Invalid signature');

  const { event, data } = req.body;
  if (event === 'charge.success') {
    await activateSession(data.reference);
  }
  res.sendStatus(200);
};

const getUserSessions = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, u.name as counselor_name, c.category
       FROM sessions s
       JOIN counselors c ON s.counselor_id=c.id
       JOIN users u ON c.user_id=u.id
       WHERE s.user_id=$1 ORDER BY s.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const completeSession = async (req, res) => {
  const { session_id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify session belongs to this counselor and is paid
    const sessionRes = await client.query(
      `SELECT s.*, c.user_id as counselor_user_id FROM sessions s
       JOIN counselors c ON s.counselor_id = c.id
       WHERE s.id=$1 AND c.user_id=$2 AND s.payment_status='paid' AND s.session_status='scheduled'`,
      [session_id, req.user.id]
    );
    if (!sessionRes.rows.length)
      return res.status(404).json({ error: 'Session not found or not eligible for completion' });

    // Mark session completed
    await client.query("UPDATE sessions SET session_status='completed' WHERE id=$1", [session_id]);

    // Credit counselor wallet
    await creditWallet(client, req.user.id, COUNSELOR_SHARE, `Session #${session_id} completed`);

    // Create pending payout record for admin to pay out
    await client.query(
      'INSERT INTO counselor_payouts (counselor_id, amount) VALUES ((SELECT id FROM counselors WHERE user_id=$1), $2)',
      [req.user.id, COUNSELOR_SHARE]
    );

    // Credit admin wallet
    const adminRes = await client.query("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1");
    if (adminRes.rows.length) {
      await creditWallet(client, adminRes.rows[0].id, ADMIN_SHARE, `Platform fee – Session #${session_id}`);
    }

    await client.query('COMMIT');
    res.json({ message: 'Session completed. GH₵35 credited to your wallet.' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

const getWallet = async (req, res) => {
  try {
    const wallet = await pool.query(
      'SELECT balance FROM wallets WHERE user_id=$1', [req.user.id]
    );
    const txns = await pool.query(
      'SELECT * FROM wallet_transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20',
      [req.user.id]
    );
    res.json({ balance: wallet.rows[0]?.balance || 0, transactions: txns.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { initiateBooking, verifyPayment, paystackWebhook, getUserSessions, completeSession, getWallet };
