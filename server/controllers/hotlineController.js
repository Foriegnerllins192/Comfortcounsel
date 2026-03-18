const axios = require('axios');
const { pool } = require('../database');

// Hubtel Voice API - forward incoming call to an available counselor
const handleIncomingCall = async (req, res) => {
  try {
    // Find an available approved counselor (round-robin: pick first available)
    const result = await pool.query(
      "SELECT c.phone_number, u.name FROM counselors c JOIN users u ON c.user_id=u.id WHERE c.status='approved' LIMIT 1"
    );

    if (!result.rows.length) {
      // No counselors available - respond with voice message
      return res.json({
        "Type": "Redirect",
        "RedirectUrl": "https://comfortcounsel.onrender.com/api/hotline/no-counselor"
      });
    }

    const counselor = result.rows[0];

    // Hubtel VXML-style response to forward call
    res.json({
      "Type": "Bridge",
      "PhoneNumber": counselor.phone_number,
      "CallerId": process.env.HUBTEL_FROM
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const noCounselorAvailable = (req, res) => {
  res.json({
    "Type": "Say",
    "Text": "Sorry, no counselors are available right now. Please call back later or visit our website at comfort counsel dot com.",
    "Voice": "female"
  });
};

// Outbound call via Hubtel to connect user with counselor
const makeCall = async (req, res) => {
  const { to, counselor_id } = req.body;
  try {
    const counselor = await pool.query(
      "SELECT c.phone_number FROM counselors c WHERE c.id=$1 AND c.status='approved'",
      [counselor_id]
    );
    if (!counselor.rows.length) return res.status(404).json({ error: 'Counselor not found' });

    const auth = Buffer.from(
      `${process.env.HUBTEL_CLIENT_ID}:${process.env.HUBTEL_CLIENT_SECRET}`
    ).toString('base64');

    await axios.post(
      'https://voice.hubtel.com/v1/calls',
      {
        From: process.env.HUBTEL_FROM,
        To: to,
        CallbackUrl: 'https://comfortcounsel.onrender.com/api/hotline/incoming'
      },
      { headers: { Authorization: `Basic ${auth}` } }
    );

    res.json({ message: 'Call initiated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { handleIncomingCall, noCounselorAvailable, makeCall };
