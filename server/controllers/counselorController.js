const { pool } = require('../database');

const registerCounselor = async (req, res) => {
  const { 
    name, email, password, phone_number, location, category, 
    years_experience, bio, education, license, level, video_url, specialties, price 
  } = req.body;
  
  // Only require essential fields - video_url and documents are optional
  if (!name || !email || !password || !phone_number || !category) {
    return res.status(400).json({ error: 'Required fields missing: name, email, password, phone, category' });
  }

  const bcrypt = require('bcryptjs');
  const jwt = require('jsonwebtoken');
  const { sendPendingApprovalEmail } = require('../services/emailService');

  try {
    const exists = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email already registered' });

    // Determine subscription tier (default to basic)
    const subscription_tier = level || 'basic';
    
    // Validate price based on tier
    let counselorPrice = parseFloat(price) || 80;
    const tierLimits = {
      'basic': 100,
      'standard': 250,
      'premium': 400
    };
    
    const maxPrice = tierLimits[subscription_tier] || 100;
    if (counselorPrice > maxPrice) {
      return res.status(400).json({ 
        error: `Price cannot exceed GHS ${maxPrice} for ${subscription_tier} tier` 
      });
    }
    
    if (counselorPrice < 50) {
      return res.status(400).json({ error: 'Price must be at least GHS 50' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const userResult = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role',
      [name, email, hashed, 'counselor']
    );
    const user = userResult.rows[0];

    await pool.query(
      'INSERT INTO counselors (user_id, category, bio, phone_number, location, years_experience, subscription_tier, price) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [user.id, category, bio || '', phone_number, location || '', years_experience || 0, subscription_tier, counselorPrice]
    );

    // Send pending approval email
    console.log('[COUNSELOR_REGISTRATION] Sending pending approval email to:', email);
    await sendPendingApprovalEmail(name, email)
      .then(() => console.log('[COUNSELOR_REGISTRATION] Email sent successfully to:', email))
      .catch(err => console.error('[COUNSELOR_REGISTRATION] Email failed:', err.message));

    res.status(201).json({ message: 'Registration submitted. Awaiting admin approval.', user });
  } catch (err) {
    console.error('[COUNSELOR_REGISTRATION] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

const getCounselors = async (req, res) => {
  try {
    const { category } = req.query;
    let query = `
      SELECT c.id, u.name, c.category, c.bio, c.location, c.years_experience,
             c.profile_picture, c.status, c.is_available, c.subscription_tier,
             c.rating, c.price,
             EXISTS (
               SELECT 1 FROM sessions s
               WHERE s.counselor_id = c.id
                 AND s.session_status IN ('scheduled','active')
                 AND s.payment_status = 'paid'
                 AND s.expires_at > NOW()
             ) AS has_active_session
      FROM counselors c JOIN users u ON c.user_id = u.id
      WHERE c.status = 'approved'
    `;
    const params = [];
    if (category) { query += ' AND c.category = $1'; params.push(category); }
    query += ' ORDER BY c.id DESC';

    const result = await pool.query(query, params);
    
    // Map the results to show is_available as false if they have active session OR manually set unavailable
    const counselors = result.rows.map(c => ({
      id: c.id,
      name: c.name,
      category: c.category,
      bio: c.bio,
      location: c.location,
      years_experience: c.years_experience,
      profile_picture: c.profile_picture,
      status: c.status,
      is_available: c.is_available && !c.has_active_session,
      subscription_tier: c.subscription_tier || 'basic',
      rating: parseFloat(c.rating) || 0,
      price: parseFloat(c.price) || 80
    }));
    
    res.json(counselors);
  } catch (err) {
    console.error('getCounselors error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

const getCounselorById = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, u.name, c.category, c.bio, c.location, c.years_experience, c.profile_picture, c.phone_number, c.price, c.session_duration
       FROM counselors c JOIN users u ON c.user_id = u.id
       WHERE c.id = $1 AND c.status = 'approved'`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Counselor not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getDashboard = async (req, res) => {
  try {
    const counselor = await pool.query(
      'SELECT c.*, u.name, u.email FROM counselors c JOIN users u ON c.user_id=u.id WHERE c.user_id=$1',
      [req.user.id]
    );
    if (!counselor.rows.length) return res.status(404).json({ error: 'Counselor profile not found' });

    const c = counselor.rows[0];
    
    // Fixed query to properly fetch client names and profile pictures
    const sessions = await pool.query(
      `SELECT s.*, u.name as user_name, u.profile_picture, u.id as client_user_id FROM sessions s
       JOIN users u ON s.user_id=u.id WHERE s.counselor_id=$1 ORDER BY s.created_at DESC`,
      [c.id]
    );
    
    const earnings = await pool.query(
      `SELECT COALESCE(SUM(p.amount),0) as total FROM payments p
       JOIN sessions s ON p.session_id=s.id WHERE s.counselor_id=$1 AND p.status='success'`,
      [c.id]
    );

    // Count open client requests matching counselor's category
    const pendingRequests = await pool.query(
      `SELECT COUNT(*) as count FROM client_requests WHERE status='open' AND category ILIKE $1`,
      [c.category]
    );

    res.json({
      profile: c,
      sessions: sessions.rows,
      total_sessions: sessions.rows.length,
      earnings: earnings.rows[0].total,
      pending_requests: parseInt(pendingRequests.rows[0].count) || 0
    });
  } catch (err) {
    console.error('getDashboard error:', err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
};

// Get client requests (problems posted by clients) - filtered by counselor's category
const getClientRequests = async (req, res) => {
  try {
    const { category, urgency, status = 'open' } = req.query;

    // Get counselor's category for default filtering
    const counselorResult = await pool.query(
      'SELECT category FROM counselors WHERE user_id=$1',
      [req.user.id]
    );
    const counselorCategory = counselorResult.rows[0]?.category;

    let query = `
      SELECT cr.*, u.name as client_name, u.profile_picture,
             CASE WHEN cr.is_anonymous THEN 'Anonymous' ELSE u.name END as display_name
      FROM client_requests cr
      JOIN users u ON cr.user_id = u.id
      WHERE cr.status = $1
    `;
    const params = [status];
    let paramIdx = 2;

    if (category) {
      query += ` AND cr.category ILIKE $${paramIdx++}`;
      params.push(category);
    }
    if (urgency) {
      query += ` AND cr.urgency = $${paramIdx++}`;
      params.push(urgency);
    }

    query += ' ORDER BY cr.created_at DESC';

    const result = await pool.query(query, params);
    
    // Process results to handle anonymous clients - they should not show profile pictures
    const processedResults = result.rows.map(row => ({
      ...row,
      profile_picture: row.is_anonymous ? null : row.profile_picture
    }));
    
    res.json(processedResults);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Reschedule a session — counselor sets a new expiry time
const rescheduleSession = async (req, res) => {
  const { session_id } = req.params;
  const { new_duration_minutes, note } = req.body;

  if (!new_duration_minutes || new_duration_minutes < 15 || new_duration_minutes > 180) {
    return res.status(400).json({ error: 'Duration must be between 15 and 180 minutes' });
  }

  try {
    // Verify this session belongs to this counselor
    const counselorResult = await pool.query(
      'SELECT id FROM counselors WHERE user_id=$1', [req.user.id]
    );
    if (!counselorResult.rows.length) return res.status(404).json({ error: 'Counselor not found' });
    const counselorId = counselorResult.rows[0].id;

    const session = await pool.query(
      `SELECT * FROM sessions WHERE id=$1 AND counselor_id=$2 AND payment_status='paid'
       AND session_status IN ('scheduled','active')`,
      [session_id, counselorId]
    );
    if (!session.rows.length) return res.status(404).json({ error: 'Session not found or not eligible for reschedule' });

    // Set new expiry from NOW + duration
    const newExpiry = new Date(Date.now() + new_duration_minutes * 60 * 1000);
    await pool.query(
      `UPDATE sessions SET expires_at=$1, session_status='scheduled' WHERE id=$2`,
      [newExpiry, session_id]
    );

    res.json({
      message: `Session rescheduled. New expiry: ${newExpiry.toISOString()}`,
      expires_at: newExpiry,
      duration_minutes: new_duration_minutes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateProfile = async (req, res) => {
  const { bio, location, years_experience, phone_number, name, price, session_duration } = req.body;
  
  // Trim whitespace from all text inputs
  const trimmedBio = bio ? bio.trim() : null;
  const trimmedLocation = location ? location.trim() : null;
  const trimmedPhone = phone_number ? phone_number.trim() : null;
  const trimmedName = name ? name.trim() : null;
  
  // Validate bio length (max 2000 characters)
  if (trimmedBio && trimmedBio.length > 2000) {
    return res.status(400).json({ error: 'Bio must not exceed 2000 characters' });
  }
  
  // Validate years_experience range (0-50)
  if (years_experience !== undefined && years_experience !== null) {
    const yearsNum = parseInt(years_experience);
    if (isNaN(yearsNum) || yearsNum < 0 || yearsNum > 50) {
      return res.status(400).json({ error: 'Years of experience must be between 0 and 50' });
    }
  }
  
  // Validate phone number format (10 digits)
  if (trimmedPhone && !/^\d{10}$/.test(trimmedPhone)) {
    return res.status(400).json({ error: 'Phone number must be 10 digits' });
  }
  
  // Validate price if provided
  if (price !== undefined && price !== null) {
    const priceNum = parseFloat(price);
    
    if (isNaN(priceNum) || priceNum < 50) {
      return res.status(400).json({ error: 'Price must be at least GHS 50' });
    }
    
    // Get counselor's subscription tier to validate max price
    const tierResult = await pool.query(
      'SELECT subscription_tier FROM counselors WHERE user_id = $1',
      [req.user.id]
    );
    
    if (tierResult.rows.length > 0) {
      const tier = tierResult.rows[0].subscription_tier || 'basic';
      const tierLimits = {
        'basic': 100,
        'standard': 250,
        'premium': 400
      };
      
      const maxPrice = tierLimits[tier] || 100;
      if (priceNum > maxPrice) {
        return res.status(400).json({ 
          error: `Price cannot exceed GHS ${maxPrice} for ${tier} tier. Upgrade your tier to charge more.` 
        });
      }
    }
  }
  
  // Use database transaction for multi-table updates
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Build dynamic update query for counselors table
    const counselorUpdates = [];
    const counselorValues = [];
    let paramCount = 1;
    
    if (trimmedBio !== null) {
      counselorUpdates.push(`bio = $${paramCount++}`);
      counselorValues.push(trimmedBio);
    }
    if (trimmedLocation !== null) {
      counselorUpdates.push(`location = $${paramCount++}`);
      counselorValues.push(trimmedLocation);
    }
    if (years_experience !== undefined) {
      counselorUpdates.push(`years_experience = $${paramCount++}`);
      counselorValues.push(years_experience);
    }
    if (trimmedPhone !== null) {
      counselorUpdates.push(`phone_number = $${paramCount++}`);
      counselorValues.push(trimmedPhone);
    }
    if (price !== undefined && price !== null) {
      counselorUpdates.push(`price = $${paramCount++}`);
      counselorValues.push(parseFloat(price));
    }
    if (session_duration !== undefined && session_duration !== null) {
      const dur = parseInt(session_duration);
      if (isNaN(dur) || dur < 15 || dur > 180) {
        return res.status(400).json({ error: 'Session duration must be between 15 and 180 minutes' });
      }
      counselorUpdates.push(`session_duration = $${paramCount++}`);
      counselorValues.push(dur);
    }
    
    if (counselorUpdates.length > 0) {
      counselorValues.push(req.user.id);
      await client.query(
        `UPDATE counselors SET ${counselorUpdates.join(', ')} WHERE user_id = $${paramCount}`,
        counselorValues
      );
    }
    
    // Update user table if name provided
    if (trimmedName) {
      await client.query('UPDATE users SET name=$1 WHERE id=$2', [trimmedName, req.user.id]);
    }
    
    await client.query('COMMIT');
    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('updateProfile error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to update profile. Please try again.' });
  } finally {
    client.release();
  }
};

const uploadProfilePicture = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file provided' });

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(req.file.mimetype))
    return res.status(400).json({ error: 'Only JPEG, PNG, WebP or GIF images are allowed' });

  if (req.file.size > 2 * 1024 * 1024)
    return res.status(400).json({ error: 'Image must be under 2MB' });

  const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

  try {
    await pool.query(
      'UPDATE counselors SET profile_picture=$1 WHERE user_id=$2',
      [dataUrl, req.user.id]
    );
    res.json({ message: 'Profile picture updated', profile_picture: dataUrl });
  } catch (err) {
    console.error('uploadProfilePicture error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

const updateAvailability = async (req, res) => {
  const { is_available } = req.body;
  if (typeof is_available !== 'boolean') {
    return res.status(400).json({ error: 'is_available must be a boolean' });
  }

  try {
    await pool.query(
      'UPDATE counselors SET is_available=$1 WHERE user_id=$2',
      [is_available, req.user.id]
    );
    res.json({ message: `Availability updated to ${is_available ? 'Available' : 'Unavailable'}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { registerCounselor, getCounselors, getCounselorById, getDashboard, updateProfile, uploadProfilePicture, updateAvailability, getClientRequests, rescheduleSession };
