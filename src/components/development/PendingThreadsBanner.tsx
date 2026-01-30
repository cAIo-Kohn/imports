import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { 
  AlertCircle, 
  ChevronDown, 
  ChevronRight, 
  Package, 
  HelpCircle, 
  MessageCircle,
  Reply,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface PendingThread {
  id: string;
  title: string;
  type: 'question' | 'sample_requested' | 'comment' | 'answer';
  content: string | null;
  createdAt: string;
  authorName: string | null;
  authorEmail: string | null;
  pendingForTeam: 'mor' | 'arc';
}

interface PendingThreadsBannerProps {
  threads: PendingThread[];
  currentOwner: 'mor' | 'arc';
  onThreadClick?: (threadId: string) => void;
  onQuickReply?: (threadId: string) => void;
}

export function PendingThreadsBanner({
  threads,
  currentOwner,
  onThreadClick,
  onQuickReply,
}: PendingThreadsBannerProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Filter to only threads pending for current team
  const pendingForMe = threads.filter(t => t.pendingForTeam === currentOwner);
  
  if (pendingForMe.length === 0) return null;

  const getThreadIcon = (type: PendingThread['type']) => {
    switch (type) {
      case 'sample_requested':
        return <Package className="h-3.5 w-3.5" />;
      case 'question':
        return <HelpCircle className="h-3.5 w-3.5" />;
      case 'answer':
        return <Reply className="h-3.5 w-3.5" />;
      default:
        return <MessageCircle className="h-3.5 w-3.5" />;
    }
  };

  const getThreadLabel = (type: PendingThread['type']) => {
    switch (type) {
      case 'sample_requested':
        return 'Add tracking';
      case 'question':
        return 'Answer question';
      case 'answer':
        return 'Acknowledge';
      default:
        return 'Reply';
    }
  };

  const getInitials = (name: string | null, email: string | null) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (email) return email[0].toUpperCase();
    return '?';
  };

  return (
    <div className="rounded-lg border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-600 mb-4 overflow-hidden">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        {/* Header */}
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-3 hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors cursor-pointer">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <span className="font-medium text-sm text-amber-800 dark:text-amber-200">
                Your Pending Actions
              </span>
              <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[10px] px-1.5 py-0">
                {pendingForMe.length}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
          </div>
        </CollapsibleTrigger>

        {/* Thread List */}
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-2">
            {pendingForMe.map((thread) => (
              <div
                key={thread.id}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-white dark:bg-background border border-amber-200 dark:border-amber-700 hover:border-amber-400 dark:hover:border-amber-500 transition-colors group"
              >
                {/* Thread Icon */}
                <div className={cn(
                  "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                  thread.type === 'sample_requested' && "bg-cyan-100 text-cyan-600 dark:bg-cyan-900 dark:text-cyan-400",
                  thread.type === 'question' && "bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400",
                  thread.type === 'answer' && "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400",
                  thread.type === 'comment' && "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400",
                )}>
                  {getThreadIcon(thread.type)}
                </div>

                {/* Thread Info */}
                <div 
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => onThreadClick?.(thread.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{thread.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <Avatar className="h-4 w-4">
                      <AvatarFallback className="text-[8px] bg-muted">
                        {getInitials(thread.authorName, thread.authorEmail)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">
                      {thread.authorName?.split(' ')[0] || thread.authorEmail || 'Someone'}
                    </span>
                    <span>•</span>
                    <span>{format(parseISO(thread.createdAt), 'dd/MM HH:mm')}</span>
                  </div>
                  {thread.content && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {thread.content}
                    </p>
                  )}
                </div>

                {/* Quick Action Button */}
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity",
                    thread.type === 'sample_requested' && "border-cyan-300 text-cyan-700 hover:bg-cyan-50 dark:border-cyan-600 dark:text-cyan-400 dark:hover:bg-cyan-950",
                    thread.type === 'question' && "border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-600 dark:text-purple-400 dark:hover:bg-purple-950",
                    thread.type === 'answer' && "border-green-300 text-green-700 hover:bg-green-50 dark:border-green-600 dark:text-green-400 dark:hover:bg-green-950",
                    thread.type === 'comment' && "border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-600 dark:text-blue-400 dark:hover:bg-blue-950",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickReply?.(thread.id);
                  }}
                >
                  {thread.type === 'sample_requested' ? (
                    <Truck className="h-3 w-3 mr-1" />
                  ) : (
                    <Reply className="h-3 w-3 mr-1" />
                  )}
                  {getThreadLabel(thread.type)}
                </Button>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
