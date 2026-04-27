import axios from 'axios';

/**
 * Centralized API client for all backend requests.
 * - Base URL configured from env variable
 * - Automatically attaches JWT Bearer token from localStorage
 * - Handles 401 responses by clearing session and redirecting to login
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3200/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach JWT token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('lms_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor — handle 401 by clearing session
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Only redirect if not already on login page
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('lms_token');
        localStorage.removeItem('lms_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export { API_BASE_URL };
export default api;
