import { API_URL } from '@/config/api';

export interface RoleItem {
  name: string;
  description?: string;
}

export interface RolesResponse {
  items: RoleItem[];
}

export const fetchRole = async (): Promise<RolesResponse> => {
  return {
    items: [
      { name: "translator" },
      { name: "reviser" },
      { name: "author" },
      { name: "scholar" }
    ]
  };
};
