const router = require('express').Router();
const { pool } = require('../database');
const { authenticate } = require('../middleware/auth');

// POST /api/requests — client posts a problem
router.post('/', authenticate, async (req, res) => {
  const { title, category, description, urgency, budget, needs, is_anonymous } = req.body;

  if (!title || !category || !description) {
    return res.status(400).json({ error: 'title, category, and description are required' });
  }

  if (description.trim().length < 50) {
    return res.status(400).json({ error: 'Description must be at least 50 characters' });
  }

  const validCategories = ['relationship', 'family', 'business', 'youth', 'career', 'mental-wellness'];
  if (!validCategories.includes(category.toLowerCase())) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  const validUrgency = ['low', 'normal', 'high', 'urgent'];
  const urgencyValue = urgency || 'normal';
  if (!validUrgency.includes(urgencyValue)) {
    return res.status(400).json({ error: 'Invalid urgency level' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO client_requests (user_id, category, title, description, urgency, is_anonymous, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'open')
       RETURNING id, title, category, urgency, status, created_at`,
      [
        req.user.id,
        category.toLowerCase(),
        title.trim(),
        description.trim(),
        urgencyValue,
        is_anonymous === true
      ]
    );

    res.status(201).json({
      message: 'Problem posted successfully. Counselors will be able to see it.',
      request: result.rows[0]
    });
  } catch (err) {
    console.error('Post request error:', err.message);
    res.status(500).json({ error: 'Failed to post problem. Please try again.' });
  }
});

// GET /api/requests/mine — client views their own posted problems
router.get('/mine', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cr.*, u.name as assigned_counselor_name
       FROM client_requests cr
       LEFT JOIN counselors c ON cr.assigned_counselor_id = c.id
       LEFT JOIN users u ON c.user_id = u.id
       WHERE cr.user_id = $1
       ORDER BY cr.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/requests/:id — client deletes their own request
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM client_requests WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Request not found or not yours' });
    }
    res.json({ message: 'Request deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
