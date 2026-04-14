import { useCallback, useEffect } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { setOutlinerAccessTokenGetter } from '@/api/outliner'
import { getAuth0AccessToken } from '@/lib/auth0AccessToken'

/**
 * Wires Auth0 into `outlinerFetch` and `fetchWithAccessToken` so catalog, settings, and outliner
 * API calls send `Authorization: Bearer` (access token).
 * Must render under `Auth0Provider` with the same API audience as the backend `AUTH0_AUDIENCE`.
 */
export function OutlinerAuthBridge() {
  const { getAccessTokenSilently, isAuthenticated, logout } = useAuth0()

  const resolveToken = useCallback(
    () => getAuth0AccessToken(getAccessTokenSilently),
    [getAccessTokenSilently]
  )

  const refreshToken = useCallback(
    () =>
      getAuth0AccessToken(() =>
        getAccessTokenSilently({ cacheMode: 'off' })
      ),
    [getAccessTokenSilently]
  )

  const handleLogout = useCallback(() => {
    return logout({
      logoutParams: {
        returnTo: globalThis.location.origin + '/login',
      },
    })
  }, [logout])

  useEffect(() => {
    if (!isAuthenticated) {
      setOutlinerAccessTokenGetter(null)
      return () => setOutlinerAccessTokenGetter(null)
    }
    setOutlinerAccessTokenGetter(resolveToken, {
      refreshToken,
      logout: handleLogout,
    })
    return () => setOutlinerAccessTokenGetter(null)
  }, [isAuthenticated, resolveToken, refreshToken, handleLogout])

  return null
}
