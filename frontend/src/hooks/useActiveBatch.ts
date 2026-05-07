import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getActiveBatch, updateActiveBatch, type ActiveBatchState } from '@/api/outliner';

export function useActiveBatch() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['outliner', 'active-batch'],
    queryFn: getActiveBatch,
    staleTime: 60_000,
  });
  const mutation = useMutation({
    mutationFn: (body: ActiveBatchState) => updateActiveBatch(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['outliner', 'active-batch'] });
    },
  });
  return {
    ...query,
    setActiveBatch: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
}
