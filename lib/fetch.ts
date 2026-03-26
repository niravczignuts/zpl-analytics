/**
 * Fetch JSON from an API route.
 * - On 401: redirects to /login (session expired)
 * - On non-JSON response: returns null instead of throwing SyntaxError
 */
export async function fetchJSON<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<T | null> {
  const res = await fetch(url, options);

  if (res.status === 401) {
    window.location.href = `/login?from=${encodeURIComponent(window.location.pathname)}`;
    return null;
  }

  // If redirected to login page (HTML), treat as 401
  const finalUrl = res.url || '';
  if (finalUrl.includes('/login')) {
    window.location.href = `/login?from=${encodeURIComponent(window.location.pathname)}`;
    return null;
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    console.error(`[fetchJSON] non-JSON response from ${url}: status=${res.status} content-type="${contentType}" finalUrl="${finalUrl}"`);
    return null;
  }

  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    console.error(`fetchJSON: invalid JSON from ${url}:`, text.slice(0, 100));
    return null;
  }
}
