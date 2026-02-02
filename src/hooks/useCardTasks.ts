import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CardTask {
  id: string;
  card_id: string;
  task_type: 'sample_request' | 'commercial_request';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assigned_to_users: string[];
  assigned_to_role: string | null;
  created_by: string;
  metadata: Record<string, unknown>;
  created_at: string;
  completed_at: string | null;
  completed_by: string | null;
  sample_id: string | null;
  // Joined data
  created_by_profile?: {
    full_name: string | null;
    email: string | null;
  } | null;
}

export function useCardTasks(cardId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading, refetch } = useQuery({
    queryKey: ['card-tasks', cardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('development_card_tasks')
        .select('*')
        .eq('card_id', cardId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch creator profiles
      const creatorIds = [...new Set(data.map(t => t.created_by))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', creatorIds);

      const profileMap = new Map<string, { user_id: string; full_name: string | null; email: string | null }>();
      profiles?.forEach(p => profileMap.set(p.user_id, p));

      return data.map(task => ({
        ...task,
        task_type: task.task_type as CardTask['task_type'],
        status: task.status as CardTask['status'],
        metadata: (task.metadata || {}) as Record<string, unknown>,
        created_by_profile: profileMap.get(task.created_by) || null,
      })) as CardTask[];
    },
    enabled: !!cardId,
  });

  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');

  // Create a new task
  const createTaskMutation = useMutation({
    mutationFn: async (task: {
      task_type: 'sample_request' | 'commercial_request';
      assigned_to_users?: string[];
      assigned_to_role?: string;
      metadata?: Record<string, unknown>;
      sample_id?: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await (supabase
        .from('development_card_tasks') as any)
        .insert({
          card_id: cardId,
          task_type: task.task_type,
          assigned_to_users: task.assigned_to_users || [],
          assigned_to_role: task.assigned_to_role || null,
          created_by: user.id,
          metadata: task.metadata || {},
          sample_id: task.sample_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card-tasks', cardId] });
    },
  });

  // Update a task
  const updateTaskMutation = useMutation({
    mutationFn: async (update: {
      taskId: string;
      status?: CardTask['status'];
      assigned_to_users?: string[];
      assigned_to_role?: string;
      metadata?: Record<string, unknown>;
      completed_by?: string;
    }) => {
      const updateData: Record<string, unknown> = {};
      
      if (update.status) updateData.status = update.status;
      if (update.assigned_to_users) updateData.assigned_to_users = update.assigned_to_users;
      if (update.assigned_to_role !== undefined) updateData.assigned_to_role = update.assigned_to_role;
      if (update.metadata) updateData.metadata = update.metadata;
      if (update.status === 'completed') {
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = update.completed_by || user?.id;
      }

      const { data, error } = await supabase
        .from('development_card_tasks')
        .update(updateData)
        .eq('id', update.taskId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card-tasks', cardId] });
    },
  });

  // Cancel a task
  const cancelTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('development_card_tasks')
        .update({ status: 'cancelled' })
        .eq('id', taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card-tasks', cardId] });
    },
  });

  return {
    tasks,
    pendingTasks,
    isLoading,
    refetch,
    createTask: createTaskMutation.mutateAsync,
    updateTask: updateTaskMutation.mutateAsync,
    cancelTask: cancelTaskMutation.mutate,
    isCreating: createTaskMutation.isPending,
    isUpdating: updateTaskMutation.isPending,
  };
}

// Helper to send task notifications via edge function (handles role lookups server-side)
export async function sendTaskNotification({
  recipientUserIds,
  recipientRole,
  triggeredBy,
  cardId,
  taskId,
  type,
  title,
  content,
}: {
  recipientUserIds?: string[];
  recipientRole?: string;
  triggeredBy: string;
  cardId: string;
  taskId: string;
  type: string;
  title: string;
  content: string;
}) {
  try {
    const response = await supabase.functions.invoke('send-notification', {
      body: {
        recipientUserIds,
        recipientRole,
        triggeredBy,
        cardId,
        taskId,
        type,
        title,
        content,
      },
    });

    if (response.error) {
      console.error('Failed to send notification:', response.error);
    }
  } catch (error) {
    console.error('Error invoking send-notification:', error);
  }
}
