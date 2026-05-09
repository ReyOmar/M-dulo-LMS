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
        window.location.href = '/login?revoked=true';
      }
    }
    return Promise.reject(error);
  },
);

/**
 * Upload a file via multipart/form-data (much faster than base64).
 * @param url - The endpoint to upload to (e.g., '/storage/upload')
 * @param file - The File object from an <input type="file">
 * @param fieldName - The form field name (default: 'file')
 * @returns The server response data
 */
async function uploadFile(url: string, file: File, fieldName = 'file') {
  const formData = new FormData();
  formData.append(fieldName, file);
  const res = await api.post(url, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    maxBodyLength: 50 * 1024 * 1024,
    maxContentLength: 50 * 1024 * 1024,
  });
  return res.data;
}

export { API_BASE_URL, uploadFile };
export default api;
