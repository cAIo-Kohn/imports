import { AtSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MentionTagsProps {
  mentionedUserNames: string[];
  className?: string;
  maxVisible?: number;
}

// Get first name from full name
function getFirstName(fullName: string): string {
  return fullName.split(' ')[0];
}

export function MentionTags({ 
  mentionedUserNames, 
  className,
  maxVisible = 2 
}: MentionTagsProps) {
  if (!mentionedUserNames || mentionedUserNames.length === 0) return null;

  const visibleNames = mentionedUserNames.slice(0, maxVisible);
  const hiddenCount = mentionedUserNames.length - maxVisible;
  const hiddenNames = mentionedUserNames.slice(maxVisible);

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {visibleNames.map((name, index) => (
        <Badge
          key={index}
          variant="outline"
          className="text-[9px] px-1 py-0 flex items-center gap-0.5 bg-blue-50 text-blue-700 border-blue-200"
        >
          <AtSign className="h-2.5 w-2.5" />
          {getFirstName(name)}
        </Badge>
      ))}
      
      {hiddenCount > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="text-[9px] px-1 py-0 bg-blue-50 text-blue-700 border-blue-200 cursor-help"
              >
                +{hiddenCount}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                {hiddenNames.map(n => `@${getFirstName(n)}`).join(', ')}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
