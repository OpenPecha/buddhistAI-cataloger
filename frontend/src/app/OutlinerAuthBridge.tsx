import { useCallback, useEffect } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { setOutlinerAccessTokenGetter } from '@/api/outliner'
import { getAuth0AccessToken } from '@/lib/auth0AccessToken'
import { setClarityUserId, setClarityMetadata } from '@/lib/clarity'

/**
 * Wires Auth0 into `outlinerFetch` and `fetchWithAccessToken` so catalog, settings, and outliner
 * API calls send `Authorization: Bearer` (access token).
 * Must render under `Auth0Provider` with the same API audience as the backend `AUTH0_AUDIENCE`.
 */
export function OutlinerAuthBridge() {
  const { getAccessTokenSilently, isAuthenticated, logout, user } = useAuth0()

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

    // Set user ID in Clarity for session tracking
    // Use a small delay to ensure Clarity is fully initialized
    if (user?.sub) {
      const timeout = setTimeout(() => {
        setClarityUserId(user.sub)
        // Also set email as metadata if available
        if (user?.email) {
          setClarityMetadata('email', user.email)
        }
        // Set user name as metadata if available
        if (user?.name) {
          setClarityMetadata('name', user.name)
        }
      }, 500)

      return () => {
        clearTimeout(timeout)
        setOutlinerAccessTokenGetter(null)
      }
    }

    return () => setOutlinerAccessTokenGetter(null)
  }, [isAuthenticated, resolveToken, refreshToken, handleLogout, user?.sub, user?.email, user?.name])

  return null
}
