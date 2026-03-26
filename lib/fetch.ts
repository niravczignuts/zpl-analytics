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

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    console.error(`fetchJSON: expected JSON but got ${contentType} for ${url}`);
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
