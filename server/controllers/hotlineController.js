const axios = require('axios');
const { pool } = require('../database');

const SESSION_DURATION_MINUTES = 45; // Feature 4: 45-min call limit

const normalizePhone = (phone) => {
  if (!phone) return null;
  let p = phone.replace(/[\s\-().]/g, '');
  if (p.startsWith('233')) p = '0' + p.slice(3);
  return p;
};

const hubtelAuth = () =>
  Buffer.from(`${process.env.HUBTEL_CLIENT_ID}:${process.env.HUBTEL_CLIENT_SECRET}`).toString('base64');

const sayAndHangup = (text) => ({ Type: 'Say', Text: text, Voice: 'female', Action: 'Hangup' });
const forwardCall = (toPhone) => ({ Type: 'Bridge', PhoneNumber: toPhone, CallerId: process.env.HUBTEL_FROM, Action: 'Hangup' });

/**
 * POST /api/hotline/incoming
 * Feature 5: Double-check payment, active status, and expiry before forwarding.
 * Feature 6: Prevent counselor from receiving call if already busy.
 */
const handleIncomingCall = async (req, res) => {
  try {
    const rawCaller =
      req.body.CallerNumber || req.body.caller_number || req.body.From || req.query.CallerNumber || null;

    if (!rawCaller) {
      return res.json(sayAndHangup(
        'We could not identify your phone number. Please call back from your registered number.'
      ));
    }

    const callerPhone = normalizePhone(rawCaller);

    // Feature 5: Verify payment_status='paid', session active, and not expired
    const sessionRes = await pool.query(
      `SELECT s.id, s.counselor_phone, s.counselor_id, s.expires_at
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
        'Your session has expired. Please book another session on our website.'
      ));
    }

    const session = sessionRes.rows[0];

    // Feature 6: Ensure counselor is not already on another active call
    const counselorOnCall = await pool.query(
      `SELECT id FROM sessions
       WHERE counselor_id=$1 AND session_status='active' AND id != $2`,
      [session.counselor_id, session.id]
    );
    if (counselorOnCall.rows.length) {
      return res.json(sayAndHangup(
        'Your counselor is currently on another call. Please try again in a few minutes.'
      ));
    }

    // Verify counselor is still approved
    const counselorRes = await pool.query(
      `SELECT c.phone_number FROM counselors c WHERE c.id=$1 AND c.status='approved'`,
      [session.counselor_id]
    );

    let counselorPhone;
    if (!counselorRes.rows.length) {
      // Fallback to another available counselor
      const fallbackRes = await pool.query(
        `SELECT c.phone_number, c.id FROM counselors c
         WHERE c.status='approved' AND c.is_available=TRUE
           AND c.id NOT IN (
             SELECT counselor_id FROM sessions
             WHERE session_status='active' AND counselor_id IS NOT NULL
           )
         LIMIT 1`
      );
      if (!fallbackRes.rows.length) {
        return res.json(sayAndHangup('All counselors are currently busy. Please try again in a few minutes.'));
      }
      counselorPhone = fallbackRes.rows[0].phone_number;
      await pool.query(
        'UPDATE sessions SET counselor_id=$1, counselor_phone=$2 WHERE id=$3',
        [fallbackRes.rows[0].id, counselorPhone, session.id]
      );
    } else {
      counselorPhone = counselorRes.rows[0].phone_number;
    }

    // Feature 4: Mark call start time and set session active
    await pool.query(
      "UPDATE sessions SET session_status='active', call_started_at=NOW() WHERE id=$1",
      [session.id]
    );

    // Feature 1: Mark counselor as busy
    await pool.query('UPDATE counselors SET is_available=FALSE WHERE id=$1', [session.counselor_id]);

    // Feature 4: Schedule auto-hangup after 45 minutes via Hubtel
    scheduleCallTermination(session.id, session.counselor_id, SESSION_DURATION_MINUTES);

    return res.json(forwardCall(counselorPhone));
  } catch (err) {
    console.error('Hotline error:', err.message);
    return res.json(sayAndHangup('A system error occurred. Please try again shortly.'));
  }
};

/**
 * Feature 4: Auto-terminate call after SESSION_DURATION_MINUTES.
 * Fires a Hubtel hangup request and marks session completed.
 */
const scheduleCallTermination = (sessionId, counselorId, minutes) => {
  setTimeout(async () => {
    try {
      // Check if session is still active before terminating
      const check = await pool.query(
        "SELECT id FROM sessions WHERE id=$1 AND session_status='active'",
        [sessionId]
      );
      if (!check.rows.length) return; // Already ended naturally

      // Attempt to end the call via Hubtel
      if (process.env.HUBTEL_CLIENT_ID && process.env.HUBTEL_CLIENT_SECRET) {
        await axios.post(
          `https://voice.hubtel.com/v1/calls/${sessionId}/hangup`,
          {},
          { headers: { Authorization: `Basic ${hubtelAuth()}` } }
        ).catch(err => console.error('Hubtel hangup error:', err.message));
      }

      // Mark session completed and free counselor
      await pool.query("UPDATE sessions SET session_status='completed' WHERE id=$1", [sessionId]);
      await pool.query('UPDATE counselors SET is_available=TRUE WHERE id=$1', [counselorId]);

      console.log(`Session #${sessionId} auto-terminated after ${minutes} minutes.`);
    } catch (err) {
      console.error('Auto-terminate error:', err.message);
    }
  }, minutes * 60 * 1000);
};

/**
 * POST /api/hotline/call-ended
 * Hubtel webhook when call ends naturally — complete session and free counselor.
 */
const handleCallEnded = async (req, res) => {
  try {
    const rawCaller =
      req.body.CallerNumber || req.body.caller_number || req.body.From || null;

    if (!rawCaller) return res.sendStatus(200);

    const callerPhone = normalizePhone(rawCaller);

    const sessionRes = await pool.query(
      `SELECT s.id, s.counselor_id FROM sessions
       WHERE caller_phone=$1 AND session_status='active'
       ORDER BY created_at DESC LIMIT 1`,
      [callerPhone]
    );

    if (sessionRes.rows.length) {
      const { id, counselor_id } = sessionRes.rows[0];
      await pool.query("UPDATE sessions SET session_status='completed' WHERE id=$1", [id]);
      // Feature 1: Free counselor availability
      await pool.query('UPDATE counselors SET is_available=TRUE WHERE id=$1', [counselor_id]);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Call-ended webhook error:', err.message);
    res.sendStatus(200);
  }
};

const noCounselorAvailable = (req, res) => {
  res.json(sayAndHangup('All counselors are currently busy. Please try again in a few minutes or visit our website.'));
};

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
