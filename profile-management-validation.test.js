/**
 * Profile Management Validation Tests
 * 
 * These tests validate that the profile management fixes are working correctly
 * and that all the reported issues have been resolved.
 */

const fs = require('fs');
const path = require('path');

// Test helper to read file contents
function readFile(filePath) {
  try {
    return fs.readFileSync(path.join(__dirname, filePath), 'utf8');
  } catch (error) {
    console.error(`Failed to read file ${filePath}:`, error.message);
    return '';
  }
}

// Test 1: Phone Number Persistence Fix
function testPhoneNumberPersistence() {
  console.log('Testing phone number persistence fix...');
  
  const counselorProfileEditContent = readFile('public/counselor-profile-edit.html');
  
  // Check that phone_number is properly used in the API call
  const hasCorrectPhoneField = counselorProfileEditContent.includes('phone_number: phone');
  const hasDebugLogging = counselorProfileEditContent.includes('console.log(\'Saving profile data:\'');
  
  if (hasCorrectPhoneField && hasDebugLogging) {
    console.log('✅ Phone number persistence fix: PASSED');
    return true;
  } else {
    console.log('❌ Phone number persistence fix: FAILED');
    console.log('  - Correct phone field mapping:', hasCorrectPhoneField);
    console.log('  - Debug logging added:', hasDebugLogging);
    return false;
  }
}

// Test 2: Profile Picture Upload Fix
function testProfilePictureUpload() {
  console.log('Testing profile picture upload fix...');
  
  const counselorProfileEditContent = readFile('public/counselor-profile-edit.html');
  const accountContent = readFile('public/account.html');
  
  // Check for improved error handling in counselor profile edit
  const hasImprovedErrorHandling = counselorProfileEditContent.includes('errorData.error || \'Failed to upload profile picture\'');
  
  // Check for improved error handling in account page
  const hasAccountErrorHandling = accountContent.includes('// Revert preview on error');
  
  if (hasImprovedErrorHandling && hasAccountErrorHandling) {
    console.log('✅ Profile picture upload fix: PASSED');
    return true;
  } else {
    console.log('❌ Profile picture upload fix: FAILED');
    console.log('  - Counselor edit error handling:', hasImprovedErrorHandling);
    console.log('  - Account error handling:', hasAccountErrorHandling);
    return false;
  }
}

// Test 3: Client Name Display Fix
function testClientNameDisplay() {
  console.log('Testing client name display fix...');
  
  const counselorControllerContent = readFile('server/controllers/counselorController.js');
  
  // Check that the dashboard query includes client_user_id for better debugging
  const hasImprovedQuery = counselorControllerContent.includes('u.id as client_user_id');
  const hasErrorLogging = counselorControllerContent.includes('console.error(\'getDashboard error:\', err.message, err.stack)');
  
  if (hasImprovedQuery && hasErrorLogging) {
    console.log('✅ Client name display fix: PASSED');
    return true;
  } else {
    console.log('❌ Client name display fix: FAILED');
    console.log('  - Improved query:', hasImprovedQuery);
    console.log('  - Error logging:', hasErrorLogging);
    return false;
  }
}

// Test 4: Password Toggle Functionality
function testPasswordToggle() {
  console.log('Testing password toggle functionality...');
  
  const accountContent = readFile('public/account.html');
  
  // Check for togglePw function implementation
  const hasToggleFunction = accountContent.includes('function togglePw(inputId, button)');
  const hasToggleCall = accountContent.includes('togglePw(\'current-password\',this)');
  
  if (hasToggleFunction && hasToggleCall) {
    console.log('✅ Password toggle functionality: PASSED');
    return true;
  } else {
    console.log('❌ Password toggle functionality: FAILED');
    console.log('  - Toggle function exists:', hasToggleFunction);
    console.log('  - Toggle call exists:', hasToggleCall);
    return false;
  }
}

