const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { register, login, getProfile, changePassword, forgotPassword, resetPassword, updateUserProfile } = require('../controllers/authController');
const multer = require('multer');
const { pool } = require('../database');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

router.post('/register', register);
router.post('/login', login);
router.get('/profile', authenticate, getProfile);
router.put('/change-password', authenticate, changePassword);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.put('/user/profile', authenticate, updateUserProfile);

// Upload user profile picture
router.post('/user/avatar', authenticate, upload.single('profile_picture'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image provided' });
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(req.file.mimetype)) return res.status(400).json({ error: 'Only JPEG, PNG or WebP allowed' });
  if (req.file.size > 2 * 1024 * 1024) return res.status(400).json({ error: 'Image must be under 2MB' });

  const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  try {
    // Ensure column exists first (handles databases that haven't run the migration)
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='profile_picture') THEN
          ALTER TABLE users ADD COLUMN profile_picture TEXT;
        END IF;
      END $$;
    `);

    await pool.query('UPDATE users SET profile_picture=$1 WHERE id=$2', [dataUrl, req.user.id]);

    if (req.user.role === 'counselor') {
      await pool.query('UPDATE counselors SET profile_picture=$1 WHERE user_id=$2', [dataUrl, req.user.id]).catch(() => {});
    }
    res.json({ message: 'Photo updated', profile_picture: dataUrl });
  } catch (err) {
    console.error('Avatar upload error:', err.message);
    res.status(500).json({ error: 'Failed to save photo: ' + err.message });
  }
});

// Remove user profile picture
router.delete('/user/avatar', authenticate, async (req, res) => {
  try {
    await pool.query('UPDATE users SET profile_picture=NULL WHERE id=$1', [req.user.id]).catch(() => {});
    if (req.user.role === 'counselor') {
      await pool.query('UPDATE counselors SET profile_picture=NULL WHERE user_id=$1', [req.user.id]).catch(() => {});
    }
    res.json({ message: 'Photo removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete account
router.delete('/user/delete', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id=$1', [req.user.id]);
    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
