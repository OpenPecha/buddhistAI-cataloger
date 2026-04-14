let getAccessToken: (() => Promise<string | null>) | null = null;

/** Register how to obtain the Auth0 access token for catalog/settings API calls (same audience as outliner). */
export function setAccessTokenGetter(fn: (() => Promise<string | null>) | null): void {
  getAccessToken = fn;
}

/** Same as `fetch` but adds `Authorization: Bearer` when a getter is registered and returns a token. */
export async function fetchWithAccessToken(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (getAccessToken) {
    const token = await getAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }
  return fetch(input, { ...init, headers });
}
