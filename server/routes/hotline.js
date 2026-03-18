const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const {
  handleIncomingCall, handleCallEnded, noCounselorAvailable, makeCall
} = require('../controllers/hotlineController');

// Hubtel webhooks — no auth (Hubtel calls these directly)
router.post('/incoming', handleIncomingCall);
router.post('/call-ended', handleCallEnded);
router.get('/no-counselor', noCounselorAvailable);

// Authenticated: manual outbound call trigger
router.post('/call', authenticate, makeCall);

module.exports = router;
