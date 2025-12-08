import { useQuery } from '@tanstack/react-query';
import { fetchRelatedInstances } from '../../../api/instances';

export interface RelatedInstance {
  // Support both API response formats
  id?: string;
  instance_id?: string;
  type?: string;
  incipit_title?: Record<string, string>;
  alt_incipit_titles?: Record<string, string>;
  content?: string;
  annotations?: Array<{
    annotation_id: string;
    type: string;
  }>;
  // New API response format
  metadata?: {
    instance_type?: string;
    copyright?: string;
    text_id?: string;
    title?: Record<string, string>;
    alt_titles?: Array<Record<string, string>>;
    language?: string;
    contributions?: Array<{
      person_id: string;
      role: string;
    }>;
  };
  annotation?: string;
  relationship?: string;
}


export const useRelatedInstances = (
  instanceId: string | null
) => {
  return useQuery({
    queryKey: ['relatedInstances', instanceId],
    queryFn:() => fetchRelatedInstances(instanceId!),
    refetchInterval: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    enabled: instanceId !== null && instanceId !== undefined,
    retry: 2,
  });
};
