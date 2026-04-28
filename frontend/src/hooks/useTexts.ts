import {
  createText,
  createTextInstance,
  fetchAnnotation,
  fetchEditionSegmentations,
  fetchInstance,
  fetchRelatedInstances,
  fetchText,
  fetchTextInstances,
  fetchTexts,
  postEditionAlignments,
  postEditionSegmentations,
  updateEditionContent,
  updateInstance,
  updateText,
  type EditionAlignmentsPayload,
  type EditionSegmentationsPayload,
} from "@/api/texts";
import type { CreateTextPayload, UpdateTextPayload } from "@/types/text";
import { updateSegmentContent } from "@/api/segments";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";



// Text hooks
export const useTexts = (params?: {
  limit?: number;
  offset?: number;
  language?: string;
  author?: string;
  title?: string;
  category_id?: string;
}) => {
  
  return useQuery({
    queryKey: ["texts", params],
    queryFn: ({signal}) => fetchTexts(params, signal),
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

export const useEdition = (id: string) => {
  return useQuery({
    queryKey: ["edition", id],
    queryFn: () => fetchInstance(id),
    // fetchInstance already returns OpenPechaTextInstance, no need for select
    enabled: !!id, // Only fetch when id exists
  });
};

export const useEditionSegmentations = (editionId: string) => {
  return useQuery({
    queryKey: ["editionSegmentations", editionId],
    queryFn: () => fetchEditionSegmentations(editionId),
    enabled: !!editionId,
    staleTime: 60 * 1000,
    retry: 1,
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
    mutationFn: (payload: CreateTextPayload) => createText(payload),
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
    }: {
      textId: string;
      instanceId: string;
      instanceData: Record<string, unknown>;
    }) => updateInstance(textId, instanceId, instanceData),
    onSuccess: (_, { textId, instanceId }) => {
      queryClient.invalidateQueries({ queryKey: ["edition", instanceId] });
      queryClient.invalidateQueries({ queryKey: ["textInstance", textId] });
      queryClient.invalidateQueries({ queryKey: ["annotation"] });
    }
  });
};

export const useUpdateSegmentContent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      segmentId,
      content
    }: {
      segmentId: string;
      content: string;
    }) => updateSegmentContent(segmentId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["annotation"] });
      queryClient.invalidateQueries({ queryKey: ["edition"] });
    }
  });
};

export const useUpdateText = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      textId,
      textData,
    }: {
      textId: string;
      textData: UpdateTextPayload;
    }) => updateText(textId, textData),
    onSuccess: (_, { textId }) => {
      queryClient.invalidateQueries({ queryKey: ["text", textId] });
      queryClient.invalidateQueries({ queryKey: ["texts"] });
    }
  });
};

export const usePostEditionSegmentations = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      editionId,
      payload,
    }: {
      editionId: string;
      payload: EditionSegmentationsPayload;
    }) => postEditionSegmentations(editionId, payload),
    onSuccess: (_, { editionId }) => {
      queryClient.invalidateQueries({ queryKey: ["edition", editionId] });
      queryClient.invalidateQueries({ queryKey: ["editionSegmentations", editionId] });
      queryClient.invalidateQueries({ queryKey: ["annotation"] });
    },
  });
};

export const usePostEditionAlignments = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars: {
      editionId: string;
      rootEditionId: string;
      payload: EditionAlignmentsPayload;
    }) => postEditionAlignments(vars.editionId, vars.payload),
    onSuccess: (_, { editionId, rootEditionId }) => {
      queryClient.invalidateQueries({ queryKey: ["edition", editionId] });
      if (rootEditionId) {
        queryClient.invalidateQueries({ queryKey: ["edition", rootEditionId] });
      }
      queryClient.invalidateQueries({ queryKey: ["annotation"] });
      queryClient.invalidateQueries({ queryKey: ["preparedData"] });
      queryClient.invalidateQueries({ queryKey: ["preparedAlignmentData"] });
    },
  });
};

export const useUpdateEditionContent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      editionId,
      content,
      start,
      end,
    }: {
      editionId: string;
      content: string;
      start: number;
      end: number;
    }) =>
      updateEditionContent(editionId, {
        content,
        start,
        end,
      }),
    onSuccess: async (_, { editionId }) => {
      await queryClient.refetchQueries({ queryKey: ["edition", editionId] });
    },
  });
};

