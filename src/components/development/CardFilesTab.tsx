import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { FileText, Image as ImageIcon, Download, ExternalLink, FolderOpen } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface FileItem {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'file';
  uploadedAt: string;
  uploadedBy: {
    name: string | null;
    email: string | null;
  };
  activityType: string;
  activityContent: string | null;
}

interface CardFilesTabProps {
  cardId: string;
}

export function CardFilesTab({ cardId }: CardFilesTabProps) {
  // Fetch all activities that have attachments
  const { data: files = [], isLoading } = useQuery({
    queryKey: ['card-files', cardId],
    queryFn: async () => {
      const { data: activities, error } = await supabase
        .from('development_card_activity')
        .select('*')
        .eq('card_id', cardId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get user IDs for profile lookup
      const userIds = [...new Set(activities.map(a => a.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      const profileMap = (profiles || []).reduce((acc, p) => {
        acc[p.user_id] = p;
        return acc;
      }, {} as Record<string, { full_name: string | null; email: string | null }>);

      // Extract files from activity metadata
      const allFiles: FileItem[] = [];
      
      for (const activity of activities) {
        const metadata = activity.metadata as Record<string, any> | null;
        const attachments = metadata?.attachments as Array<{
          id: string;
          name: string;
          url: string;
          type: 'image' | 'file';
        }> | undefined;

        if (attachments && attachments.length > 0) {
          const profile = profileMap[activity.user_id];
          
          for (const attachment of attachments) {
            allFiles.push({
              id: attachment.id,
              name: attachment.name,
              url: attachment.url,
              type: attachment.type,
              uploadedAt: activity.created_at,
              uploadedBy: {
                name: profile?.full_name || null,
                email: profile?.email || null,
              },
              activityType: activity.activity_type,
              activityContent: activity.content,
            });
          }
        }
      }

      return allFiles;
    },
  });

  const images = files.filter(f => f.type === 'image');
  const documents = files.filter(f => f.type === 'file');

  const getInitials = (file: FileItem) => {
    if (file.uploadedBy.name) {
      return file.uploadedBy.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (file.uploadedBy.email) {
      return file.uploadedBy.email[0].toUpperCase();
    }
    return '?';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FolderOpen className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-sm font-medium">No files shared yet</p>
        <p className="text-xs mt-1">Files and images shared in messages will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Images Section */}
      {images.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Images ({images.length})
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map((file) => (
              <a
                key={file.id}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative aspect-square rounded-lg overflow-hidden border bg-muted hover:ring-2 hover:ring-primary transition-all"
              >
                <img
                  src={file.url}
                  alt={file.name}
                  className="w-full h-full object-cover"
                />
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white p-2">
                  <ExternalLink className="h-5 w-5 mb-1" />
                  <p className="text-xs text-center line-clamp-2">{file.name}</p>
                  <p className="text-[10px] opacity-70 mt-1">
                    {format(parseISO(file.uploadedAt), 'MMM d')}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Documents Section */}
      {documents.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documents ({documents.length})
          </h4>
          <div className="space-y-2">
            {documents.map((file) => (
              <a
                key={file.id}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted transition-colors group"
              >
                <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {file.name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <Avatar className="h-4 w-4">
                      <AvatarFallback className="text-[8px]">{getInitials(file)}</AvatarFallback>
                    </Avatar>
                    <span>{file.uploadedBy.name || file.uploadedBy.email || 'Unknown'}</span>
                    <span>•</span>
                    <span>{format(parseISO(file.uploadedAt), 'MMM d, yyyy')}</span>
                  </div>
                </div>
                <Download className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
