import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { 
  Zap, 
  MessageCircle, 
  Upload, 
  Plus,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type BannerColorScheme = 'violet' | 'emerald' | 'blue' | 'amber';

export interface BannerQuickActionsProps {
  onStartThread?: () => void;
  onUpload?: () => void;
  onRequestSample?: () => void;
  colorScheme?: BannerColorScheme;
  className?: string;
}

const colorClasses: Record<BannerColorScheme, string> = {
  violet: 'border-violet-300 text-violet-700 hover:bg-violet-100 dark:border-violet-600 dark:text-violet-200 dark:hover:bg-violet-900',
  emerald: 'border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-600 dark:text-emerald-200 dark:hover:bg-emerald-900',
  blue: 'border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-600 dark:text-blue-200 dark:hover:bg-blue-900',
  amber: 'border-amber-400 text-amber-700 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-200 dark:hover:bg-amber-900',
};

export function BannerQuickActions({ 
  onStartThread,
  onUpload,
  onRequestSample,
  colorScheme = 'violet',
  className,
}: BannerQuickActionsProps) {
  const hasActions = onStartThread || onUpload || onRequestSample;

  // Don't render if no actions available
  if (!hasActions) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={cn(
            "bg-white dark:bg-background",
            colorClasses[colorScheme],
            className
          )}
        >
          <Zap className="h-3 w-3 mr-1" />
          Quick Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48 bg-popover">
        {onStartThread && (
          <DropdownMenuItem onClick={onStartThread}>
            <Plus className="h-4 w-4 mr-2" />
            New Thread
          </DropdownMenuItem>
        )}
        
        {onStartThread && (onUpload || onRequestSample) && (
          <DropdownMenuSeparator />
        )}
        
        {onUpload && (
          <DropdownMenuItem onClick={onUpload}>
            <Upload className="h-4 w-4 mr-2" />
            Upload File
          </DropdownMenuItem>
        )}
        {onRequestSample && (
          <DropdownMenuItem onClick={onRequestSample}>
            <Package className="h-4 w-4 mr-2" />
            Request Sample
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
