// ========================================
// COMFORT COUNSEL - MAIN JAVASCRIPT
// ========================================

// Mobile Navigation Toggle
document.addEventListener('DOMContentLoaded', () => {
  const navToggle = document.getElementById('nav-toggle');
  const navMenu = document.getElementById('nav-menu');
  
  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      navMenu.classList.toggle('open');
    });
  }
  
  // Check authentication status
  checkAuthStatus();
  
  // Add click handlers to counselor cards
  setupCounselorCardLinks();
  
  // Setup search functionality
  setupSearch();
});

// Check if user is logged in
function checkAuthStatus() {
  const token = localStorage.getItem('cc_token');
  const userStr = localStorage.getItem('cc_user');
  
  const loginBtn = document.getElementById('nav-login');
  const registerBtn = document.getElementById('nav-register');
  const logoutBtn = document.getElementById('nav-logout');
  const sessionsLink = document.getElementById('nav-sessions');
  const accountLink = document.getElementById('nav-account');
  
  // DEFAULT STATE (Not Logged In): Show Login & Sign Up, Hide everything else
  if (loginBtn) loginBtn.style.display = 'inline-block';
  if (registerBtn) registerBtn.style.display = 'inline-block';
  if (logoutBtn) logoutBtn.style.display = 'none';
  if (sessionsLink) sessionsLink.style.display = 'none';
  if (accountLink) accountLink.style.display = 'none';
  
  if (token && userStr) {
    // LOGGED IN STATE: Hide Login & Sign Up, Show Sessions, Account, and Logout
    try {
      const userData = JSON.parse(userStr);
      
      // Hide login/register
      if (loginBtn) loginBtn.style.display = 'none';
      if (registerBtn) registerBtn.style.display = 'none';
      
      // Show sessions, account, logout
      if (sessionsLink) sessionsLink.style.display = 'inline-block';
      if (accountLink) {
        accountLink.style.display = 'inline-block';
        // Update account link text to "My Account"
        accountLink.textContent = 'My Account';
      }
      if (logoutBtn) logoutBtn.style.display = 'inline-block';
      
      // Return user data for use in pages
      return userData;
    } catch (e) {
      console.error('Error parsing user data:', e);
      // Clear invalid data
      localStorage.removeItem('cc_token');
      localStorage.removeItem('cc_user');
      // Buttons already shown above in default state
    }
  }
  
  return null;
}

// Setup counselor card links
function setupCounselorCardLinks() {
  const counselorCards = document.querySelectorAll('.counselor-card');
  
  counselorCards.forEach((card, index) => {
    const viewProfileBtn = card.querySelector('.btn-view-profile');
    if (viewProfileBtn) {
      viewProfileBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // Get counselor name from card
        const counselorName = card.querySelector('.counselor-name')?.textContent || '';
        const counselorId = index + 1;
        window.location.href = `counselor-profile-new.html?id=${counselorId}&name=${encodeURIComponent(counselorName)}`;
      });
    }
  });
  
  // Also make contact buttons work
  const contactButtons = document.querySelectorAll('.btn-contact');
  contactButtons.forEach((btn, index) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const counselorId = index + 1;
      window.location.href = `counselor-profile-new.html?id=${counselorId}`;
    });
  });
}

// Setup search functionality
function setupSearch() {
  const isHomePage = !!document.getElementById('hero-search');
  const isFindPage = !!document.getElementById('counselor-search');
  
  if (isHomePage) {
    // HOME PAGE: search setup is handled by setupHomeSearch() in index.html
    // Nothing to do here to avoid duplicate event listeners
    
  } else if (isFindPage) {
    // FIND-COUNSELORS PAGE: search filters in place (handled by setupFilters in that page's script)
    // Nothing to do here — find-counselors.html has its own inline script
  }
}

/**
 * Redirect to find-counselors page with optional search query
 * Validates: Requirements 1.1, 1.2, 1.3, 1.5
 * 
 * @param {string} query - Search query (optional)
 */
function redirectToFindCounselors(query) {
  if (query) {
    window.location.href = `find-counselors.html?search=${encodeURIComponent(query)}`;
  } else {
    window.location.href = 'find-counselors.html';
  }
}

// ========================================
// API CLIENT UTILITIES
// ========================================

/**
 * Centralized API request handler with authentication
 * Validates: Requirements 6.7, 7.6, 12.1, 12.2, 12.4, 12.6
 * 
 * @param {string} endpoint - API endpoint path (e.g., '/api/counselors/123')
 * @param {object} options - Fetch options (method, body, headers, etc.)
 * @returns {Promise<object>} - Parsed JSON response
 * @throws {Error} - On network, authentication, or API errors
 */
