import { API_URL } from '@/config/api';

export interface LanguageItem {
  code: string;
  name: string;
}

export interface LanguagesResponse {
  items: LanguageItem[];
}

export const fetchLanguage = async (): Promise<LanguagesResponse> => {
  const response = await fetch(`${API_URL}/v2/language/languages`);

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
      errorMessage || `Unable to load languages (${response.status}).`,
    );
  }

  return response.json();
};
