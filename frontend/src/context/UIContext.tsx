import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useGetSettingsByDomain } from '@/hooks/useSettings';
import type { Tenant } from '@/api/settings';
import { hexToHsl, generateColorShades, getForegroundColor } from '@/lib/color-utils';

interface UIContextType {
  tenant: Tenant | undefined;
  isLoading: boolean;
  error: Error | null;
  brandName: string;
  brandIconUrl: string;
  primaryColor: string;
  secondaryColor: string;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

interface UIProviderProps {
  children: React.ReactNode;
}

export const UIProvider: React.FC<UIProviderProps> = ({ children }) => {
  const domain = typeof globalThis !== 'undefined' && globalThis.location ? globalThis.location.hostname : '';
  const { data: tenantData, isLoading, error } = useGetSettingsByDomain(domain);

  // Extract values with defaults
  const brandName = tenantData?.brand_name || 'Buddhistai Tools';
  const brandIconUrl = tenantData?.settings?.brand_icon_url || '/icon.png';
  const primaryColor = tenantData?.settings?.brand_primary_color || '#1b5cc5';
  const secondaryColor = tenantData?.settings?.brand_secondary_color || '#b3dfd1';

  // Set favicon and document title
  useEffect(() => {
    if (tenantData) {
      // Set document title
      document.title = brandName;

      // Set favicon
      if (tenantData.settings?.brand_icon_url) {
        let favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
        if (favicon) {
          favicon.href = tenantData.settings.brand_icon_url;
        } else {
          // If no favicon link exists, create one
          const link = document.createElement('link');
          link.rel = 'icon';
          link.href = tenantData.settings.brand_icon_url;
          document.head.appendChild(link);
        }
      }
    }
  }, [tenantData, brandName]);

  // Set CSS variables for brand colors (Shadcn format)
  useEffect(() => {
    const root = document.documentElement;
    
    if (tenantData?.settings) {
      // Set primary color and its shades
      if (tenantData.settings.brand_primary_color) {
        const primaryHsl = hexToHsl(tenantData.settings.brand_primary_color);
        const primaryShades = generateColorShades(tenantData.settings.brand_primary_color);
        const primaryForeground = getForegroundColor(tenantData.settings.brand_primary_color);
        
        // Set main primary color (used by Shadcn components)
        root.style.setProperty('--primary', primaryHsl);
        root.style.setProperty('--primary-foreground', primaryForeground);
        
        // Set primary color shades
        Object.entries(primaryShades).forEach(([shade, hslValue]) => {
          root.style.setProperty(`--color-primary-${shade}`, hslValue);
        });
        
        // Also set the legacy --color-primary variable
        root.style.setProperty('--color-primary', tenantData.settings.brand_primary_color);
        
        // Set ring color to match primary
        root.style.setProperty('--ring', primaryHsl);
      }
      
      // Set secondary color and its shades
      if (tenantData.settings.brand_secondary_color) {
        const secondaryHsl = hexToHsl(tenantData.settings.brand_secondary_color);
        const secondaryShades = generateColorShades(tenantData.settings.brand_secondary_color);
        const secondaryForeground = getForegroundColor(tenantData.settings.brand_secondary_color);
        
        // Set main secondary color (used by Shadcn components)
        root.style.setProperty('--color-secondary', secondaryHsl);
        root.style.setProperty('--color-secondary-foreground', secondaryForeground);
        
        // Set secondary color shades
        Object.entries(secondaryShades).forEach(([shade, hslValue]) => {
          root.style.setProperty(`--color-secondary-${shade}`, hslValue);
        });
        
        // Also set the legacy --color-secondary variable
        root.style.setProperty('--color-secondary', tenantData.settings.brand_secondary_color);
      }
    } 
  }, [tenantData]);

  const contextValue = useMemo(
    () => ({
      tenant: tenantData,
      isLoading,
      error: error as Error | null,
      brandName,
      brandIconUrl,
      primaryColor,
      secondaryColor,
    }),
    [tenantData, isLoading, error, brandName, brandIconUrl, primaryColor, secondaryColor]
  );

  return <UIContext.Provider value={contextValue}>{children}</UIContext.Provider>;
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