async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('cc_token');
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  };
  
  const config = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    }
  };
  
  try {
    const response = await fetch(endpoint, config);
    
    // Guard against HTML error pages (404/500 from server)
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.error('API Error: Unexpected response format', {
        status: response.status,
        contentType,
        endpoint
      });
      throw new Error(`Server error (${response.status}): unexpected response format`);
    }
    
    const data = await response.json();
    
    // Handle unauthorized (expired or invalid token)
    if (response.status === 401) {
      console.warn('Authentication failed: Token expired or invalid');
      removeAuthToken();
      window.location.href = 'login.html?session=expired';
      throw new Error('Session expired. Please login again.');
    }
    
    // Handle forbidden (insufficient permissions)
    if (response.status === 403) {
      console.warn('Authorization failed: Insufficient permissions');
      throw new Error('You do not have permission to perform this action.');
    }
    
    // Handle not found
    if (response.status === 404) {
      console.warn('Resource not found:', endpoint);
      throw new Error(data.error || 'Resource not found.');
    }
    
    // Handle other errors
    if (!response.ok) {
      console.error('API Error:', {
        status: response.status,
        endpoint,
        error: data.error || data.message
      });
      throw new Error(data.error || data.message || 'Request failed');
    }
    
    return data;
  } catch (error) {
    // Handle network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.error('Network Error: Unable to connect to server', error);
      throw new Error('Unable to connect to server. Please check your internet connection.');
    }
    
    // Handle timeout errors
    if (error.name === 'AbortError') {
      console.error('Request Timeout:', endpoint, error);
      throw new Error('Request timed out. Please try again.');
    }
    
    // Re-throw other errors
    throw error;
  }
}

// ========================================
// JWT TOKEN MANAGEMENT
// ========================================

/**
 * Store JWT token in localStorage
 * Validates: Requirement 12.1
 * 
 * @param {string} token - JWT token from login response
 */
function storeAuthToken(token) {
  if (!token || typeof token !== 'string') {
    console.error('Invalid token provided to storeAuthToken');
    return;
  }
  localStorage.setItem('cc_token', token);
}

/**
 * Retrieve JWT token from localStorage
 * Validates: Requirement 12.2
 * 
 * @returns {string|null} - JWT token or null if not found
 */
function getAuthToken() {
  return localStorage.getItem('cc_token');
}

/**
 * Remove JWT token from localStorage
 * Validates: Requirement 12.4
 */
function removeAuthToken() {
  localStorage.removeItem('cc_token');
  localStorage.removeItem('cc_user');
}

/**
 * Store user data in localStorage
 * Validates: Requirement 12.5
 * 
 * @param {object} user - User data object
 */
function storeUserData(user) {
  if (!user || typeof user !== 'object') {
    console.error('Invalid user data provided to storeUserData');
    return;
  }
  localStorage.setItem('cc_user', JSON.stringify(user));
}

/**
 * Update user data in localStorage (for profile updates)
 * Validates: Requirement 12.5
 * 
 * @param {object} updates - Partial user data to update
 */
function updateUserData(updates) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    console.warn('No user data found to update');
    return;
  }
  const updatedUser = { ...currentUser, ...updates };
  storeUserData(updatedUser);
}

// ========================================
// AUTHENTICATION HELPERS
// ========================================

/**
 * Get current user from localStorage
 * Validates: Requirement 12.2
 * 
 * @returns {object|null} - User data object or null if not found/invalid
 */
function getCurrentUser() {
  const userStr = localStorage.getItem('cc_user');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch (e) {
      console.error('Error parsing user data:', e);
      removeAuthToken(); // Clear invalid data
      return null;
    }
  }
  return null;
}

/**
 * Check if user is authenticated
 * Validates: Requirement 12.2
 * 
 * @returns {boolean} - True if JWT token exists in localStorage
 */
function isAuthenticated() {
  return !!getAuthToken();
}

/**
 * Redirect user to appropriate dashboard based on their role
 * This should be called on pages where role-based redirection is needed
 * 
 * @param {string} fallbackUrl - URL to redirect to if not authenticated (default: 'login.html')
 * @returns {boolean} - True if user stays on current page, false if redirecting
 */
function handleRoleBasedRedirection(fallbackUrl = 'login.html') {
  const token = getAuthToken();
  const user = getCurrentUser();
  
  if (!token || !user) {
    // Not authenticated, redirect to login
    window.location.href = fallbackUrl;
    return false;
  }
  
  // Get current page
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  
  // Define role-based dashboard mappings
  const dashboardMappings = {
    'admin': 'admin.html',
    'counselor': 'counselor-dashboard.html',
    'user': 'index.html'
  };
  
  const targetPage = dashboardMappings[user.role] || dashboardMappings['user'];
  
  // If user is not on their intended dashboard page, redirect them
  if (currentPage !== targetPage) {
    window.location.href = targetPage;
    return false;
  }
  
  return true;
}

/**
 * Require authentication (redirect if not logged in)
 * Validates: Requirements 7.1, 7.2, 7.6, 12.3
 * 
 * @param {string} redirectUrl - URL to redirect to if not authenticated (default: 'login.html')
 * @returns {boolean} - True if authenticated, false if redirecting
 */
function requireAuth(redirectUrl = 'login.html') {
  if (!isAuthenticated()) {
    const currentPage = window.location.pathname.split('/').pop();
    window.location.href = `${redirectUrl}?redirect=${currentPage}`;
    return false;
  }
  return true;
}

