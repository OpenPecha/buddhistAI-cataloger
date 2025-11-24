import { API_URL } from '@/config/api';

export interface TokenizeRequest {
  text: string;
  type: 'word' | 'sentence';
}

export type TokenizeResponse = string[];

export const tokenize = async (request: TokenizeRequest): Promise<TokenizeResponse> => {
  try {
    const response = await fetch(`${API_URL}/tokenize`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      let errorMessage = '';

      if (contentType?.includes('application/json')) {
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorData.error || '';
        } catch {
          // If JSON parsing fails, ignore and use default message
        }
      }

      switch (response.status) {
        case 400:
          throw new Error(errorMessage || 'Invalid request. Please check your data and try again.');
        case 500:
        case 502:
        case 503:
          throw new Error(errorMessage || 'The server is experiencing issues. Please try again later.');
        case 504:
          throw new Error(errorMessage || 'Request timed out. Please try again.');
        default:
          throw new Error(errorMessage || `An error occurred while connecting to the server (Error ${response.status}).`);
      }
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return await response.json();
    } else {
      throw new Error('The server returned an invalid response. Please contact support if this persists.');
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unable to tokenize text. Please check your connection and try again.');
  }
};

