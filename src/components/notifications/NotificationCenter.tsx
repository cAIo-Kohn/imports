import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2, MessageCircle, HelpCircle, AtSign } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useNotifications, Notification } from '@/hooks/useNotifications';

const NOTIFICATION_ICONS: Record<string, React.ReactNode> = {
  mention: <AtSign className="h-4 w-4" />,
  question: <HelpCircle className="h-4 w-4" />,
  answer: <MessageCircle className="h-4 w-4" />,
  comment: <MessageCircle className="h-4 w-4" />,
};

const NOTIFICATION_COLORS: Record<string, string> = {
  mention: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  question: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  answer: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  comment: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300',
};

function NotificationItem({ 
  notification, 
  onMarkAsRead,
  onDelete,
  onNavigate,
}: { 
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (cardId: string | null) => void;
}) {
  const icon = NOTIFICATION_ICONS[notification.type] || <Bell className="h-4 w-4" />;
  const colorClass = NOTIFICATION_COLORS[notification.type] || NOTIFICATION_COLORS.comment;
  
  return (
    <div
      className={cn(
        "p-3 border-b last:border-b-0 hover:bg-accent/50 cursor-pointer transition-colors",
        !notification.is_read && "bg-accent/30"
      )}
      onClick={() => {
        if (!notification.is_read) {
          onMarkAsRead(notification.id);
        }
        onNavigate(notification.card_id);
      }}
    >
      <div className="flex items-start gap-3">
        <div className={cn("p-1.5 rounded-full flex-shrink-0", colorClass)}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-sm font-medium",
              !notification.is_read && "text-foreground",
              notification.is_read && "text-muted-foreground"
            )}>
              {notification.title}
            </span>
            {!notification.is_read && (
              <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
            )}
          </div>
          {notification.content && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {notification.content}
            </p>
          )}
          <span className="text-xs text-muted-foreground mt-1 block">
            {formatDistanceToNow(parseISO(notification.created_at), { addSuffix: true })}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!notification.is_read && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsRead(notification.id);
              }}
              title="Mark as read"
            >
              <Check className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(notification.id);
            }}
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function NotificationCenter() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification 
  } = useNotifications();

  const handleNavigate = (cardId: string | null) => {
    setOpen(false);
    if (cardId) {
      // Navigate to development page - the card will need to be opened
      navigate(`/development?card=${cardId}`);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative h-9 w-9"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] flex items-center justify-center"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0" 
        align="end"
        sideOffset={8}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => markAllAsRead()}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        
        <ScrollArea className="max-h-[400px]">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            notifications.map(notification => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={markAsRead}
                onDelete={deleteNotification}
                onNavigate={handleNavigate}
              />
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
