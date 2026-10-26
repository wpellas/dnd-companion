/** Thin client for the Laravel API (same origin: Vite proxies `/api` in development, the web server does in production). */

export class ApiError extends Error {
  status: number
  /** Field -> first message, for validation errors (422) */
  fields: Record<string, string>
  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

/** Laravel sets an XSRF-TOKEN cookie and wants it back in a header on every write. */
const xsrf = () => decodeURIComponent(document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/)?.[1] ?? '')

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  // a FormData body (a file upload) sets its own Content-Type with the multipart boundary
  const form = body instanceof FormData
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...(body === undefined || form ? {} : { 'Content-Type': 'application/json' }), 'X-XSRF-TOKEN': xsrf() },
      body: body === undefined ? undefined : form ? body : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'offline')
  }
  const json = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    const errors = (json?.errors ?? {}) as Record<string, string[]>
    throw new ApiError(res.status, json?.message ?? res.statusText, Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v[0]])))
  }
  return json as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
