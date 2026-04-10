const router = require('express').Router();
const multer = require('multer');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  registerCounselor, getCounselors, getCounselorById,
  getDashboard, updateProfile, uploadProfilePicture, updateAvailability
} = require('../controllers/counselorController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }
});

// Specific routes MUST come before /:id to avoid param conflicts
router.post('/register', registerCounselor);
router.get('/', getCounselors);
router.get('/dashboard/me', authenticate, requireRole('counselor'), getDashboard);
router.put('/profile/me', authenticate, requireRole('counselor'), updateProfile);
router.post('/profile/picture', authenticate, requireRole('counselor'), upload.single('profile_picture'), uploadProfilePicture);
router.put('/availability', authenticate, requireRole('counselor'), updateAvailability);

// Wildcard param route last
router.get('/:id', getCounselorById);

module.exports = router;
