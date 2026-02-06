import { useState, useRef, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { 
  ExternalLink, 
  MessageCircle, 
  Upload, 
  Send, 
  FileText, 
  CheckCircle2, 
  XCircle,
  Clock,
  Package
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { MentionInput } from '@/components/notifications/MentionInput';
import { TimelineUploadButton, UploadedAttachment, AttachmentDisplay, ALLOWED_FORMATS_HINT } from '@/components/development/TimelineUploadButton';
import { createMentionNotifications } from '@/hooks/useNotifications';
import { parseMentionsFromText } from '@/hooks/useCardMentions';
import { APPROVAL_CONFIG, type ApprovalType, type NewProductApproval } from '@/hooks/useNewProductFlow';
import { AppRole } from '@/hooks/useUserRole';

interface ResearchApprovalDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string;
  cardTitle: string;
  cardImageUrl: string | null;
  approvalType: ApprovalType;
  approval: NewProductApproval | undefined;
  onOpenOriginalCard: () => void;
}

interface ResearchComment {
  id: string;
  card_id: string;
  user_id: string;
  content: string | null;
  created_at: string;
  metadata: {
    attachments?: UploadedAttachment[];
    research_type?: ApprovalType;
  } | null;
  profile?: {
    full_name: string | null;
    email: string | null;
  } | null;
  roles?: AppRole[];
}

function formatDateHeader(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d, yyyy');
}

export function ResearchApprovalDrawer({
  open,
  onOpenChange,
  cardId,
  cardTitle,
  cardImageUrl,
  approvalType,
  approval,
  onOpenOriginalCard,
}: ResearchApprovalDrawerProps) {
  const { user } = useAuth();
  const { roles } = useUserRole();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [messageContent, setMessageContent] = useState('');
  const [messageAttachments, setMessageAttachments] = useState<UploadedAttachment[]>([]);
  const [researchFiles, setResearchFiles] = useState<UploadedAttachment[]>([]);

  const config = APPROVAL_CONFIG[approvalType];
  const canApprove = roles.includes(config.role as AppRole) || roles.includes('admin');
  const hasResearchFiles = researchFiles.length > 0;
  const isPending = approval?.status === 'pending';
  const isApproved = approval?.status === 'approved';
  const isRejected = approval?.status === 'rejected';

  // Fetch comments for this research type
  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['research-comments', cardId, approvalType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('development_card_activity')
        .select('*')
        .eq('card_id', cardId)
        .eq('activity_type', 'research_comment')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Filter by research type in metadata
      const filtered = (data || []).filter(d => {
        const meta = d.metadata as ResearchComment['metadata'];
        return meta?.research_type === approvalType;
      });

      // Fetch profiles
      const userIds = [...new Set(filtered.map(a => a.user_id))];
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, email').in('user_id', userIds),
        supabase.from('user_roles').select('user_id, role').in('user_id', userIds),
      ]);

      const profileMap = (profilesRes.data || []).reduce((acc, p) => {
        acc[p.user_id] = { full_name: p.full_name, email: p.email };
        return acc;
      }, {} as Record<string, { full_name: string | null; email: string | null }>);

      const rolesMap = (rolesRes.data || []).reduce((acc, r) => {
        if (!acc[r.user_id]) acc[r.user_id] = [];
        acc[r.user_id].push(r.role as AppRole);
        return acc;
      }, {} as Record<string, AppRole[]>);

      return filtered.map(activity => ({
        ...activity,
        metadata: activity.metadata as ResearchComment['metadata'],
        profile: profileMap[activity.user_id] || null,
        roles: rolesMap[activity.user_id] || [],
      })) as ResearchComment[];
    },
    enabled: open && !!cardId,
  });

  // Group comments by date
  const commentsByDate = useMemo(() => {
    const grouped: Record<string, ResearchComment[]> = {};
    for (const msg of comments) {
      const dateKey = format(parseISO(msg.created_at), 'yyyy-MM-dd');
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(msg);
    }
    return grouped;
  }, [comments]);

  const sortedDates = Object.keys(commentsByDate).sort();

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments.length]);

  // Real-time subscription
  useEffect(() => {
    if (!open || !cardId) return;

    const channel = supabase
      .channel(`research-${cardId}-${approvalType}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'development_card_activity',
          filter: `card_id=eq.${cardId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['research-comments', cardId, approvalType] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cardId, approvalType, open, queryClient]);

  // Send comment mutation
  const sendCommentMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || (!messageContent.trim() && messageAttachments.length === 0)) return;

      const metadata: Record<string, any> = {
        research_type: approvalType,
      };

      if (messageAttachments.length > 0) {
        metadata.attachments = messageAttachments;
      }

      const { data, error } = await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'research_comment',
        content: messageContent.trim() || null,
        metadata,
      }).select('id').single();

      if (error) throw error;

      // Create mention notifications
      if (data?.id && messageContent.trim()) {
        await createMentionNotifications({
          text: messageContent,
          cardId,
          activityId: data.id,
          triggeredBy: user.id,
          cardTitle: `${config.labelPt} - ${cardTitle}`,
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research-comments', cardId, approvalType] });
      setMessageContent('');
      setMessageAttachments([]);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to send comment', variant: 'destructive' });
    },
  });

  // Approve/Reject mutation
  const decisionMutation = useMutation({
    mutationFn: async (decision: 'approved' | 'rejected') => {
      if (!user?.id || !approval?.id) throw new Error('Missing data');

      // Update approval record
      const { error: approvalError } = await supabase
        .from('new_product_approvals')
        .update({
          status: decision,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          notes: researchFiles.length > 0 ? `Research files uploaded: ${researchFiles.map(f => f.name).join(', ')}` : null,
        })
        .eq('id', approval.id);

      if (approvalError) throw approvalError;

      // Log to activity
      await (supabase.from('development_card_activity') as any).insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'message',
        content: decision === 'approved' 
          ? `✅ ${config.labelPt} approved`
          : `❌ ${config.labelPt} rejected`,
        metadata: {
          flow_action: 'research_decision',
          research_type: approvalType,
          decision,
          research_files: researchFiles,
        },
      });

      // Check if all approvals are complete to advance flow
      if (decision === 'approved') {
        const { data: allApprovals } = await supabase
          .from('new_product_approvals')
          .select('status')
          .eq('card_id', cardId);

        const allApproved = allApprovals?.every(a => a.status === 'approved');
        if (allApproved && allApprovals?.length === 3) {
          await supabase
            .from('development_items')
            .update({ new_product_flow_status: 'step2_code_registration' })
            .eq('id', cardId);

          await supabase.from('development_card_activity').insert({
            card_id: cardId,
            user_id: user.id,
            activity_type: 'message',
            content: '🎉 All research approvals complete - moved to code registration',
            metadata: { flow_action: 'advance_step2' },
          });
        }
      }
    },
    onSuccess: (_, decision) => {
      queryClient.invalidateQueries({ queryKey: ['new-products'] });
      queryClient.invalidateQueries({ queryKey: ['new-product-approvals', cardId] });
      toast({ 
        title: decision === 'approved' ? 'Approved' : 'Rejected',
        description: `${config.labelPt} ${decision}`,
      });
      setResearchFiles([]);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (messageContent.trim() || messageAttachments.length > 0) {
        sendCommentMutation.mutate();
      }
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl">{config.icon}</span>
              <div className="min-w-0">
                <SheetTitle className="text-base">{config.labelPt}</SheetTitle>
                <p className="text-xs text-muted-foreground capitalize">{config.role}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 flex-shrink-0"
              onClick={onOpenOriginalCard}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View Card
            </Button>
          </div>
        </SheetHeader>

        {/* Product Info */}
        <div className="px-4 py-3 border-b bg-muted/30 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
              {cardImageUrl ? (
                <img
                  src={cardImageUrl}
                  alt={cardTitle}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Package className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{cardTitle}</p>
              <div className="flex items-center gap-2 mt-1">
                {isPending && (
                  <Badge variant="secondary" className="text-[10px]">
                    <Clock className="h-3 w-3 mr-1" />
                    Pending
                  </Badge>
                )}
                {isApproved && (
                  <Badge variant="secondary" className="text-[10px] border-green-300 bg-green-100/50 dark:bg-green-900/30">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Approved
                  </Badge>
                )}
                {isRejected && (
                  <Badge variant="destructive" className="text-[10px]">
                    <XCircle className="h-3 w-3 mr-1" />
                    Rejected
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Comments Timeline */}
        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="p-4 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                Loading comments...
              </div>
            ) : sortedDates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageCircle className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">No comments yet</p>
                <p className="text-xs mt-1">Add your research notes below</p>
              </div>
            ) : (
              sortedDates.map(dateKey => (
                <div key={dateKey}>
                  {/* Date Header */}
                  <div className="flex justify-center mb-4">
                    <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                      {formatDateHeader(dateKey + 'T00:00:00')}
                    </span>
                  </div>

                  {/* Comments for this date */}
                  {commentsByDate[dateKey].map(comment => {
                    const isOwn = comment.user_id === user?.id;
                    const attachments = comment.metadata?.attachments || [];

                    return (
                      <div
                        key={comment.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-3 py-2 ${
                            isOwn
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          {!isOwn && (
                            <p className="text-xs font-medium mb-1 opacity-70">
                              {comment.profile?.full_name || 'Unknown'}
                            </p>
                          )}
                          {comment.content && (
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {comment.content}
                            </p>
                          )}
                          {attachments.length > 0 && (
                            <AttachmentDisplay attachments={attachments} className="mt-2" />
                          )}
                          <p className={`text-[10px] mt-1 ${isOwn ? 'opacity-70' : 'text-muted-foreground'}`}>
                            {format(parseISO(comment.created_at), 'HH:mm')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Comment Input */}
        <div className="border-t bg-background p-3 flex-shrink-0">
          <div className="flex items-end gap-2">
            <TimelineUploadButton
              attachments={messageAttachments}
              onAttachmentsChange={setMessageAttachments}
              variant="icon"
              disabled={sendCommentMutation.isPending}
            />
            <div className="flex-1 min-w-0">
              <MentionInput
                value={messageContent}
                onChange={setMessageContent}
                onKeyDown={handleKeyDown}
                placeholder="Add research notes..."
                rows={1}
                className="text-sm resize-none min-h-[40px] max-h-[120px]"
                disabled={sendCommentMutation.isPending}
              />
            </div>
            <Button
              size="icon"
              className="h-10 w-10 rounded-full flex-shrink-0"
              onClick={() => sendCommentMutation.mutate()}
              disabled={(!messageContent.trim() && messageAttachments.length === 0) || sendCommentMutation.isPending}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Upload Research & Actions (Only for pending approvals) */}
        {isPending && canApprove && (
          <div className="border-t bg-muted/30 p-4 flex-shrink-0 space-y-3">
            <Separator />
            
            {/* Upload Research Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Upload Research</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Upload your research files ({ALLOWED_FORMATS_HINT}) to enable approval.
              </p>
              <TimelineUploadButton
                attachments={researchFiles}
                onAttachmentsChange={setResearchFiles}
                variant="button"
              />
            </div>

            {/* Research Files Preview */}
            {researchFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {researchFiles.map(file => (
                  <div
                    key={file.id}
                    className="flex items-center gap-1.5 bg-background rounded-md px-2 py-1 text-xs border"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="max-w-[120px] truncate">{file.name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Approve/Reject Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => decisionMutation.mutate('rejected')}
                disabled={decisionMutation.isPending}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button
                variant="default"
                className="flex-1"
                onClick={() => decisionMutation.mutate('approved')}
                disabled={!hasResearchFiles || decisionMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Approve
              </Button>
            </div>
            
            {!hasResearchFiles && (
              <p className="text-xs text-center text-muted-foreground">
                Upload research files to enable approval
              </p>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
