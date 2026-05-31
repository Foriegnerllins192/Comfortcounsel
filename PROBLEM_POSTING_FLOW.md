# 📝 How "Post a Problem" Works - Complete Flow

## Overview
When a client has a problem, they can post it on the platform. The problem gets stored in the database, counselors can see it, and eventually it can lead to a paid counseling session.

## 🔄 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROBLEM POSTING FLOW                          │
└─────────────────────────────────────────────────────────────────┘

Step 1: Client Posts Problem
   │
   ├─► Client fills out form on post-problem.html:
   │   • Category (Relationship, Family, Career, etc.)
   │   • Title (brief summary)
   │   • Description (detailed explanation)
   │   • Urgency (low, normal, high, urgent)
   │   • Anonymous option (yes/no)
   │
   ▼

Step 2: Problem Saved to Database
   │
   ├─► INSERT INTO client_requests:
   │   • user_id (who posted it)
   │   • category
   │   • title
   │   • description
   │   • urgency
   │   • status = 'open'
   │   • is_anonymous
   │
   ▼

Step 3: Counselors See the Problem
   │
   ├─► Counselors view problems on their dashboard
   │   • Filter by category
   │   • See urgency level
   │   • Read description
   │   • Can respond or claim
   │
   ▼

Step 4: Counselor Responds/Claims
   │
   ├─► Counselor clicks "I can help with this"
   │   • UPDATE client_requests:
   │     - status = 'assigned'
   │     - assigned_counselor_id = counselor.id
   │   • Client gets notification
   │
   ▼

Step 5: Client Books Session
   │
   ├─► Client sees counselor response
   │   • Clicks "Book Session with [Counselor]"
   │   • Chooses session duration/price
   │   • Proceeds to payment
   │
   ▼

Step 6: Payment & Session Creation
   │
   ├─► Client pays via Paystack
   │   • Payment verified
   │   • INSERT INTO sessions:
   │     - user_id
   │     - counselor_id
   │     - request_id (links to original problem)
   │     - session_amount
   │     - payment_status = 'paid'
   │     - session_status = 'scheduled'
   │
   ▼

Step 7: Commission Calculation
   │
   ├─► System calculates commission:
   │   • Get counselor's commission_rate
   │   • commission = amount × (rate / 100)
   │   • counselor_earnings = amount - commission
   │   • INSERT INTO platform_commissions
   │   • Credit counselor's wallet
   │
   ▼

Step 8: Session Happens
   │
   ├─► Counselor and client have session
   │   • UPDATE sessions:
   │     - session_status = 'active'
   │     - call_started_at = NOW()
   │   • After session:
   │     - session_status = 'completed'
   │   • UPDATE client_requests:
   │     - status = 'resolved'
   │
   └─► Done! ✅
```

## 📊 Database Tables Involved

### 1. `client_requests` Table

This is where problems are stored:

```sql
CREATE TABLE client_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,                    -- Who posted the problem
  category VARCHAR(100),              -- Relationship, Family, Career, etc.
  title VARCHAR(255),                 -- Brief summary
  description TEXT,                   -- Detailed explanation
  urgency VARCHAR(20),                -- low, normal, high, urgent
  status VARCHAR(20),                 -- open, assigned, in_progress, resolved, closed
  assigned_counselor_id INTEGER,      -- Which counselor is helping
  is_anonymous BOOLEAN,               -- Hide client's name?
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### 2. `sessions` Table

Links problems to actual counseling sessions:

```sql
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,                    -- Client
  counselor_id INTEGER,               -- Counselor
  request_id INTEGER,                 -- Links to client_requests ⬅️ IMPORTANT
  caller_phone VARCHAR(20),
  counselor_phone VARCHAR(20),
  payment_status VARCHAR(20),
  session_status VARCHAR(20),
  session_amount NUMERIC(10,2),       -- How much client paid
  expires_at TIMESTAMP,
  call_started_at TIMESTAMP,
  created_at TIMESTAMP
);
```

## 💻 Frontend Implementation

### Step 1: Post Problem Form (post-problem.html)

```html
<form id="post-problem-form">
  <select name="category" required>
    <option value="">Select Category</option>
    <option value="Relationship">Relationship</option>
    <option value="Family">Family</option>
    <option value="Career">Career</option>
    <option value="Youth">Youth</option>
    <option value="Business">Business</option>
    <option value="Mental Wellness">Mental Wellness</option>
  </select>
  
  <input type="text" name="title" placeholder="Brief summary" required>
  
  <textarea name="description" placeholder="Describe your situation..." required></textarea>
  
  <select name="urgency">
    <option value="normal">Normal</option>
    <option value="high">High</option>
    <option value="urgent">Urgent</option>
  </select>
  
  <label>
    <input type="checkbox" name="is_anonymous">
    Post anonymously
  </label>
  
  <button type="submit">Post Problem</button>
</form>
```

