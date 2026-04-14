import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import './tailwind.css'
import 'react-split-pane/styles.css'
import './i18n/config' // Initialize i18n
import App from './App.tsx'
import { OutlinerAuthBridge } from './app/OutlinerAuthBridge.tsx'
import { UserbackProvider } from './context/UserbackProvider.tsx'
import { BibliographyProvider } from './context/BibliographyContext.tsx'
import { UIProvider } from './context/UIContext.tsx'
import { Auth0Provider } from '@auth0/auth0-react';
import { Toaster } from "@/components/ui/sonner"
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
})
createRoot(document.getElementById('root')!).render(
  <StrictMode>
     <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
        scope: 'openid profile email',
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
      }}
      cacheLocation='localstorage'
      useRefreshTokens={true}
      useRefreshTokensFallback={true}
    >  
    <OutlinerAuthBridge />
    <QueryClientProvider client={queryClient}>
      <UIProvider>
        <BibliographyProvider>
          <UserbackProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </UserbackProvider>
        </BibliographyProvider>
        <Toaster />
      </UIProvider>
    </QueryClientProvider>
    </Auth0Provider>
  </StrictMode>,
)
