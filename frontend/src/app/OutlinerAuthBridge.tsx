import { useEffect } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { setOutlinerAccessTokenGetter } from '@/api/outliner'
import { getAuth0AccessToken } from '@/lib/auth0AccessToken'

/**
 * Wires Auth0 into `outlinerFetch` and `fetchWithAccessToken` so catalog, settings, and outliner
 * API calls send `Authorization: Bearer` (access token).
 * Must render under `Auth0Provider` with the same API audience as the backend `AUTH0_AUDIENCE`.
 */
export function OutlinerAuthBridge() {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0()

  useEffect(() => {
    if (!isAuthenticated) {
      setOutlinerAccessTokenGetter(null)
      return () => setOutlinerAccessTokenGetter(null)
    }
    const getter = () => getAuth0AccessToken(getAccessTokenSilently)
    setOutlinerAccessTokenGetter(getter)
    return () => setOutlinerAccessTokenGetter(null)
  }, [getAccessTokenSilently, isAuthenticated])

  return null
}
