import axios, { AxiosError } from 'axios';

/**
 * Single HTTP entry point for the SPA.
 *
 * - `baseURL` is a same-origin path (`/api/v1`), proxied to the API by Vite in
 *   development and by the reverse proxy in production.
 * - `withCredentials` lets the httpOnly session cookie flow.
 * - Every failure is normalised into an ApiRequestError so components can show
 *   a field-level message or a toast without inspecting axios internals.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  withCredentials: true,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

export interface FieldErrors {
  [field: string]: string[];
}

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: FieldErrors,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }

  /** True when the user must sign in again. */
  get isAuthError() {
    return this.status === 401;
  }
}

function normalise(err: AxiosError<any>): ApiRequestError {
  if (err.response) {
    const payload = err.response.data?.error ?? {};
    return new ApiRequestError(
      err.response.status,
      payload.code ?? 'request_failed',
      payload.message ?? 'Something went wrong. Please try again.',
      payload.details,
    );
  }
  if (err.code === 'ECONNABORTED') {
    return new ApiRequestError(408, 'timeout', 'The request took too long. Check your connection and try again.');
  }
  return new ApiRequestError(0, 'offline', 'Cannot reach the server. Check your connection and try again.');
}

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError<any>) => Promise.reject(normalise(err)),
);

/** Convenience wrappers that unwrap axios' response envelope. */
export const http = {
  get: async <T>(url: string, params?: Record<string, unknown>): Promise<T> =>
    (await api.get<T>(url, { params })).data,
  post: async <T>(url: string, body?: unknown): Promise<T> => (await api.post<T>(url, body)).data,
  put: async <T>(url: string, body?: unknown): Promise<T> => (await api.put<T>(url, body)).data,
  patch: async <T>(url: string, body?: unknown): Promise<T> => (await api.patch<T>(url, body)).data,
  delete: async <T>(url: string): Promise<T> => (await api.delete<T>(url)).data,
};

/**
 * Maps a 401 anywhere in the app to a redirect to the sign-in page.
 * Registered by AuthProvider so the interceptor stays framework-agnostic.
 */
export function onUnauthorized(handler: () => void): () => void {
  const id = api.interceptors.response.use(undefined, (err: unknown) => {
    if (err instanceof ApiRequestError && err.isAuthError) handler();
    return Promise.reject(err);
  });
  // Returns a cleanup so callers (React effects) can unregister on unmount.
  return () => api.interceptors.response.eject(id);
}
