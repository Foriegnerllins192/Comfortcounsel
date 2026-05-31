/**
 * Simple verification script for Task 1 completion
 * Checks that all required functions exist in script.js
 */

const fs = require('fs');
const path = require('path');

// Read the script.js file
const scriptPath = path.join(__dirname, 'public', 'script.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

console.log('='.repeat(80));
console.log('TASK 1 VERIFICATION: API Client Utilities and Authentication Helpers');
console.log('='.repeat(80));
console.log('');

const checks = [
  {
    name: 'API Request Handler (apiRequest)',
    pattern: /async function apiRequest\(endpoint, options = \{\}\)/,
    requirement: '6.7, 7.6, 12.1, 12.2, 12.4, 12.6'
  },
  {
    name: 'Store Auth Token (storeAuthToken)',
    pattern: /function storeAuthToken\(token\)/,
    requirement: '12.1'
  },
  {
    name: 'Get Auth Token (getAuthToken)',
    pattern: /function getAuthToken\(\)/,
    requirement: '12.2'
  },
  {
    name: 'Remove Auth Token (removeAuthToken)',
    pattern: /function removeAuthToken\(\)/,
    requirement: '12.4'
  },
  {
    name: 'Store User Data (storeUserData)',
    pattern: /function storeUserData\(user\)/,
    requirement: '12.5'
  },
  {
    name: 'Update User Data (updateUserData)',
    pattern: /function updateUserData\(updates\)/,
    requirement: '12.5'
  },
  {
    name: 'Get Current User (getCurrentUser)',
    pattern: /function getCurrentUser\(\)/,
    requirement: '12.2'
  },
  {
    name: 'Is Authenticated (isAuthenticated)',
    pattern: /function isAuthenticated\(\)/,
    requirement: '12.2'
  },
  {
    name: 'Require Auth (requireAuth)',
    pattern: /function requireAuth\(redirectUrl = 'login\.html'\)/,
    requirement: '7.1, 7.2, 7.6, 12.3'
  },
  {
    name: 'Require Role (requireRole)',
    pattern: /function requireRole\(requiredRole, redirectUrl = 'index\.html'\)/,
    requirement: '7.1, 7.4'
  },
  {
    name: 'Logout (logout)',
    pattern: /function logout\(\)/,
    requirement: '12.4'
  },
  {
    name: 'Show Toast (showToast)',
    pattern: /function showToast\(message, type = 'info', duration = 3000\)/,
    requirement: '3.8, 4.7, 5.8, 9.2, 9.3'
  },
  {
    name: 'Validate Email (validateEmail)',
    pattern: /function validateEmail\(email\)/,
    requirement: '8.3'
  },
  {
    name: 'Validate Phone (validatePhone)',
    pattern: /function validatePhone\(phone\)/,
    requirement: '8.4'
  },
  {
    name: 'Get Avatar URL (getAvatarUrl)',
    pattern: /function getAvatarUrl\(name, profilePicture = null, context = 'profile'\)/,
    requirement: '10.2, 10.3, 10.4, 10.5, 10.6'
  },
  {
    name: 'ComfortCounsel Namespace Export',
    pattern: /window\.ComfortCounsel = \{/,
    requirement: 'Global export'
  }
];

let passed = 0;
let failed = 0;

checks.forEach(check => {
  const found = check.pattern.test(scriptContent);
  if (found) {
    console.log(`✅ ${check.name}`);
    console.log(`   Requirements: ${check.requirement}`);
    passed++;
  } else {
    console.log(`❌ ${check.name}`);
    console.log(`   Requirements: ${check.requirement}`);
    failed++;
  }
  console.log('');
});

console.log('='.repeat(80));
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('='.repeat(80));
console.log('');

// Additional checks for specific features
console.log('ADDITIONAL FEATURE CHECKS:');
console.log('');

const featureChecks = [
  {
    name: 'JWT Token in Authorization Header',
    pattern: /'Authorization': `Bearer \$\{token\}`/
  },
  {
    name: 'Handle 401 Unauthorized',
    pattern: /if \(response\.status === 401\)/
  },
  {
    name: 'Handle 403 Forbidden',
    pattern: /if \(response\.status === 403\)/
  },
  {
    name: 'Handle 404 Not Found',
    pattern: /if \(response\.status === 404\)/
  },
  {
    name: 'Handle Network Errors',
    pattern: /if \(error\.name === 'TypeError' && error\.message\.includes\('fetch'\)\)/
  },
  {
    name: 'Handle Timeout Errors',
    pattern: /if \(error\.name === 'AbortError'\)/
  },
  {
    name: 'Validate JSON Response',
    pattern: /const contentType = response\.headers\.get\('content-type'\)/
  },
  {
    name: 'Toast Animation Styles',
    pattern: /@keyframes cc-slideIn/
  },
  {
    name: 'Remove Existing Toasts',
    pattern: /const existingToasts = document\.querySelectorAll\('\.cc-toast'\)/
  }
];

let featurePassed = 0;
let featureFailed = 0;

featureChecks.forEach(check => {
  const found = check.pattern.test(scriptContent);
  if (found) {
    console.log(`✅ ${check.name}`);
    featurePassed++;
  } else {
    console.log(`❌ ${check.name}`);
    featureFailed++;
  }
});

console.log('');
console.log('='.repeat(80));
console.log(`FEATURE CHECKS: ${featurePassed} passed, ${featureFailed} failed`);
console.log('='.repeat(80));
console.log('');

// Final summary
if (failed === 0 && featureFailed === 0) {
  console.log('🎉 TASK 1 COMPLETE! All required functions and features are implemented.');
  console.log('');
  console.log('Summary:');
  console.log('  ✅ Centralized API request handler with authentication');
  console.log('  ✅ JWT token management (store, retrieve, remove)');
  console.log('  ✅ Authentication check and redirect functions');
  console.log('  ✅ Toast notification system for user feedback');
  console.log('  ✅ Error handling for network, auth, and API errors');
  console.log('  ✅ Input validation utilities');
  console.log('  ✅ Global ComfortCounsel namespace export');
  console.log('');
  process.exit(0);
} else {
  console.log('❌ TASK 1 INCOMPLETE. Some required functions or features are missing.');
  console.log('');
  process.exit(1);
}