### Step 2: JavaScript to Submit Problem

```javascript
document.getElementById('post-problem-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = {
    category: e.target.category.value,
    title: e.target.title.value.trim(),
    description: e.target.description.value.trim(),
    urgency: e.target.urgency.value,
    is_anonymous: e.target.is_anonymous.checked
  };
  
  try {
    const response = await ComfortCounsel.apiRequest('/api/requests', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
    
    ComfortCounsel.showToast('Problem posted successfully!', 'success');
    
    // Redirect to view requests
    setTimeout(() => {
      window.location.href = 'my-requests.html';
    }, 1500);
    
  } catch (error) {
    ComfortCounsel.showToast('Failed to post problem: ' + error.message, 'error');
  }
});
```

## 🔧 Backend Implementation

### Step 1: Create Request Endpoint

```javascript
// In server/controllers/requestController.js

const createRequest = async (req, res) => {
  try {
    const { category, title, description, urgency, is_anonymous } = req.body;
    const userId = req.user.id; // From JWT token
    
    // Validate input
    if (!category || !title || !description) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (title.length > 255) {
      return res.status(400).json({ error: 'Title too long' });
    }
    
    // Insert into database
    const result = await pool.query(`
      INSERT INTO client_requests (
        user_id, category, title, description, urgency, 
        status, is_anonymous, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'open', $6, NOW(), NOW())
      RETURNING *
    `, [userId, category, title, description, urgency || 'normal', is_anonymous || false]);
    
    res.status(201).json({
      message: 'Problem posted successfully',
      request: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ error: 'Failed to post problem' });
  }
};
```

### Step 2: Get All Requests (for counselors)

