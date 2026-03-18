const { pool } = require('../database');
const axios = require('axios');

const SESSION_PRICE = 50; // GHS

const initiateBooking = async (req, res) => {
  const { counselor_id } = req.body;
  if (!counselor_id) return res.status(400).json({ error: 'counselor_id required' });

  try {
    const counselor = await pool.query(
      "SELECT id FROM counselors WHERE id=$1 AND status='approved'", [counselor_id]
    );
    if (!counselor.rows.length) return res.status(404).json({ error: 'Counselor not available' });

    // Create pending session
    const session = await pool.query(
      'INSERT INTO sessions (user_id, counselor_id) VALUES ($1,$2) RETURNING id',
      [req.user.id, counselor_id]
    );
    const sessionId = session.rows[0].id;

    // Get user email for Paystack
    const user = await pool.query('SELECT email, name FROM users WHERE id=$1', [req.user.id]);
    const { email, name } = user.rows[0];

    const reference = `CC-${sessionId}-${Date.now()}`;

    // Create pending payment record
    await pool.query(
      'INSERT INTO payments (user_id, session_id, amount, paystack_reference) VALUES ($1,$2,$3,$4)',
      [req.user.id, sessionId, SESSION_PRICE, reference]
    );

    // Initialize Paystack transaction
    const paystackRes = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: SESSION_PRICE * 100, // kobo
        reference,
        currency: 'GHS',
        metadata: { session_id: sessionId, user_name: name }
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

const verifyPayment = async (req, res) => {
  const { reference } = req.params;
  try {
    const paystackRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );

    const data = paystackRes.data.data;
    if (data.status === 'success') {
      await pool.query("UPDATE payments SET status='success' WHERE paystack_reference=$1", [reference]);
      await pool.query(
        "UPDATE sessions SET payment_status='paid' WHERE id=(SELECT session_id FROM payments WHERE paystack_reference=$1)",
        [reference]
      );
      res.json({ message: 'Payment verified. Session confirmed.' });
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

  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(401).send('Invalid signature');
  }

  const { event, data } = req.body;
  if (event === 'charge.success') {
    const ref = data.reference;
    await pool.query("UPDATE payments SET status='success' WHERE paystack_reference=$1", [ref]);
    await pool.query(
      "UPDATE sessions SET payment_status='paid' WHERE id=(SELECT session_id FROM payments WHERE paystack_reference=$1)",
      [ref]
    );
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

module.exports = { initiateBooking, verifyPayment, paystackWebhook, getUserSessions };
