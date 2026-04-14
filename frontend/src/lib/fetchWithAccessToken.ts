type RegisteredAuth = {
  resolveToken: () => Promise<string | null>;
  refreshToken?: () => Promise<string | null>;
  logout?: () => void | Promise<void>;
};

let registered: RegisteredAuth | null = null;
let logoutInFlight = false;

async function runLogout(logout: () => void | Promise<void>): Promise<void> {
  if (logoutInFlight) return;
  logoutInFlight = true;
  try {
    await logout();
  } catch {
    /* Auth0 redirect may reject; still avoid duplicate logout storms */
  }
}

/** Register how to obtain the Auth0 access token for catalog/settings API calls (same audience as outliner). */
export function setAccessTokenGetter(
  resolveToken: (() => Promise<string | null>) | null,
  extras?: { refreshToken?: () => Promise<string | null>; logout?: () => void | Promise<void> }
): void {
  if (!resolveToken) {
    registered = null;
    return;
  }
  registered = {
    resolveToken,
    refreshToken: extras?.refreshToken,
    logout: extras?.logout,
  };
}

/** Same as `fetch` but adds `Authorization: Bearer` when a getter is registered and returns a token. */
export async function fetchWithAccessToken(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (registered) {
    const token = await registered.resolveToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  let response = await fetch(input, { ...init, headers });

  if (
    response.status === 401 &&
    registered?.refreshToken &&
    registered.logout
  ) {
    const fresh = await registered.refreshToken();
    if (!fresh) {
      await runLogout(registered.logout);
      return response;
    }
    const retryHeaders = new Headers(init?.headers);
    retryHeaders.set('Authorization', `Bearer ${fresh}`);
    response = await fetch(input, { ...init, headers: retryHeaders });
  }

  return response;
}
