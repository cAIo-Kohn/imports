import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GroupedItemsEditor } from './GroupedItemsEditor';

interface GroupedItemsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string;
  canEdit: boolean;
}

export function GroupedItemsDrawer({ 
  open, 
  onOpenChange, 
  cardId, 
  canEdit 
}: GroupedItemsDrawerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Products in Group</DialogTitle>
        </DialogHeader>
        <GroupedItemsEditor cardId={cardId} canEdit={canEdit} />
      </DialogContent>
    </Dialog>
  );
}
