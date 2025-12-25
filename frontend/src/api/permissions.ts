const API_URL = '/api';

interface User {
  name: string;
  email: string;
  role: string;
}

export const fetchPermission = async (email: string): Promise<User | null> => {

        const response = await fetch(`${API_URL}/admin/permission?email=${email}`, {
            method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
    }
});

if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to fetch permission: ${response.status} ${response.statusText} - ${err}`);
}

return response.json();
};