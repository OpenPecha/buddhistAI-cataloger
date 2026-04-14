/**
 * Obtain the Auth0 access token JWT for the API audience configured on Auth0Provider.
 */

export async function getAuth0AccessToken(
  getAccessTokenSilently: () => Promise<string>
): Promise<string | null> {
  try {
    const t = await getAccessTokenSilently()
    if (typeof t === 'string' && t.trim()) {
      return t.trim()
    }
  } catch {
    return null
  }
  return null
}
