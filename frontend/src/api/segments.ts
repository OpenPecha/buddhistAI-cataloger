import { API_URL } from '@/config/api';

// Helper function to handle API responses with better error messages
const handleApiResponse = async (response: Response, customMessages?: { 400?: string; 404?: string; 500?: string }) => {
  if (!response.ok) {
    // Try to parse error response
    const contentType = response.headers.get('content-type');
    let errorMessage = '';

    if (contentType?.includes('application/json')) {
      try {
        const errorData = await response.json();
        const rawMessage = errorData.detail || errorData.details || errorData.message || errorData.error;
        
        // If detail is a JSON string, parse it to extract the actual error message
        if (rawMessage && typeof rawMessage === 'string') {
          const trimmedMessage = rawMessage.trim();
          
          // Try to parse as JSON if it looks like a JSON string
          try {
            const parsed = JSON.parse(trimmedMessage);
            if (parsed.error) {
              errorMessage = parsed.error;
            } else if (parsed.detail) {
              // Nested detail field
              try {
                const nestedParsed = JSON.parse(parsed.detail.trim());
                errorMessage = nestedParsed.error || parsed.detail.trim();
              } catch {
                errorMessage = parsed.detail.trim();
              }
            } else {
              errorMessage = trimmedMessage;
            }
          } catch {
            // If parsing fails, use the raw message as is
            errorMessage = trimmedMessage;
          }
        } else {
          errorMessage = rawMessage || '';
        }
      } catch {
        // If JSON parsing fails, ignore and use default message
      }
    }

    // Use backend error message if available, otherwise fall back to custom messages or defaults
    switch (response.status) {
      case 404:
        throw new Error(errorMessage || customMessages?.['404'] || 'The requested resource was not found. It may have been deleted or the link is incorrect.');
      case 500:
      case 502:
      case 503:
        throw new Error(errorMessage || customMessages?.['500'] || 'The server is experiencing issues. Please try again later.');
      case 400:
        throw new Error(errorMessage || customMessages?.['400'] || 'Invalid request. Please check your data and try again.');
      case 401:
        throw new Error(errorMessage || 'You are not authorized to access this resource.');
      case 403:
        throw new Error(errorMessage || 'Access to this resource is forbidden.');
      default:
        throw new Error(errorMessage || `An error occurred while connecting to the server (Error ${response.status}).`);
    }
  }

  // Check if response is JSON
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return await response.json();
  } else {
    throw new Error('The server returned an invalid response. Please contact support if this persists.');
  }
};

export interface UpdateSegmentContentRequest {
  content: string;
}

export interface UpdateSegmentContentResponse {
  id: string;
  content: string;
  [key: string]: unknown;
}

/**
 * Update segment content by segment ID
 * @param segmentId - The ID of the segment to update
 * @param content - The new content for the segment
 * @returns Updated segment data
 */
export const updateSegmentContent = async (
  segmentId: string,
  content: string
): Promise<UpdateSegmentContentResponse> => {
  try {
    const response = await fetch(`${API_URL}/segments/${segmentId}/content`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });

    return await handleApiResponse(response, {
      400: 'Invalid segment content. Please check your data and try again.',
      404: 'Segment not found. It may have been deleted or the link is incorrect.'
    });
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unable to update segment content. Please check your connection and try again.');
  }
};
