const API_URL = '/api';

export interface Tenant {
  id: string;
  name?: string;
  domain: string;
  brand_name: string;
  created_at: string;
  settings?: TenantSettings | null;
}

export interface TenantUpdate {
  domain?: string;
  brand_name?: string;
}

export interface TenantSettings {
  id: string;
  tenant_id: string;
  brand_icon_url: string | null;
  brand_primary_color: string | null;
  brand_secondary_color: string | null;
}

export interface TenantSettingsUpdate {
  brand_icon_url?: string | null;
  brand_primary_color?: string | null;
  brand_secondary_color?: string | null;
}

export interface TenantCreate {
  domain: string;
  brand_name: string;
}

export const getTenantByDomain = async (domain: string): Promise<Tenant | null> => {
    const response = await fetch(`${API_URL}/settings/tenants/by-domain/${domain}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json',
        },
    });

    if (!response.ok) {
        if (response.status === 404) {
            return null;
        }
        throw new Error('Failed to fetch tenant');
    }

    return response.json();
};

export const createTenant = async (tenant: TenantCreate): Promise<Tenant | null> => {
    const response = await fetch(`${API_URL}/settings/tenants`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json',
        },
        body: JSON.stringify(tenant),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create tenant: ${error}`);
    }

    return response.json();
};

export const updateTenant = async (tenantId: string, tenant: TenantUpdate): Promise<Tenant | null> => {
    const response = await fetch(`${API_URL}/settings/tenants/${tenantId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json',
        },
        body: JSON.stringify(tenant),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to update tenant: ${error}`);
    }

    return response.json();
};

export const getTenantSettings = async (tenantId: string): Promise<TenantSettings | null> => {
    const response = await fetch(`${API_URL}/settings/tenant-settings/tenant/${tenantId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json',
        },
    });

    if (!response.ok) {
        // If settings don't exist, return null instead of throwing
        if (response.status === 404) {
            return null;
        }
        throw new Error('Failed to fetch tenant settings');
    }

    return response.json();
};

export const createTenantSettings = async (
    tenantId: string, 
    settings: TenantSettingsUpdate
): Promise<TenantSettings | null> => {
    const response = await fetch(`${API_URL}/settings/tenant-settings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json',
        },
        body: JSON.stringify({
            tenant_id: tenantId,
            ...settings,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create tenant settings: ${error}`);
    }

    return response.json();
};

export const updateTenantSettings = async (tenantId: string, settings: TenantSettingsUpdate): Promise<TenantSettings | null> => {
    // First, get the settings by tenant_id to obtain the settings_id
    const getResponse = await fetch(`${API_URL}/settings/tenant-settings/tenant/${tenantId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json',
        },
    });

    if (!getResponse.ok) {
        throw new Error('Failed to fetch tenant settings');
    }

    const existingSettings: TenantSettings = await getResponse.json();

    // Then update using the settings_id
    const updateResponse = await fetch(`${API_URL}/settings/tenant-settings/${existingSettings.id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json',
        },
        body: JSON.stringify(settings),
    });

    if (!updateResponse.ok) {
        throw new Error('Failed to update tenant settings');
    }

    return updateResponse.json();
}