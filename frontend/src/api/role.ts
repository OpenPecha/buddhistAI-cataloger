import { API_URL } from '@/config/api';

export interface RoleItem {
  name: string;
  description?: string;
}

export interface RolesResponse {
  items: RoleItem[];
}

export const fetchRole = async (): Promise<RolesResponse> => {
  const response = await fetch(`${API_URL}/v2/role/roles`);

  if (!response.ok) {
    const contentType = response.headers.get('content-type');
    let errorMessage = '';

    if (contentType?.includes('application/json')) {
      try {
        const errorData = await response.json();
        errorMessage =
          errorData.detail || errorData.message || errorData.error || '';
      } catch {
        // ignore parse errors
      }
    }

    throw new Error(
      errorMessage || `Unable to load roles (${response.status}).`,
    );
  }

  return response.json();
};
