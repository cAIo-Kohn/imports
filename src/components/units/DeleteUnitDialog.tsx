import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
import { AlertTriangle } from 'lucide-react';

interface Unit {
  id: string;
  name: string;
}

interface DeleteUnitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit: Unit | null;
}

export function DeleteUnitDialog({ open, onOpenChange, unit }: DeleteUnitDialogProps) {
  const queryClient = useQueryClient();

  // Check if unit has linked products
  const { data: linkedProductsCount = 0 } = useQuery({
    queryKey: ['unit-linked-products', unit?.id],
    queryFn: async () => {
      if (!unit) return 0;
      
      const { count, error } = await supabase
        .from('product_units')
        .select('*', { count: 'exact', head: true })
        .eq('unit_id', unit.id);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!unit && open,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!unit) throw new Error('No unit selected');

      // First delete all product_units links
      if (linkedProductsCount > 0) {
        const { error: linkError } = await supabase
          .from('product_units')
          .delete()
          .eq('unit_id', unit.id);

        if (linkError) throw linkError;
      }

      // Then delete the unit
      const { error } = await supabase
        .from('units')
        .delete()
        .eq('id', unit.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Unit deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['units'] });
      queryClient.invalidateQueries({ queryKey: ['unit-product-counts'] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error('Error deleting unit: ' + error.message);
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Unit
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete the unit <strong>"{unit?.name}"</strong>?
              </p>
              
              {linkedProductsCount > 0 && (
                <div className="rounded-md bg-destructive/10 p-3 text-destructive">
                  <p className="text-sm font-medium">
                    ⚠️ This unit has {linkedProductsCount} linked product{linkedProductsCount > 1 ? 's' : ''}.
                  </p>
                  <p className="text-sm mt-1">
                    Deleting this unit will also remove all product links. The products themselves will not be deleted.
                  </p>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                This action cannot be undone.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete Unit'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
