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

// Response interceptor — handle 401/403/429 centrally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401 && typeof window !== 'undefined') {
      // Only redirect if not already on login page
      if (!window.location.pathname.includes('/login')) {
        // F10.2: Clean ALL LMS-related localStorage keys
        const keysToRemove = Object.keys(localStorage).filter((k) => k.startsWith('lms_'));
        keysToRemove.forEach((k) => localStorage.removeItem(k));

        // Differentiate between active revocation and normal token expiry.
        const serverMessage = (error.response?.data?.message || '').toLowerCase();
        const isActiveRevocation =
          serverMessage.includes('revocada') ||
          serverMessage.includes('eliminada') ||
          serverMessage.includes('desactivada');

        const isOnDashboard = window.location.pathname.startsWith('/dashboard');
        if (isOnDashboard) {
          window.location.href = isActiveRevocation ? '/login?revoked=true' : '/login?expired=true';
        } else if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    // F10.4: Rate limiting — log but don't redirect
    if (status === 429 && typeof window !== 'undefined') {
      const retryAfter = error.response?.headers?.['retry-after'] || '60';
      error.message = `Demasiadas solicitudes. Intenta de nuevo en ${retryAfter} segundos.`;
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
 *
 * Security model:
 * - Public folders (portadas, logos, avatars) → /download/public/* (no auth, safe for <img src>)
 * - Private folders (entregas, firmas, certificados, recursos) → /download/* with JWT query param
 *
 * Private files include the JWT token as a query parameter since <a href> and <img src>
 * cannot send Authorization headers. The backend only accepts query tokens on
 * /storage/download/ routes (scoped, industry-standard pattern like S3 presigned URLs).
 */
const PUBLIC_FOLDERS = ['portadas', 'logos', 'avatars'];

function resolveFileUrl(fileRef: string | null | undefined): string | null {
  if (!fileRef) return null;
  // Already a full URL (legacy data) — return as-is
  if (fileRef.startsWith('http://') || fileRef.startsWith('https://')) return fileRef;

  const folder = fileRef.split('/')[0];
  const isPublic = PUBLIC_FOLDERS.includes(folder);

  if (isPublic) {
    return `${API_BASE_URL}/storage/download/public/${fileRef}`;
  }

  // Private files: attach JWT token for browser-native requests (<a href>, <img src>)
  const token = typeof window !== 'undefined' ? localStorage.getItem('lms_token') : null;
  const base = `${API_BASE_URL}/storage/download/${fileRef}`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

/**
 * Builds a complete download URL for <a href> links.
 * Combines resolveFileUrl() with an optional originalName for Content-Disposition.
 * Handles token injection for private files automatically.
 */
function resolveDownloadUrl(fileRef: string | null | undefined, originalName?: string): string | null {
  if (!fileRef) return null;
  if (fileRef.startsWith('http://') || fileRef.startsWith('https://')) return fileRef;

  const folder = fileRef.split('/')[0];
  const isPublic = PUBLIC_FOLDERS.includes(folder);
  const prefix = isPublic ? 'storage/download/public' : 'storage/download';
  const base = `${API_BASE_URL}/${prefix}/${fileRef}`;

  const params = new URLSearchParams();
  if (originalName) params.set('originalName', originalName);
  if (!isPublic) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('lms_token') : null;
    if (token) params.set('token', token);
  }

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export { API_BASE_URL, uploadFile, resolveFileUrl, resolveDownloadUrl };
export default api;
