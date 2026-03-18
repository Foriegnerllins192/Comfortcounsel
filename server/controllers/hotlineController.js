const axios = require('axios');
const { pool } = require('../database');

// Normalize phone: strip spaces/dashes, ensure leading +233 or 0
const normalizePhone = (phone) => {
  if (!phone) return null;
  let p = phone.replace(/[\s\-().]/g, '');
  // Hubtel may send numbers as 233XXXXXXXXX — normalize to 0XXXXXXXXX for DB lookup
  if (p.startsWith('233')) p = '0' + p.slice(3);
  return p;
};

const hubtelAuth = () =>
  Buffer.from(`${process.env.HUBTEL_CLIENT_ID}:${process.env.HUBTEL_CLIENT_SECRET}`).toString('base64');

// Hubtel VXML-style response helpers
const sayAndHangup = (text) => ({
  Type: 'Say',
  Text: text,
  Voice: 'female',
  Action: 'Hangup'
});

const forwardCall = (toPhone) => ({
  Type: 'Bridge',
  PhoneNumber: toPhone,
  CallerId: process.env.HUBTEL_FROM,
  Action: 'Hangup'
});

/**
 * POST /api/hotline/incoming
 * Hubtel sends incoming call data here.
 * We check for a valid paid session and route accordingly.
 */
const handleIncomingCall = async (req, res) => {
  try {
    // Hubtel sends caller number in various fields depending on API version
    const rawCaller =
      req.body.CallerNumber ||
      req.body.caller_number ||
      req.body.From ||
      req.query.CallerNumber ||
      null;

    if (!rawCaller) {
      return res.json(sayAndHangup(
        'We could not identify your phone number. Please call back from your registered number.'
      ));
    }

    const callerPhone = normalizePhone(rawCaller);

    // Look up a valid paid, non-expired session for this caller
    const sessionRes = await pool.query(
      `SELECT s.id, s.counselor_phone, s.counselor_id
       FROM sessions s
       WHERE s.caller_phone = $1
         AND s.payment_status = 'paid'
         AND s.session_status IN ('scheduled', 'active')
         AND s.expires_at > NOW()
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [callerPhone]
    );

    if (!sessionRes.rows.length) {
      return res.json(sayAndHangup(
        'You do not have an active paid session. Please visit our website to book and pay for a session before calling.'
      ));
    }

    const session = sessionRes.rows[0];
    let counselorPhone = session.counselor_phone;

    // Mark session as active (call in progress)
    await pool.query(
      "UPDATE sessions SET session_status='active' WHERE id=$1",
      [session.id]
    );

    // Verify counselor phone is still valid (counselor still approved)
    const counselorRes = await pool.query(
      `SELECT c.phone_number FROM counselors c
       WHERE c.id=$1 AND c.status='approved'`,
      [session.counselor_id]
    );

    if (!counselorRes.rows.length) {
      // Assigned counselor no longer available — try to find another
      const fallbackRes = await pool.query(
        `SELECT c.phone_number, c.id FROM counselors c
         WHERE c.status='approved'
           AND c.id NOT IN (
             SELECT counselor_id FROM sessions
             WHERE session_status='active' AND counselor_id IS NOT NULL
           )
         LIMIT 1`
      );

      if (!fallbackRes.rows.length) {
        return res.json(sayAndHangup(
          'All counselors are currently busy. Please try again in a few minutes.'
        ));
      }

      // Reassign to fallback counselor
      counselorPhone = fallbackRes.rows[0].phone_number;
      await pool.query(
        'UPDATE sessions SET counselor_id=$1, counselor_phone=$2 WHERE id=$3',
        [fallbackRes.rows[0].id, counselorPhone, session.id]
      );
    } else {
      counselorPhone = counselorRes.rows[0].phone_number;
    }

    // Forward the call — counselor's real number is never exposed to the caller
    return res.json(forwardCall(counselorPhone));

  } catch (err) {
    console.error('Hotline error:', err.message);
    return res.json(sayAndHangup(
      'A system error occurred. Please try again shortly.'
    ));
  }
};

/**
 * POST /api/hotline/call-ended
 * Hubtel webhook when a call ends — mark session completed and trigger payout flow.
 */
const handleCallEnded = async (req, res) => {
  try {
    const rawCaller =
      req.body.CallerNumber || req.body.caller_number || req.body.From || null;

    if (!rawCaller) return res.sendStatus(200);

    const callerPhone = normalizePhone(rawCaller);

    // Find the active session for this caller
    const sessionRes = await pool.query(
      `SELECT id FROM sessions
       WHERE caller_phone=$1 AND session_status='active'
       ORDER BY created_at DESC LIMIT 1`,
      [callerPhone]
    );

    if (sessionRes.rows.length) {
      await pool.query(
        "UPDATE sessions SET session_status='completed' WHERE id=$1",
        [sessionRes.rows[0].id]
      );
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Call-ended webhook error:', err.message);
    res.sendStatus(200);
  }
};

/**
 * GET /api/hotline/no-counselor
 * Fallback voice response.
 */
const noCounselorAvailable = (req, res) => {
  res.json(sayAndHangup(
    'All counselors are currently busy. Please try again in a few minutes or visit our website.'
  ));
};

/**
 * POST /api/hotline/call  (authenticated)
 * Manually initiate an outbound call via Hubtel (admin/counselor use).
 */
const makeCall = async (req, res) => {
  const { to, counselor_id } = req.body;
  try {
    const counselor = await pool.query(
      "SELECT phone_number FROM counselors WHERE id=$1 AND status='approved'",
      [counselor_id]
    );
    if (!counselor.rows.length) return res.status(404).json({ error: 'Counselor not found' });

    await axios.post(
      'https://voice.hubtel.com/v1/calls',
      {
        From: process.env.HUBTEL_FROM,
        To: to,
        CallbackUrl: `${process.env.APP_URL}/api/hotline/incoming`
      },
      { headers: { Authorization: `Basic ${hubtelAuth()}` } }
    );

    res.json({ message: 'Call initiated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { handleIncomingCall, handleCallEnded, noCounselorAvailable, makeCall };