/**
 * Require specific role (redirect if user doesn't have required role)
 * Validates: Requirements 7.1, 7.4
 * 
 * @param {string} requiredRole - Required role ('user', 'counselor', 'admin')
 * @param {string} redirectUrl - URL to redirect to if role doesn't match (default: 'index.html')
 * @returns {boolean} - True if user has required role, false if redirecting
 */
function requireRole(requiredRole, redirectUrl = 'index.html') {
  if (!requireAuth()) {
    return false; // Already redirecting to login
  }
  
  const user = getCurrentUser();
  if (!user || user.role !== requiredRole) {
    console.warn(`Access denied: Required role '${requiredRole}', user has '${user?.role || 'none'}'`);
    window.location.href = redirectUrl;
    return false;
  }
  
  return true;
}

/**
 * Logout user (clear session and redirect)
 * Validates: Requirement 12.4
 */
function logout() {
  removeAuthToken();
  window.location.href = 'index.html';
}

// ========================================
// TOAST NOTIFICATION SYSTEM
// ========================================

/**
 * Show toast notification for user feedback
 * Validates: Requirements 3.8, 4.7, 5.8, 9.2, 9.3
 * 
 * @param {string} message - Message to display
 * @param {string} type - Toast type: 'success', 'error', 'info', 'warning'
 * @param {number} duration - Duration in milliseconds (default: 3000)
 */
function showToast(message, type = 'info', duration = 3000) {
  // Remove any existing toasts
  const existingToasts = document.querySelectorAll('.cc-toast');
  existingToasts.forEach(toast => toast.remove());
  
  const toast = document.createElement('div');
  toast.className = `cc-toast cc-toast-${type}`;
  toast.textContent = message;
  
  // Toast styling
  const colors = {
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#6366F1'
  };
  
  toast.style.cssText = `
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    padding: 1rem 1.5rem;
    background: ${colors[type] || colors.info};
    color: white;
    border-radius: 0.5rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    z-index: 10000;
    font-size: 0.875rem;
    font-weight: 500;
    max-width: 400px;
    animation: cc-slideIn 0.3s ease;
    pointer-events: auto;
  `;
  
  document.body.appendChild(toast);
  
  // Auto-remove after duration
  setTimeout(() => {
    toast.style.animation = 'cc-slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Format currency (GHS)
 * 
 * @param {number} amount - Amount to format
 * @returns {string} - Formatted currency string
 */
function formatCurrency(amount) {
  return `GHS ${amount.toLocaleString()}`;
}

/**
 * Format date
 * 
 * @param {string} dateString - ISO date string
 * @returns {string} - Formatted date string
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

/**
 * Format time
 * 
 * @param {string} dateString - ISO date string
 * @returns {string} - Formatted time string
 */
function formatTime(dateString) {
  const date = new Date(dateString);
  const options = { hour: '2-digit', minute: '2-digit' };
  return date.toLocaleTimeString('en-US', options);
}

/**
 * Validate email format
 * Validates: Requirement 8.3
 * 
 * @param {string} email - Email address to validate
 * @returns {boolean} - True if valid email format
 */
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone format (10 digits)
 * Validates: Requirement 8.4
 * 
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid phone format
 */
function validatePhone(phone) {
  const phoneRegex = /^\d{10}$/;
  return phoneRegex.test(phone);
}

/**
 * Generate avatar URL (with fallback to ui-avatars.com)
 * Validates: Requirements 10.2, 10.3, 10.4, 10.5, 10.6
 * 
 * @param {string} name - User/counselor name
 * @param {string|null} profilePicture - Profile picture URL (optional)
 * @param {string} context - Context for sizing: 'list' (200x200) or 'profile' (400x400)
 * @returns {string} - Avatar URL
 */
function getAvatarUrl(name, profilePicture = null, context = 'profile') {
  if (profilePicture) {
    return profilePicture;
  }
  
  const size = context === 'list' ? 200 : 400;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366F1&color=fff&size=${size}`;
}

// ========================================
// CSS ANIMATIONS
// ========================================

// Add CSS animations for toast notifications
const style = document.createElement('style');
style.textContent = `
  @keyframes cc-slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes cc-slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
  
  .cc-toast {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }
`;
document.head.appendChild(style);

// ========================================
// GLOBAL EXPORT (ComfortCounsel namespace)
// ========================================

/**
 * Export all utility functions under ComfortCounsel namespace
 * for use in other scripts across the application
 */
window.ComfortCounsel = {
  // API Client
  apiRequest,
  
  // Token Management
  storeAuthToken,
  getAuthToken,
  removeAuthToken,
  storeUserData,
  updateUserData,
  
  // Authentication Helpers
  getCurrentUser,
  isAuthenticated,
  requireAuth,
  requireRole,
  logout,
  handleRoleBasedRedirection,
  
  // UI Helpers
  showToast,
  checkAuthStatus,
  
  // Formatting Utilities
  formatCurrency,
  formatDate,
  formatTime,
  
  // Validation Utilities
  validateEmail,
  validatePhone,
  
  // Avatar Utilities
  getAvatarUrl,
  
  // Search Utilities
  redirectToFindCounselors
};

