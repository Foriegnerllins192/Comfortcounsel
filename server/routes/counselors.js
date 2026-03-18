const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  registerCounselor, getCounselors, getCounselorById, getDashboard, updateProfile
} = require('../controllers/counselorController');

router.post('/register', registerCounselor);
router.get('/', getCounselors);
router.get('/:id', getCounselorById);
router.get('/dashboard/me', authenticate, requireRole('counselor'), getDashboard);
router.put('/profile/me', authenticate, requireRole('counselor'), updateProfile);

module.exports = router;
