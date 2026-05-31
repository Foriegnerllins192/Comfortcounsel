# 📝 Problem Posting - Quick Summary

## How It Works (Simple Version)

```
1. Client posts problem
   ↓
2. Saved to database (client_requests table)
   ↓
3. Counselors see the problem
   ↓
4. Counselor says "I can help"
   ↓
5. Client books session with that counselor
   ↓
6. Payment → Session happens → Problem resolved
```

## Database Table: `client_requests`

```sql
CREATE TABLE client_requests (
  id                      -- Problem ID
  user_id                 -- Who posted it
  category                -- Relationship, Family, Career, etc.
  title                   -- "Struggling with communication"
  description             -- Full details
  urgency                 -- low, normal, high, urgent
  status                  -- open, assigned, in_progress, resolved
  assigned_counselor_id   -- Which counselor is helping
  is_anonymous            -- Hide client's name?
  created_at
  updated_at
);
```

## Example: Client Posts Problem

### Frontend (post-problem.html)
```javascript
// Client fills form and submits
const problem = {
  category: 'Relationship',
  title: 'Communication issues with spouse',
  description: 'We argue a lot and need help...',
  urgency: 'high',
  is_anonymous: false
};

// POST to API
await fetch('/api/requests', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(problem)
});
```

### Backend (requestController.js)
```javascript
// Save to database
INSERT INTO client_requests (
  user_id, category, title, description, urgency, status
) VALUES (
  1, 'Relationship', 'Communication issues...', '...', 'high', 'open'
);
```

## Example: Counselor Sees Problems

```javascript
// Counselor dashboard loads open problems
const problems = await fetch('/api/requests?status=open');

// Shows list:
// 1. Communication issues (Relationship) - HIGH
// 2. Career guidance needed (Career) - NORMAL
// 3. Teenager problems (Youth) - URGENT
```

## Example: Counselor Claims Problem

```javascript
// Counselor clicks "I can help"
await fetch('/api/requests/1/claim', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});

// Database updates:
UPDATE client_requests 
SET status = 'assigned', 
    assigned_counselor_id = 3
WHERE id = 1;
```

## Example: Client Books Session

```javascript
// Client sees: "Dr. Sarah Owusu can help with your problem"
// Client clicks "Book Session"

// Creates session linked to problem
INSERT INTO sessions (
  user_id, 
  counselor_id, 
  request_id,        -- ⬅️ Links to the problem!
  session_amount,
  payment_status,
  session_status
) VALUES (
  1, 3, 1, 100.00, 'pending', 'scheduled'
);
```

## Status Flow

```
open        → Problem posted, waiting for counselor
assigned    → Counselor claimed it
in_progress → Session booked/happening
resolved    → Session completed, problem solved
closed      → Archived
```

## Sample Data Included

The schema includes 6 sample problems:

| ID | Category | Title | Urgency | Status |
|----|----------|-------|---------|--------|
| 1 | Relationship | Communication issues | High | Assigned |
| 2 | Career | Feeling stuck | Normal | Open |
| 3 | Youth | Teenager problems | High | Assigned |
| 4 | Mental Wellness | Anxiety | Urgent | In Progress |
| 5 | Family | Mother-in-law conflict | Normal | Open |
| 6 | Business | Startup stress | High | Open |

## Key Points

✅ **Problems stored in:** `client_requests` table
✅ **Sessions link to problems via:** `request_id` field
✅ **Counselors can:** See, filter, and claim problems
✅ **Clients can:** Post anonymously if needed
✅ **Full tracking:** From problem post to resolution

## Files to Check

- **Schema:** `schema.sql` (has client_requests table + sample data)
- **Full Guide:** `PROBLEM_POSTING_FLOW.md`
- **This Summary:** `PROBLEM_POSTING_SUMMARY.md`

---

**Ready to use!** Upload the schema and the problem posting system will work. 🎉
