const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { register, login, getProfile, changePassword } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.get('/profile', authenticate, getProfile);
router.put('/change-password', authenticate, changePassword);

module.exports = router;
