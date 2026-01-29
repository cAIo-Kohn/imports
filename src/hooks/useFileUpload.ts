import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UploadedFile {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'file';
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

interface UseFileUploadOptions {
  bucket?: string;
  folder?: string;
  onUploadComplete?: (files: UploadedFile[]) => void;
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const { 
    bucket = 'development-images', 
    folder = 'timeline',
    onUploadComplete 
  } = options;
  
  const [isUploading, setIsUploading] = useState(false);

  const uploadFiles = useCallback(async (files: FileList | File[]): Promise<UploadedFile[]> => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return [];

    setIsUploading(true);
    const uploadedFiles: UploadedFile[] = [];

    try {
      for (const file of fileArray) {
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
        const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from(bucket)
          .getPublicUrl(fileName);

        const isImage = file.type.startsWith('image/');
        uploadedFiles.push({
          id: crypto.randomUUID(),
          name: file.name,
          url: publicUrl,
          type: isImage ? 'image' : 'file',
        });
      }

      if (uploadedFiles.length > 0) {
        onUploadComplete?.(uploadedFiles);
      }

      return uploadedFiles;
    } catch (error) {
      console.error('Upload failed:', error);
      return [];
    } finally {
      setIsUploading(false);
    }
  }, [bucket, folder, onUploadComplete]);

  const isValidFileType = useCallback((file: File) => {
    return ALLOWED_TYPES.includes(file.type);
  }, []);

  return {
    uploadFiles,
    isUploading,
    isValidFileType,
    allowedTypes: ALLOWED_TYPES,
    maxFileSize: MAX_FILE_SIZE,
  };
}
