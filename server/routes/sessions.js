const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const {
  initiateBooking, verifyPayment, paystackWebhook, getUserSessions
} = require('../controllers/bookingController');

router.post('/book-session', authenticate, initiateBooking);
router.get('/verify/:reference', authenticate, verifyPayment);
router.get('/my-sessions', authenticate, getUserSessions);
router.post('/webhook/paystack', paystackWebhook);

module.exports = router;
