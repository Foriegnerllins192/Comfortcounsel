const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  getPendingCounselors, getAllCounselors, approveCounselor, getUsers, getStats, getSessions, getPayments,
  getAdmins, addAdmin, removeAdmin, getAdminWallet, getPayoutOverview, payCounselor
} = require('../controllers/adminController');

router.use(authenticate, requireRole('admin'));

router.get('/stats', getStats);
router.get('/counselors', getAllCounselors);          // ?status=pending|approved|rejected
router.get('/counselors/pending', getPendingCounselors);
router.patch('/counselors/:id', approveCounselor);
router.get('/users', getUsers);
router.get('/sessions', getSessions);
router.get('/payments', getPayments);
router.get('/admins', getAdmins);
router.post('/admins', addAdmin);
router.delete('/admins/:id', removeAdmin);
router.get('/wallet', getAdminWallet);
router.get('/payouts', getPayoutOverview);
router.patch('/payouts/:id/pay', payCounselor);

module.exports = router;
