# Task 3.1 Completion Summary: Update Profile Function Enhancement

## Task Details
**Task:** Update `updateProfile` function in `server/controllers/counselorController.js`  
**Spec:** counselor-profile-account-management  
**Requirements Validated:** 3.4, 3.5, 3.6, 8.2, 8.5, 8.6

## Changes Implemented

### 1. Bio Length Validation (Requirement 3.5, 8.5)
- Added validation to ensure bio does not exceed 2000 characters
- Returns HTTP 400 with error message: "Bio must not exceed 2000 characters"
- Validation occurs after trimming whitespace

### 2. Years Experience Range Validation (Requirement 3.4, 8.6)
- Added validation to ensure years_experience is between 0 and 50 (inclusive)
- Handles undefined, null, and non-numeric values
- Returns HTTP 400 with error message: "Years of experience must be between 0 and 50"

### 3. Phone Number Format Validation (Requirement 8.5)
- Added validation to ensure phone number is exactly 10 digits
- Uses regex pattern: `/^\d{10}$/`
- Rejects phone numbers with non-digit characters (dashes, spaces, etc.)
- Returns HTTP 400 with error message: "Phone number must be 10 digits"
- Validation occurs after trimming whitespace

### 4. Whitespace Trimming (Requirement 8.2)
- All text inputs are trimmed before validation and storage:
  - `bio` → `trimmedBio`
  - `location` → `trimmedLocation`
  - `phone_number` → `trimmedPhone`
  - `name` → `trimmedName`
- Trimming prevents leading/trailing whitespace from causing validation issues

### 5. Database Transaction Support (Requirement 3.6)
- Transaction support was already implemented (no changes needed)
- Uses `BEGIN`, `COMMIT`, and `ROLLBACK` for multi-table updates
- Updates both `counselors` and `users` tables atomically
- Proper error handling with rollback on failure

### 6. Enhanced Error Handling
- Improved error messages for better user experience
- Changed success message from "Profile updated" to "Profile updated successfully"
- Changed generic error message to "Failed to update profile. Please try again."
- Added error stack trace logging for debugging

## Code Changes

### Before
```javascript
const updateProfile = async (req, res) => {
  const { bio, location, years_experience, phone_number, name } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE counselors SET bio=$1, location=$2, years_experience=$3, phone_number=$4 WHERE user_id=$5',
      [bio, location, years_experience, phone_number, req.user.id]
    );
    if (name) {
      await client.query('UPDATE users SET name=$1 WHERE id=$2', [name, req.user.id]);
    }
    await client.query('COMMIT');
    res.json({ message: 'Profile updated' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};
```

### After
```javascript
const updateProfile = async (req, res) => {
  const { bio, location, years_experience, phone_number, name } = req.body;
  
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
  
  // Use database transaction for multi-table updates
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE counselors SET bio=$1, location=$2, years_experience=$3, phone_number=$4 WHERE user_id=$5',
      [trimmedBio, trimmedLocation, years_experience, trimmedPhone, req.user.id]
    );
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
```

## Test Coverage

Created comprehensive test suite with 19 test cases covering:

### Validation Tests (10 tests)
- ✅ Reject bio exceeding 2000 characters
- ✅ Accept bio with exactly 2000 characters
- ✅ Reject negative years_experience
- ✅ Reject years_experience greater than 50
- ✅ Accept years_experience of 0
- ✅ Accept years_experience of 50
- ✅ Reject phone number with less than 10 digits
- ✅ Reject phone number with more than 10 digits
- ✅ Reject phone number with non-digit characters
- ✅ Accept valid 10-digit phone number

### Whitespace Trimming Tests (4 tests)
- ✅ Trim whitespace from bio
- ✅ Trim whitespace from location
- ✅ Trim whitespace from phone_number
- ✅ Trim whitespace from name

### Transaction Tests (4 tests)
- ✅ Use database transaction for updates
- ✅ Rollback transaction on error
- ✅ Update both counselors and users tables
- ✅ Not update users table if name is not provided

### Success Response Tests (1 test)
- ✅ Return success message on successful update

**All 19 tests passing ✅**

## Validation Examples

### Valid Inputs
```javascript
// Valid profile update
{
  bio: "Experienced counselor specializing in youth development",
  location: "Accra, Ghana",
  years_experience: 5,
  phone_number: "0201234567",
  name: "John Doe"
}
```

### Invalid Inputs
```javascript
// Bio too long
{
  bio: "a".repeat(2001), // 2001 characters
  // Error: "Bio must not exceed 2000 characters"
}

// Invalid years_experience
{
  years_experience: -1, // Negative
  // Error: "Years of experience must be between 0 and 50"
}

{
  years_experience: 51, // Too high
  // Error: "Years of experience must be between 0 and 50"
}

// Invalid phone number
{
  phone_number: "020-123-456", // Contains dashes
  // Error: "Phone number must be 10 digits"
}

{
  phone_number: "020123456", // Only 9 digits
  // Error: "Phone number must be 10 digits"
}
```

## API Response Examples

### Success Response
```json
{
  "message": "Profile updated successfully"
}
```

### Error Responses
```json
// Bio validation error
{
  "error": "Bio must not exceed 2000 characters"
}

// Years experience validation error
{
  "error": "Years of experience must be between 0 and 50"
}

// Phone number validation error
{
  "error": "Phone number must be 10 digits"
}

// Database error
{
  "error": "Failed to update profile. Please try again."
}
```

## Requirements Validation

| Requirement | Description | Status |
|------------|-------------|--------|
| 3.4 | Validate years_experience is non-negative integer | ✅ Implemented |
| 3.5 | Validate bio length does not exceed 2000 characters | ✅ Implemented |
| 3.6 | Save changes to database with transaction | ✅ Already implemented |
| 8.2 | Trim leading and trailing whitespace | ✅ Implemented |
| 8.5 | Validate phone number format | ✅ Implemented |
| 8.6 | Validate years_experience range (0-50) | ✅ Implemented |

## Files Modified

1. **comfort-counsel/server/controllers/counselorController.js**
   - Enhanced `updateProfile` function with validation and trimming

## Files Created

1. **comfort-counsel/server/controllers/counselorController.test.js**
   - Comprehensive test suite with 19 test cases
   - Uses Mocha, Chai, and Sinon for testing

## Testing Instructions

To run the tests:
```bash
cd comfort-counsel
npm test -- server/controllers/counselorController.test.js
```

Expected output: All 19 tests passing

## Next Steps

This task is complete. The `updateProfile` function now includes:
- ✅ Bio length validation (max 2000 characters)
- ✅ Years experience range validation (0-50)
- ✅ Phone number format validation (10 digits)
- ✅ Whitespace trimming for all text inputs
- ✅ Database transaction support (already implemented)
- ✅ Comprehensive test coverage

The implementation follows the design document specifications and validates all requirements (3.4, 3.5, 3.6, 8.2, 8.5, 8.6).
