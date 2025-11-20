/* ============================================
   Collaborative Dev Platform - Main App JS
   ============================================ */

// API Configuration
const API_BASE_URL = 'http://localhost:3000/api';

// Global state
const AppState = {
  user: null,
  token: null,
  currentProject: null,
  isOnline: navigator.onLine,
  theme: localStorage.getItem('theme') || 'light',
};

// ============================================
// Utility Functions
// ============================================

// Make API requests
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers = {};
  
  // Don't set Content-Type for FormData
  if (!options.isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  
  // Add custom headers
  if (options.headers) {
    Object.assign(headers, options.headers);
  }
  
  // Add auth token if available
  if (AppState.token) {
    headers['Authorization'] = `Bearer ${AppState.token}`;
  }
  
  // Prepare request options
  const requestOptions = {
    ...options,
    headers,
  };
  
  // Convert body to JSON if not FormData
  if (options.body && !options.isFormData && typeof options.body === 'object') {
    requestOptions.body = JSON.stringify(options.body);
  }
  
  // Remove isFormData flag
  delete requestOptions.isFormData;
  
  try {
    const response = await fetch(url, requestOptions);
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }
    
    return data;
  } catch (error) {
    console.error('API request error:', error);
    if (error.message) {
      showToast(error.message, 'danger');
    }
    throw error;
  }
}

// Show toast notification
function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;
  
  const toastId = `toast-${Date.now()}`;
  const bgClass = `bg-${type}`;
  
  const toastHTML = `
    <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0" role="alert">
      <div class="d-flex">
        <div class="toast-body">
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>
  `;
  
  toastContainer.insertAdjacentHTML('beforeend', toastHTML);
  
  const toastElement = document.getElementById(toastId);
  const toast = new bootstrap.Toast(toastElement);
  toast.show();
  
  // Remove toast after it's hidden
  toastElement.addEventListener('hidden.bs.toast', () => {
    toastElement.remove();
  });
}

// Format date
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  // Less than 1 minute
  if (diff < 60000) {
    return 'Just now';
  }
  
  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }
  
  // Less than 1 day
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  
  // Less than 1 week
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  
  // Format as date
  return date.toLocaleDateString();
}

// Local storage helpers
const Storage = {
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Storage set error:', error);
    }
  },
  
  get(key) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Storage get error:', error);
      return null;
    }
  },
  
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Storage remove error:', error);
    }
  },
  
  clear() {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Storage clear error:', error);
    }
  }
};

// ============================================
// Authentication
// ============================================

// Check if user is logged in
function isAuthenticated() {
  const token = Storage.get('token');
  return !!token;
}

// Logout
function logout() {
  Storage.clear();
  AppState.user = null;
  AppState.token = null;
  window.location.href = 'index.html';
}

// ============================================
// Network Status
// ============================================

window.addEventListener('online', () => {
  AppState.isOnline = true;
  showToast('Connection restored', 'success');
});

window.addEventListener('offline', () => {
  AppState.isOnline = false;
  showToast('No internet connection', 'warning');
});

// ============================================
// Theme Management
// ============================================

function initTheme() {
  const theme = AppState.theme;
  document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
  const currentTheme = AppState.theme;
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  
  AppState.theme = newTheme;
  localStorage.setItem('theme', newTheme);
  document.documentElement.setAttribute('data-theme', newTheme);
  
  // Update toggle button icon if it exists
  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    const icon = toggleBtn.querySelector('i');
    if (icon) {
      icon.className = newTheme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
    }
  }
}

function createThemeToggle() {
  // Check if toggle already exists
  if (document.getElementById('theme-toggle')) return;
  
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'theme-toggle';
  toggleBtn.className = 'theme-toggle';
  toggleBtn.setAttribute('aria-label', 'Toggle dark mode');
  toggleBtn.innerHTML = `<i class="bi bi-${AppState.theme === 'dark' ? 'sun-fill' : 'moon-fill'}"></i>`;
  toggleBtn.onclick = toggleTheme;
  
  document.body.appendChild(toggleBtn);
}

// ============================================
// Initialize
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Initialize theme
  initTheme();
  
  // Load user token if exists
  const token = Storage.get('token');
  if (token) {
    AppState.token = token;
  }
  
  // Create toast container if it doesn't exist
  if (!document.getElementById('toast-container')) {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    document.body.appendChild(container);
  }
  
  // Create theme toggle button
  createThemeToggle();
  
  console.log('App initialized');
});

// Make functions globally available
window.toggleTheme = toggleTheme;
window.initTheme = initTheme;

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    apiRequest,
    showToast,
    formatDate,
    Storage,
    isAuthenticated,
    logout,
    toggleTheme,
    initTheme,
    AppState,
  };
}
