import axios from 'axios';
import { getEnv } from './env';

/**
 * Centralized API client for all backend requests.
 * - Base URL validated from env variable (see lib/env.ts)
 * - Automatically attaches JWT Bearer token from localStorage
 * - Handles 401 responses by clearing session and redirecting to login
 */
const API_BASE_URL = getEnv().apiUrl;

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

/**
 * Resolves a file reference to a full download URL.
 * Handles both:
 * - Relative R2 keys: "logos/123-abc.png" → "{API_BASE_URL}/storage/download/logos/123-abc.png"
 * - Legacy absolute URLs: "http://..." → returned as-is
 * This ensures images work across environments (localhost, devtunnel, production).
 */
function resolveFileUrl(fileRef: string | null | undefined): string | null {
  if (!fileRef) return null;
  // Already a full URL (legacy data) — return as-is
  if (fileRef.startsWith('http://') || fileRef.startsWith('https://')) return fileRef;
  // Relative key — build the download URL using current API base
  return `${API_BASE_URL}/storage/download/${fileRef}`;
}

export { API_BASE_URL, uploadFile, resolveFileUrl };
export default api;
