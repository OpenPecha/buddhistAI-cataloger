import { API_URL } from '@/config/api';

// ==================== Types ====================

export interface User {
  id: string;
  email: string;
  name?: string | null;
  picture?: string | null;
  created_at: string;
  role?: string | null;
  permissions?: string[] | null;
}

export interface PaginatedUserResponse {
  items: User[];
  total: number;
  skip: number;
  limit: number;
}

export interface UserUpdateRequest {
  email?: string;
  name?: string | null;
  picture?: string | null;
  role?: string | null;
  permissions?: string[] | null;
}

// ==================== API Functions ====================

async function handleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'An error occurred' }));
    throw new Error(error.detail || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export const listUsers = async (
  skip: number = 0,
  limit: number = 100
): Promise<PaginatedUserResponse> => {
  const params = new URLSearchParams();
  params.append('skip', skip.toString());
  params.append('limit', limit.toString());

  const response = await fetch(`${API_URL}/settings/users?${params.toString()}`);
  return handleApiResponse(response);
};

export const getUser = async (userId: string): Promise<User> => {
  const response = await fetch(`${API_URL}/settings/users/${userId}`);
  return handleApiResponse(response);
};

export const getUserByEmail = async (email: string): Promise<User> => {
  const response = await fetch(`${API_URL}/settings/users/by-email/${email}`);
  return handleApiResponse(response);
};

export const updateUser = async (
  userId: string,
  userData: UserUpdateRequest
): Promise<User> => {
  const response = await fetch(`${API_URL}/settings/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });

  return handleApiResponse(response);
};

export const deleteUser = async (userId: string): Promise<void> => {
  const response = await fetch(`${API_URL}/settings/users/${userId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    await handleApiResponse(response);
  }
};
