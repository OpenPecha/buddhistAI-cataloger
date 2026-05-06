import { useAuth0 } from '@auth0/auth0-react';
import { useEffect } from 'react'
import { getCurrentUser, createUser } from '@/api/settings';
import posthog from 'posthog-js';

function useEnsureUserExists() {
    const { isAuthenticated, user, isLoading } = useAuth0();
    useEffect(() => {
        const ensureUserExists = async () => {
          if (isAuthenticated && user?.email && !isLoading) {
            try {
              // Check if user exists in database
              const existingUser = await getCurrentUser();
              posthog.identify(user.email, {
                email: user.email,
                name: user.name || null,
                picture: user.picture || null,
              })
              // If user doesn't exist, create them
              if (!existingUser && user.sub) {
                await createUser({
                  name: user.name || null,
                  picture: user.picture || null,
                });
              }
            } catch (error) {
              console.error('Error ensuring user exists:', error);
            }
          }
        };
    
        ensureUserExists();
      }, [isAuthenticated, user, isLoading]);
      return { "success": true };
}

export default useEnsureUserExists
