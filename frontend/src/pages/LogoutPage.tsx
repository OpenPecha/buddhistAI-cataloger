import { useAuth0 } from '@auth0/auth0-react';
import React, { useEffect } from 'react'

function LogoutPage() {
    const { logout } = useAuth0();
 
   
    useEffect(()=>{
        logout({
            logoutParams: {
                returnTo: window.location.origin + '/login',
            },
        });
    },[])
  return (
    <div>
      logging out...
    </div>
  )
}

export default LogoutPage
