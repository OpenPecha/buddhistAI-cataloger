import {
  createText,
  createTextInstance,
  fetchAnnotation,
  fetchInstance,
  fetchRelatedInstances,
  fetchText,
  fetchTextInstances,
  fetchTexts,
  fetchTextsByTitle,
  updateInstance,
} from "@/api/texts";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";


export const useTextsByTitle = (title: string) => {
  return useQuery({
    queryKey: ["textsByTitle", title],
    queryFn: ({ signal }) => fetchTextsByTitle(title, signal),
    enabled: !!title && title.trim().length > 0, // Only fetch when there's a search query
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
};

// Text hooks
export const useTexts = (params?: {
  limit?: number;
  offset?: number;
  language?: string;
  author?: string;
  type?: string;
}) => {
  return useQuery({
    queryKey: ["texts", params],
    queryFn: () => fetchTexts(params),
    // fetchTexts already returns OpenPechaText[], no need for select
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
};

export const useText = (id: string) => {
  return useQuery({
    queryKey: ["text", id],
    queryFn: () => fetchText(id),
    select: (data) => data, // fetchText returns a single text object, not an array
    enabled: !!id, // Only fetch when id exists
    refetchOnWindowFocus: false, // Prevent refetch on window focus
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });
};

export const useTextInstance = (id: string) => {
  return useQuery({
    queryKey: ["textInstance", id],
    queryFn: () => fetchTextInstances(id),
    // fetchTextInstances already returns OpenPechaTextInstanceListItem[], no need for select
    enabled: !!id, // Only fetch when id exists
  });
};

export const useInstance = (id: string) => {
  return useQuery({
    queryKey: ["instance", id],
    queryFn: () => fetchInstance(id),
    // fetchInstance already returns OpenPechaTextInstance, no need for select
    enabled: !!id, // Only fetch when id exists
  });
};

export const useAnnnotation = (id: string) => {
  return useQuery({
    queryKey: ["annotation", id],
    queryFn: () => fetchAnnotation(id),
    enabled: !!id, // Only fetch when id exists
  });
};

export const useCreateText = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createText,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["texts"] });
    }
  });
};

export const useCreateTextInstance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      textId,
      instanceData,
      user
    }: {
      textId: string;
      instanceData: any;
      user: string;
    }) => createTextInstance(textId, instanceData, user),
    onSuccess: (_, { textId }) => {
      queryClient.invalidateQueries({ queryKey: ["textInstance", textId] });
    }
  });
};

export const useRelatedInstances = (instanceId: string | null) => {
  return useQuery({
    queryKey: ["relatedInstances", instanceId],
    queryFn: () => fetchRelatedInstances(instanceId!),
    enabled: !!instanceId, // Only fetch when instanceId exists
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
};

export const useUpdateInstance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      textId,
      instanceId,
      instanceData,
      user
    }: {
      textId: string;
      instanceId: string;
      instanceData: any;
      user: string;
    }) => updateInstance(textId, instanceId, instanceData, user),
    onSuccess: (_, { textId, instanceId }) => {
      queryClient.invalidateQueries({ queryKey: ["instance", instanceId] });
      queryClient.invalidateQueries({ queryKey: ["textInstance", textId] });
      queryClient.invalidateQueries({ queryKey: ["annotation"] });
    }
  });
};
 
