const router = require('express').Router();
const { handleIncomingCall, noCounselorAvailable, makeCall } = require('../controllers/hotlineController');
const { authenticate, requireRole } = require('../middleware/auth');

router.post('/incoming', handleIncomingCall);
router.get('/no-counselor', noCounselorAvailable);
router.post('/call', authenticate, makeCall);

module.exports = router;
