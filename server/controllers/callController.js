const { pool } = require('../database');
const axios = require('axios');

const SESSION_DURATION_MINUTES = 45;
const HUBTEL_VOICE_API = process.env.HUBTEL_VOICE_API || 'https://api.hubtel.com/v1/calls';
const HOTLINE = process.env.HOTLINE_NUMBER || '0203045678';

/**
 * GET /api/counselor/:id/status
 * Check if a counselor is available (for frontend warning).
 */
const getCounselorStatus = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT c.is_available, c.status FROM counselors c WHERE c.id=$1`,
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Counselor not found' });

    const { is_available, status } = result.rows[0];
    res.json({
      available: is_available && status === 'approved',
      is_available,
      status
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/start-session-call
 * Counselor initiates the call (callback system).
 * Steps:
 * 1. Validate session exists and is in "pending" state
 * 2. Mark session as "active" and set start time
 * 3. Mark counselor as busy
 * 4. Call Hubtel API to bridge the call
 * 5. Schedule auto-end after 45 minutes
 */
const startSessionCall = async (req, res) => {
  const { session_id } = req.body;
  if (!session_id) return res.status(400).json({ error: 'session_id required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Validate session
    const sessionRes = await client.query(
      `SELECT s.*, c.id as c_id
       FROM sessions s
       JOIN counselors c ON s.counselor_id = c.id
       WHERE s.id=$1 AND c.user_id=$2 AND s.payment_status='paid' AND s.session_status='scheduled'`,
      [session_id, req.user.id]
    );

    if (!sessionRes.rows.length)
      return res.status(404).json({ error: 'Session not found or not eligible for call' });

    const session = sessionRes.rows[0];

    // Mark session as active
    await client.query(
      "UPDATE sessions SET session_status='active', call_started_at=NOW() WHERE id=$1",
      [session_id]
    );

    // Mark counselor as busy
    await client.query('UPDATE counselors SET is_available=FALSE WHERE id=$1', [session.c_id]);

    await client.query('COMMIT');

    // Log the call initiation
    console.log(`[CALL] Session #${session_id} started. Counselor: ${session.counselor_phone}, User: ${session.caller_phone}`);

    // Fire-and-forget: Trigger Hubtel API (placeholder)
    triggerHubtelCall(session_id, session.counselor_phone, session.caller_phone).catch(err =>
      console.error(`[HUBTEL ERROR] Session #${session_id}:`, err.message)
    );

    // Schedule auto-end after 45 minutes
    scheduleCallEnd(session_id, session.c_id, SESSION_DURATION_MINUTES);

    res.json({
      success: true,
      message: 'Call initiated. Connecting counselor and client...',
      session_id,
      hotline: HOTLINE
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[START_CALL ERROR]', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

/**
 * Trigger Hubtel Voice API to bridge the call.
 * PLACEHOLDER: Replace with actual Hubtel API call.
 */
const triggerHubtelCall = async (sessionId, counselorPhone, userPhone) => {
  try {
    // PLACEHOLDER: This is a mock call. Replace with actual Hubtel API.
    const payload = {
      from: HOTLINE,
      to_counselor: counselorPhone,
      to_client: userPhone,
      mode: 'bridge',
      session_id: sessionId,
      duration_minutes: SESSION_DURATION_MINUTES
    };

    console.log(`[HUBTEL PLACEHOLDER] Would call: POST ${HUBTEL_VOICE_API}`, payload);

    // Uncomment below for real Hubtel integration:
    /*
    await axios.post(HUBTEL_VOICE_API, payload, {
      headers: {
        'Authorization': `Bearer ${process.env.HUBTEL_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    */
  } catch (err) {
    console.error('[HUBTEL API ERROR]', err.message);
    throw err;
  }
};

/**
 * Schedule automatic call end after SESSION_DURATION_MINUTES.
 */
const scheduleCallEnd = (sessionId, counselorId, minutes) => {
  setTimeout(async () => {
    try {
      const check = await pool.query(
        "SELECT id FROM sessions WHERE id=$1 AND session_status='active'",
        [sessionId]
      );
      if (!check.rows.length) return; // Already ended

      // End the call
      await endSessionCall(sessionId, counselorId);
      console.log(`[AUTO-END] Session #${sessionId} ended after ${minutes} minutes`);
    } catch (err) {
      console.error(`[AUTO-END ERROR] Session #${sessionId}:`, err.message);
    }
  }, minutes * 60 * 1000);
};

/**
 * End a session call (internal helper).
 */
const endSessionCall = async (sessionId, counselorId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Mark session as completed
    await client.query("UPDATE sessions SET session_status='completed' WHERE id=$1", [sessionId]);

    // Free up counselor
    await client.query('UPDATE counselors SET is_available=TRUE WHERE id=$1', [counselorId]);

    await client.query('COMMIT');

    // Log
    console.log(`[CALL_END] Session #${sessionId} completed`);

    // PLACEHOLDER: Call Hubtel to end the call
    console.log(`[HUBTEL PLACEHOLDER] Would call: POST ${HUBTEL_VOICE_API}/end-call for session ${sessionId}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[END_CALL ERROR]', err.message);
    throw err;
  } finally {
    client.release();
  }
};

/**
 * POST /api/hubtel/webhook
 * Webhook endpoint for Hubtel to notify about call status changes.
 * PLACEHOLDER: Implement based on Hubtel's webhook format.
 */
const hubtelWebhook = async (req, res) => {
  try {
    const { event, session_id, status } = req.body;

    console.log(`[HUBTEL WEBHOOK] Event: ${event}, Session: ${session_id}, Status: ${status}`);

    if (event === 'call_ended' && session_id) {
      // Fetch session to get counselor ID
      const sessionRes = await pool.query(
        'SELECT counselor_id FROM sessions WHERE id=$1',
        [session_id]
      );
      if (sessionRes.rows.length) {
        await endSessionCall(session_id, sessionRes.rows[0].counselor_id);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('[WEBHOOK ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getCounselorStatus,
  startSessionCall,
  hubtelWebhook
};