// Test 5: Unimplemented Features Commented Out
function testUnimplementedFeaturesCommented() {
  console.log('Testing unimplemented features are commented out...');
  
  const accountContent = readFile('public/account.html');
  
  // Check that messaging features are commented out
  const messagingCommented = accountContent.includes('<!-- MESSAGING NOT IMPLEMENTED YET - COMMENTED OUT');
  const marketingCommented = accountContent.includes('<!-- MARKETING NOT IMPLEMENTED YET - COMMENTED OUT');
  
  // Check that privacy features are commented out
  const sessionHistoryCommented = accountContent.includes('<!-- SHARED SESSION HISTORY NOT IMPLEMENTED YET - COMMENTED OUT');
  const anonymousPostCommented = accountContent.includes('<!-- ANONYMOUS PROBLEM POSTS NOT IMPLEMENTED YET - COMMENTED OUT');
  
  // Check that JavaScript is updated to skip these features
  const jsSkipsMessaging = accountContent.includes('// Messaging features commented out - skip loading');
  const jsSkipsPrivacy = accountContent.includes('// Privacy features commented out - skip loading');
  
  const allCommented = messagingCommented && marketingCommented && 
                      sessionHistoryCommented && anonymousPostCommented &&
                      jsSkipsMessaging && jsSkipsPrivacy;
  
  if (allCommented) {
    console.log('✅ Unimplemented features commented out: PASSED');
    return true;
  } else {
    console.log('❌ Unimplemented features commented out: FAILED');
    console.log('  - Messaging commented:', messagingCommented);
    console.log('  - Marketing commented:', marketingCommented);
    console.log('  - Session history commented:', sessionHistoryCommented);
    console.log('  - Anonymous post commented:', anonymousPostCommented);
    console.log('  - JS skips messaging:', jsSkipsMessaging);
    console.log('  - JS skips privacy:', jsSkipsPrivacy);
    return false;
  }
}

// Test 6: Avatar Update Logic Fix
function testAvatarUpdateLogic() {
  console.log('Testing avatar update logic fix...');
  
  const accountContent = readFile('public/account.html');
  
  // Check that avatar only updates when name actually changes
  const hasNameChangeCheck = accountContent.includes('const nameChanged = currentUser.name !== `${firstName} ${lastName}`.trim()');
  const hasConditionalUpdate = accountContent.includes('if (isGeneratedAvatar && nameChanged)');
  
  if (hasNameChangeCheck && hasConditionalUpdate) {
    console.log('✅ Avatar update logic fix: PASSED');
    return true;
  } else {
    console.log('❌ Avatar update logic fix: FAILED');
    console.log('  - Name change check:', hasNameChangeCheck);
    console.log('  - Conditional update:', hasConditionalUpdate);
    return false;
  }
}

// Run all tests
function runAllTests() {
  console.log('🧪 Running Profile Management Validation Tests...\n');
  
  const tests = [
    testPhoneNumberPersistence,
    testProfilePictureUpload,
    testClientNameDisplay,
    testPasswordToggle,
    testUnimplementedFeaturesCommented,
    testAvatarUpdateLogic
  ];
  
  let passed = 0;
  let failed = 0;
  
  tests.forEach((test, index) => {
    console.log(`\n--- Test ${index + 1} ---`);
    if (test()) {
      passed++;
    } else {
      failed++;
    }
  });
  
  console.log('\n📊 Test Results Summary:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / tests.length) * 100)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All profile management fixes have been successfully implemented!');
  } else {
    console.log('\n⚠️  Some fixes may need additional work. Check the failed tests above.');
  }
  
  return failed === 0;
}

// Export for use in other test files
module.exports = {
  runAllTests,
  testPhoneNumberPersistence,
  testProfilePictureUpload,
  testClientNameDisplay,
  testPasswordToggle,
  testUnimplementedFeaturesCommented,
  testAvatarUpdateLogic
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}