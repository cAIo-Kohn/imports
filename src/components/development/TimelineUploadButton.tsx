import { useState, useRef } from 'react';
import { Paperclip, X, Upload, FileText, Image as ImageIcon, Loader2, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export interface UploadedAttachment {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'file';
}

interface TimelineUploadButtonProps {
  attachments: UploadedAttachment[];
  onAttachmentsChange: (attachments: UploadedAttachment[]) => void;
  variant?: 'button' | 'icon';
  className?: string;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export function TimelineUploadButton({
  attachments,
  onAttachmentsChange,
  variant = 'icon',
  className,
  disabled = false,
}: TimelineUploadButtonProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newAttachments: UploadedAttachment[] = [];

    try {
      for (const file of Array.from(files)) {
        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          console.warn(`File ${file.name} is too large (max 10MB)`);
          continue;
        }

        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
          console.warn(`File ${file.name} has unsupported type`);
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `timeline/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('development-images')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('development-images')
          .getPublicUrl(fileName);

        const isImage = file.type.startsWith('image/');
        newAttachments.push({
          id: crypto.randomUUID(),
          name: file.name,
          url: publicUrl,
          type: isImage ? 'image' : 'file',
        });
      }

      if (newAttachments.length > 0) {
        onAttachmentsChange([...attachments, ...newAttachments]);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
      // Reset inputs
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAttachment = async (attachmentId: string) => {
    const attachment = attachments.find(a => a.id === attachmentId);
    if (attachment) {
      // Try to delete from storage
      try {
        const url = new URL(attachment.url);
        const pathParts = url.pathname.split('/');
        const bucketIndex = pathParts.indexOf('development-images');
        if (bucketIndex !== -1) {
          const filePath = pathParts.slice(bucketIndex + 1).join('/');
          await supabase.storage.from('development-images').remove([filePath]);
        }
      } catch (error) {
        console.error('Failed to delete from storage:', error);
      }
    }
    onAttachmentsChange(attachments.filter(a => a.id !== attachmentId));
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        onChange={handleFileChange}
        className="hidden"
        multiple
        disabled={disabled || isUploading}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      <div className="flex items-center gap-1">
        {variant === 'button' ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading}
              className="gap-1"
            >
              {isUploading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Upload className="h-3 w-3" />
              )}
              {isUploading ? 'Uploading...' : 'Upload'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => cameraInputRef.current?.click()}
              disabled={disabled || isUploading}
              className="gap-1 md:hidden"
            >
              <Camera className="h-3 w-3" />
              Camera
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading}
              title="Attach files"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 md:hidden"
              onClick={() => cameraInputRef.current?.click()}
              disabled={disabled || isUploading}
              title="Take photo"
            >
              <Camera className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="relative group flex items-center gap-1.5 bg-muted rounded-md px-2 py-1 text-xs"
            >
              {attachment.type === 'image' ? (
                <img
                  src={attachment.url}
                  alt={attachment.name}
                  className="h-6 w-6 object-cover rounded"
                />
              ) : (
                <FileText className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="max-w-[100px] truncate">{attachment.name}</span>
              <button
                type="button"
                onClick={() => handleRemoveAttachment(attachment.id)}
                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Component to display attachments in timeline activities
interface AttachmentDisplayProps {
  attachments: UploadedAttachment[];
  className?: string;
}

export function AttachmentDisplay({ attachments, className }: AttachmentDisplayProps) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2 mt-2", className)}>
      {attachments.map((attachment) => (
        <a
          key={attachment.id}
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-1.5 bg-background/50 hover:bg-background border rounded-md px-2 py-1 text-xs transition-colors"
        >
          {attachment.type === 'image' ? (
            <>
              <img
                src={attachment.url}
                alt={attachment.name}
                className="h-8 w-8 object-cover rounded"
              />
              <ImageIcon className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="max-w-[100px] truncate">{attachment.name}</span>
            </>
          )}
        </a>
      ))}
    </div>
  );
}
