const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  getPendingCounselors, approveCounselor, getUsers, getSessions, getPayments
} = require('../controllers/adminController');

router.use(authenticate, requireRole('admin'));

router.get('/counselors/pending', getPendingCounselors);
router.patch('/counselors/:id', approveCounselor);
router.get('/users', getUsers);
router.get('/sessions', getSessions);
router.get('/payments', getPayments);

module.exports = router;
