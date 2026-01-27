import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { Send, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';

interface Comment {
  id: string;
  item_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: {
    full_name: string | null;
    email: string | null;
  } | null;
}

interface ActivityTimelineProps {
  itemId: string;
  canComment: boolean;
}

export function ActivityTimeline({ itemId, canComment }: ActivityTimelineProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');

  // Fetch comments
  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['development-item-comments', itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('development_item_comments')
        .select('*')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      // Fetch profiles for comments
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      const profileMap = (profiles || []).reduce((acc, p) => {
        acc[p.user_id] = p;
        return acc;
      }, {} as Record<string, { full_name: string | null; email: string | null }>);

      return data.map(comment => ({
        ...comment,
        profile: profileMap[comment.user_id] || null,
      })) as Comment[];
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !newComment.trim()) return;
      const { error } = await supabase.from('development_item_comments').insert({
        item_id: itemId,
        user_id: user.id,
        content: newComment.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-item-comments', itemId] });
      setNewComment('');
      toast({ title: 'Comment added' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add comment', variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      addCommentMutation.mutate();
    }
  };

  const getInitials = (profile: Comment['profile']) => {
    if (profile?.full_name) {
      return profile.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (profile?.email) {
      return profile.email[0].toUpperCase();
    }
    return '?';
  };

  return (
    <div className="space-y-4">
      {/* Comment Input */}
      {canComment && (
        <form onSubmit={handleSubmit} className="space-y-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            rows={2}
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={!newComment.trim() || addCommentMutation.isPending}
            >
              <Send className="h-3 w-3 mr-1" />
              {addCommentMutation.isPending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </form>
      )}

      {/* Comments List */}
      <div className="space-y-3">
        {isLoading ? (
          <p className="text-center text-muted-foreground py-4">Loading...</p>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No comments yet</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="text-xs bg-primary/10">
                  {getInitials(comment.profile)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-sm">
                    {comment.profile?.full_name || comment.profile?.email || 'Unknown'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(comment.created_at), 'dd/MM HH:mm')}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                  {comment.content}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
