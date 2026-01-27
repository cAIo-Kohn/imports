import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface MoveCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetOwner: 'mor' | 'arc';
  onConfirm: () => void;
  onCancel: () => void;
  triggerAction?: string;
}

export function MoveCardModal({
  open,
  onOpenChange,
  targetOwner,
  onConfirm,
  onCancel,
  triggerAction,
}: MoveCardModalProps) {
  const targetLabel = targetOwner === 'mor' ? 'MOR (Brazil)' : 'ARC (China)';
  
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Move Card to {targetLabel}?</AlertDialogTitle>
          <AlertDialogDescription>
            {triggerAction ? (
              <>You've {triggerAction}. Does this require input from the {targetOwner === 'mor' ? 'Brazil' : 'China'} team?</>
            ) : (
              <>The card will appear in {targetLabel}'s section if you confirm.</>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            No, keep with {targetOwner === 'mor' ? 'ARC' : 'MOR'}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Yes, move to {targetLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
