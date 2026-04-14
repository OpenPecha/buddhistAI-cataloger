import { fetchWithAccessToken } from '@/lib/fetchWithAccessToken';

const API_URL = '/api';

interface User {
  name: string;
  email: string;
  role: string;
}

export const fetchPermission = async (): Promise<User | null> => {
  const response = await fetchWithAccessToken(`${API_URL}/admin/permission`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to fetch permission: ${response.status} ${response.statusText} - ${err}`);
  }

  return response.json();
};