import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Person, CreatePersonData, UpdatePersonData } from '../types/person';
import { API_URL } from '@/config/api';

// Helper function to handle API responses with better error messages
const handleApiResponse = async (response: Response, customMessages?: { 400?: string; 404?: string; 500?: string }) => {
  if (!response.ok) {
    // Try to parse error response
    const contentType = response.headers.get('content-type');
    let errorMessage = '';

    if (contentType && contentType.includes('application/json')) {
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.details || errorData.message || errorData.error;
      } catch {
        // If JSON parsing fails, ignore and use default message
      }
    }

    // Provide user-friendly messages based on status code
    switch (response.status) {
      case 404:
        throw new Error(customMessages?.['404'] || errorMessage || 'The requested resource was not found. It may have been deleted or the link is incorrect.');
      case 500:
      case 502:
      case 503:
        throw new Error(customMessages?.['500'] || errorMessage || 'The server is experiencing issues. Please try again later.');
      case 400:
        throw new Error(errorMessage || 'Invalid request. Please check your data and try again.');
      case 401:
        throw new Error('You are not authorized to access this resource.');
      case 403:
        throw new Error('Access to this resource is forbidden.');
      default:
        throw new Error(errorMessage || `An error occurred while connecting to the server (Error ${response.status}).`);
    }
  }

  // Check if response is JSON
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  } else {
    throw new Error('The server returned an invalid response. Please contact support if this persists.');
  }
};

// Real API function for Person
const fetchPersons = async (params?: { limit?: number; offset?: number }): Promise<Person[]> => {
  const queryParams = new URLSearchParams();
  
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());
  
  const url = queryParams.toString() ? `${API_URL}/person?${queryParams.toString()}` : `${API_URL}/person`;
  
  try {
    const response = await fetch(url);
    const data = await handleApiResponse(response);
    return data.results || data || [];
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unable to load persons. Please check your connection and try again.');
  }
};

const fetchPerson = async (id: string): Promise<Person> => {
  try {
    const response = await fetch(`${API_URL}/person/${id}`);
    return await handleApiResponse(response, {
      404: 'Person not found. It may have been deleted or the link is incorrect.'
    });
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unable to load person details. Please check your connection and try again.');
  }
};

const createPerson = async (data: CreatePersonData): Promise<Person> => {
  try {
    const response = await fetch(`${API_URL}/person`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    return await handleApiResponse(response, {
      400: 'Invalid person data. Please check all required fields and try again.'
    });
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unable to create person. Please check your connection and try again.');
  }
};

const updatePerson = async (data: UpdatePersonData): Promise<Person> => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return {
    id: data.id,
    name: data.name || {},
    alt_names: data.alt_names || null,
    bdrc: data.bdrc || '',
    wiki: data.wiki || null
  };
};

const deletePerson = async (_id: string): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 500));
};

// Person hooks
export const usePersons = (params?: { limit?: number; offset?: number }) => {
  return useQuery({
    queryKey: ['persons', params],
    queryFn: () => fetchPersons(params),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
};

export const usePerson = (id: string) => {
  return useQuery({
    queryKey: ['person', id],
    queryFn: () => fetchPerson(id),
    enabled: !!id, // Only fetch when id exists
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
};

export const useCreatePerson = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createPerson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
    }
  });
};

export const useUpdatePerson = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updatePerson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
    }
  });
};

export const useDeletePerson = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deletePerson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
    }
  });
};