```javascript
const getAllRequests = async (req, res) => {
  try {
    const { category, status, urgency } = req.query;
    
    let query = `
      SELECT 
        r.id,
        r.category,
        r.title,
        r.description,
        r.urgency,
        r.status,
        r.is_anonymous,
        r.created_at,
        CASE 
          WHEN r.is_anonymous THEN 'Anonymous'
          ELSE u.name
        END as client_name,
        c.id as assigned_counselor_id,
        cu.name as assigned_counselor_name
      FROM client_requests r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN counselors c ON r.assigned_counselor_id = c.id
      LEFT JOIN users cu ON c.user_id = cu.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (category) {
      query += ` AND r.category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }
    
    if (status) {
      query += ` AND r.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }
    
    if (urgency) {
      query += ` AND r.urgency = $${paramCount}`;
      params.push(urgency);
      paramCount++;
    }
    
    query += ` ORDER BY 
      CASE r.urgency
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
      END,
      r.created_at DESC
    `;
    
    const result = await pool.query(query, params);
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
};
```

### Step 3: Counselor Claims Request

```javascript
const claimRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const counselorId = req.user.counselorId; // From JWT
    
    // Check if request is still open
    const checkResult = await pool.query(
      'SELECT status FROM client_requests WHERE id = $1',
      [requestId]
    );
    
    if (!checkResult.rows.length) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    if (checkResult.rows[0].status !== 'open') {
      return res.status(400).json({ error: 'Request already assigned' });
    }
    
    // Assign to counselor
    await pool.query(`
      UPDATE client_requests 
      SET 
        status = 'assigned',
        assigned_counselor_id = $1,
        updated_at = NOW()
      WHERE id = $2
    `, [counselorId, requestId]);
    
    res.json({ message: 'Request claimed successfully' });
    
  } catch (error) {
    console.error('Error claiming request:', error);
    res.status(500).json({ error: 'Failed to claim request' });
  }
};
```

### Step 4: Create Session from Request

```javascript
const createSessionFromRequest = async (req, res) => {
  try {
    const { requestId, amount, duration } = req.body;
    const userId = req.user.id;
    
    // Get request details
    const requestResult = await pool.query(`
      SELECT assigned_counselor_id, status 
      FROM client_requests 
      WHERE id = $1 AND user_id = $2
    `, [requestId, userId]);
    
    if (!requestResult.rows.length) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    const request = requestResult.rows[0];
    
    if (!request.assigned_counselor_id) {
      return res.status(400).json({ error: 'No counselor assigned yet' });
    }
    
    // Get counselor details
    const counselorResult = await pool.query(`
      SELECT c.id, c.commission_rate, c.phone_number, u.id as user_id
      FROM counselors c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = $1
    `, [request.assigned_counselor_id]);
    
    const counselor = counselorResult.rows[0];
    
    // Get client phone
    const clientResult = await pool.query(
      'SELECT phone FROM users WHERE id = $1',
      [userId]
    );
    
    // Create session
    const sessionResult = await pool.query(`
      INSERT INTO sessions (
        user_id, counselor_id, request_id, 
        caller_phone, counselor_phone,
        session_amount, payment_status, session_status,
        expires_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'scheduled', 
                NOW() + INTERVAL '24 hours', NOW())
      RETURNING *
    `, [
      userId, 
      counselor.id, 
      requestId,
      clientResult.rows[0].phone,
      counselor.phone_number,
      amount
    ]);
    
    // Update request status
    await pool.query(`
      UPDATE client_requests 
      SET status = 'in_progress', updated_at = NOW()
      WHERE id = $1
    `, [requestId]);
    
    res.status(201).json({
      message: 'Session created successfully',
      session: sessionResult.rows[0]
    });
    
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
};
```

## 📱 User Interface Examples

### Client View - My Requests

```javascript
// Load client's requests
async function loadMyRequests() {
  try {
    const requests = await ComfortCounsel.apiRequest('/api/requests/my-requests');
    
    const container = document.getElementById('requests-container');
    
    if (requests.length === 0) {
      container.innerHTML = '<p>You have not posted any problems yet.</p>';
      return;
    }
    
    container.innerHTML = requests.map(request => `
      <div class="request-card status-${request.status}">
        <div class="request-header">
          <span class="category-badge">${request.category}</span>
          <span class="urgency-badge urgency-${request.urgency}">${request.urgency}</span>
          <span class="status-badge">${request.status}</span>
        </div>
        <h3>${request.title}</h3>
        <p>${request.description}</p>
        <div class="request-footer">
          <span class="date">${formatDate(request.created_at)}</span>
          ${request.assigned_counselor_name ? 
            `<span class="counselor">Assigned to: ${request.assigned_counselor_name}</span>` : 
            '<span class="counselor">Waiting for counselor...</span>'
          }
        </div>
        ${request.status === 'assigned' ? 
          `<button onclick="bookSession(${request.id})">Book Session</button>` : 
          ''
        }
      </div>
    `).join('');
    
  } catch (error) {
    console.error('Error loading requests:', error);
  }
}
```

### Counselor View - Available Requests

```javascript
// Load available requests for counselors
async function loadAvailableRequests() {
  try {
    const requests = await ComfortCounsel.apiRequest('/api/requests?status=open');
    
    const container = document.getElementById('requests-container');
    
    container.innerHTML = requests.map(request => `
      <div class="request-card">
        <div class="request-header">
          <span class="category-badge">${request.category}</span>
          <span class="urgency-badge urgency-${request.urgency}">${request.urgency}</span>
        </div>
        <h3>${request.title}</h3>
        <p>${request.description}</p>
        <div class="request-footer">
          <span class="client">${request.client_name}</span>
          <span class="date">${formatDate(request.created_at)}</span>
        </div>
        <button onclick="claimRequest(${request.id})" class="btn-claim">
          I can help with this
        </button>
      </div>
    `).join('');
    
  } catch (error) {
    console.error('Error loading requests:', error);
  }
}

async function claimRequest(requestId) {
  try {
    await ComfortCounsel.apiRequest(`/api/requests/${requestId}/claim`, {
      method: 'POST'
    });
    
    ComfortCounsel.showToast('Request claimed successfully!', 'success');
    loadAvailableRequests(); // Reload list
    
  } catch (error) {
    ComfortCounsel.showToast('Failed to claim request: ' + error.message, 'error');
  }
}
```

## 📊 Sample Data in Schema

The updated schema includes 6 sample problems:

1. **Relationship** - Communication issues in marriage (High urgency, Assigned)
2. **Career** - Feeling stuck in job (Normal urgency, Open)
3. **Youth** - Teenager acting out (High urgency, Assigned)
4. **Mental Wellness** - Anxiety and stress (Urgent, In Progress)
5. **Family** - Mother-in-law conflict (Normal urgency, Open)
6. **Business** - Startup stress (High urgency, Open)

## 🔗 Complete Request Lifecycle

```
POST PROBLEM → OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED
     ↓           ↓         ↓            ↓            ↓         ↓
  Client    Counselors  Counselor   Session     Session   Archive
  submits   can see     claims      booked      completed
```

## ✅ Summary

**How it works:**
1. Client posts problem → Saved to `client_requests` table
2. Counselors see problems → Query `client_requests` WHERE status='open'
3. Counselor claims → UPDATE `client_requests` SET assigned_counselor_id
4. Client books session → INSERT INTO `sessions` with request_id link
5. Payment processed → Commission calculated and recorded
6. Session happens → Status updated to completed
7. Problem resolved → Request marked as resolved

**Key Points:**
- Problems stored in `client_requests` table
- Sessions link to problems via `request_id`
- Counselors can filter by category, urgency, status
- Anonymous posting supported
- Full tracking from problem to resolution

---

**Your schema is now ready with the complete problem posting system!** 🎉
