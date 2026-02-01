/**
 * Folders Query Hooks
 *
 * TanStack Query hooks for fetching and mutating folders.
 * Implements SWR pattern with cache invalidation.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { notesService, FolderResponse, FolderReorderItem } from '@/services/notes';

// ============ QUERIES ============

/**
 * Fetch list of folders
 */
export function useFoldersQuery() {
  return useQuery({
    queryKey: queryKeys.folders.list(),
    queryFn: async () => {
      const { data, error } = await notesService.listFolders();
      if (error) throw new Error(error);
      return data!;
    },
    // Folders change less frequently
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ============ MUTATIONS ============

/**
 * Create a new folder
 */
export function useCreateFolderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      icon?: string;
      color?: string;
    }) => {
      const { data: folder, error } = await notesService.createFolder(data);
      if (error) throw new Error(error);
      return folder!;
    },
    onSuccess: () => {
      // Invalidate folders list
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.all });
    },
  });
}

/**
 * Update a folder
 */
export function useUpdateFolderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      folderId,
      data,
    }: {
      folderId: string;
      data: {
        name?: string;
        icon?: string;
        color?: string;
        parent_id?: string | null;
        sort_order?: number;
      };
    }) => {
      const { data: folder, error } = await notesService.updateFolder(folderId, data);
      if (error) throw new Error(error);
      return folder!;
    },
    onSuccess: () => {
      // Invalidate folders list
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.all });
    },
  });
}

/**
 * Delete a folder
 */
export function useDeleteFolderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (folderId: string) => {
      const { success, error } = await notesService.deleteFolder(folderId);
      if (error) throw new Error(error);
      return { folderId, success };
    },
    onSuccess: () => {
      // Invalidate folders list
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.all });
      // Also invalidate notes as they may have been moved
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.lists() });
    },
  });
}

/**
 * Reorder folders
 */
export function useReorderFoldersMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: FolderReorderItem[]) => {
      const { success, error } = await notesService.reorderFolders(updates);
      if (error) throw new Error(error);
      return { success };
    },
    // Optimistic update for smooth drag-and-drop
    onMutate: async (updates) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.folders.list() });

      // Snapshot previous value
      const previousFolders = queryClient.getQueryData<FolderResponse[]>(queryKeys.folders.list());

      // Return context for rollback
      return { previousFolders };
    },
    onError: (_err, _updates, context) => {
      // Rollback on error
      if (context?.previousFolders) {
        queryClient.setQueryData(queryKeys.folders.list(), context.previousFolders);
      }
    },
    onSettled: () => {
      // Always refetch after mutation
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.all });
    },
  });
}

/**
 * Setup default folders
 */
export function useSetupDefaultFoldersMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { success, error } = await notesService.setupDefaultFolders();
      if (error) throw new Error(error);
      return { success };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.all });
    },
  });
}

export default useFoldersQuery;
