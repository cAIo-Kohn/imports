import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UnresolvedMention {
  id: string;
  card_id: string;
  mentioned_user_id: string;
  mentioned_by_user_id: string;
  activity_id: string;
  created_at: string;
  resolved_at: string | null;
  // Joined data
  mentioned_user_name?: string | null;
}

export interface ParsedMentions {
  userIds: string[];
  teamIds: string[];
}

// Parse @mentions from text - format: @[Name](id)
// Returns { userIds: string[], teamIds: string[] }
export function parseMentionsFromText(text: string): ParsedMentions {
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const userIds: string[] = [];
  const teamIds: string[] = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    const id = match[2];
    if (id.startsWith('team:')) {
      teamIds.push(id);
    } else {
      userIds.push(id);
    }
  }
  
  return {
    userIds: [...new Set(userIds)],
    teamIds: [...new Set(teamIds)],
  };
}

// Extract role from team ID (e.g., "team:trader" → "trader")
function getRoleFromTeamId(teamId: string): string | null {
  const match = teamId.match(/^team:(\w+)$/);
  return match ? match[1] : null;
}

// Fetch all user IDs for given team IDs via edge function
async function expandTeamsToUserIds(
  teamIds: string[],
  excludeUserId: string
): Promise<string[]> {
  if (teamIds.length === 0) return [];
  
  const roles = teamIds.map(getRoleFromTeamId).filter(Boolean) as string[];
  
  if (roles.length === 0) return [];
  
  try {
    const response = await supabase.functions.invoke('get-role-users', {
      body: { roles },
    });
    
    if (response.error) {
      console.error('Failed to expand teams:', response.error);
      return [];
    }
    
    const userIds = (response.data?.userIds || [])
      .filter((id: string) => id !== excludeUserId);
    
    return userIds;
  } catch (error) {
    console.error('Error expanding teams to user IDs:', error);
    return [];
  }
}

export function useCardMentions(cardId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch unresolved mentions for this card
  const { data: unresolvedMentions = [], isLoading } = useQuery({
    queryKey: ['card-unresolved-mentions', cardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('card_unresolved_mentions')
        .select('*')
        .eq('card_id', cardId)
        .is('resolved_at', null);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch user names for the mentioned users
      const userIds = [...new Set(data.map(m => m.mentioned_user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      const nameMap = new Map<string, string | null>();
      profiles?.forEach(p => nameMap.set(p.user_id, p.full_name));

      return data.map(mention => ({
        ...mention,
        mentioned_user_name: nameMap.get(mention.mentioned_user_id) || null,
      })) as UnresolvedMention[];
    },
    enabled: !!cardId,
  });

  // Create mentions when a message is sent with @mentions
  const createMentionsMutation = useMutation({
    mutationFn: async ({
      activityId,
      mentionedUserIds,
      mentionedTeamIds,
    }: {
      activityId: string;
      mentionedUserIds: string[];
      mentionedTeamIds: string[];
    }) => {
      if (!user?.id) return;

      // Expand teams to user IDs
      const teamUserIds = await expandTeamsToUserIds(mentionedTeamIds, user.id);
      
      // Combine individual mentions + team member mentions, excluding self
      const allUserIds = [...new Set([
        ...mentionedUserIds.filter(id => id !== user.id),
        ...teamUserIds,
      ])];
      
      if (allUserIds.length === 0) return;

      const mentions = allUserIds.map(userId => ({
        card_id: cardId,
        mentioned_user_id: userId,
        mentioned_by_user_id: user.id,
        activity_id: activityId,
      }));

      const { error } = await supabase
        .from('card_unresolved_mentions')
        .insert(mentions);

      if (error) {
        // Ignore duplicate key errors (same user mentioned in same activity)
        if (!error.message.includes('duplicate key')) {
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card-unresolved-mentions', cardId] });
    },
  });

  // Resolve mentions when the mentioned user sends a message
  const resolveMentionsMutation = useMutation({
    mutationFn: async ({ resolvedByActivityId }: { resolvedByActivityId: string }) => {
      if (!user?.id) return;

      // Resolve all unresolved mentions for this user in this card
      const { error } = await supabase
        .from('card_unresolved_mentions')
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by_activity_id: resolvedByActivityId,
        })
        .eq('card_id', cardId)
        .eq('mentioned_user_id', user.id)
        .is('resolved_at', null);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card-unresolved-mentions', cardId] });
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
    },
  });

  return {
    unresolvedMentions,
    isLoading,
    createMentions: createMentionsMutation.mutateAsync,
    resolveMentions: resolveMentionsMutation.mutateAsync,
    isCreating: createMentionsMutation.isPending,
    isResolving: resolveMentionsMutation.isPending,
  };
}

// Helper for card list query to fetch unresolved mentions counts
export async function fetchUnresolvedMentionsCounts(cardIds: string[]): Promise<Record<string, { userIds: string[]; userNames: string[] }>> {
  if (cardIds.length === 0) return {};

  const { data, error } = await supabase
    .from('card_unresolved_mentions')
    .select('card_id, mentioned_user_id')
    .in('card_id', cardIds)
    .is('resolved_at', null);

  if (error) throw error;
  if (!data || data.length === 0) return {};

  // Get unique user IDs
  const userIds = [...new Set(data.map(m => m.mentioned_user_id))];
  
  // Fetch names
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, full_name')
    .in('user_id', userIds);

  const nameMap = new Map<string, string>();
  profiles?.forEach(p => nameMap.set(p.user_id, p.full_name || 'Unknown'));

  // Group by card
  const result: Record<string, { userIds: string[]; userNames: string[] }> = {};
  
  for (const mention of data) {
    if (!result[mention.card_id]) {
      result[mention.card_id] = { userIds: [], userNames: [] };
    }
    if (!result[mention.card_id].userIds.includes(mention.mentioned_user_id)) {
      result[mention.card_id].userIds.push(mention.mentioned_user_id);
      result[mention.card_id].userNames.push(nameMap.get(mention.mentioned_user_id) || 'Unknown');
    }
  }

  return result;
}
