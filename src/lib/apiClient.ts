const API_BASE = `${process.env.EXPO_PUBLIC_API_URL}/api/v1`;

// Mirrors FastAPI's { detail: ... } error body - detail is usually a string,
// but a 422 validation error returns an array of field errors instead.
export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(typeof detail === 'string' ? detail : `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

type ApiFetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  // Pass the token explicitly rather than reading it from storage here, so
  // this file never needs to know about SecureStore - see src/state/AuthContext.tsx.
  token?: string;
  body?: unknown;
};

// The one place a request is built and an Authorization header attached -
// see docs/Rules.md -> "Auth": never construct this header ad hoc in a screen.
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { method = 'GET', token, body } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(response.status, data && typeof data === 'object' && 'detail' in data ? data.detail : data);
  }

  return data as T;
}
