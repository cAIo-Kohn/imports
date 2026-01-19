import { useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DeleteSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: { id: string; company_name: string; trade_name: string | null } | null;
  linkedProductsCount: number;
  onSuccess: () => void;
}

export function DeleteSupplierDialog({ open, onOpenChange, supplier, linkedProductsCount, onSuccess }: DeleteSupplierDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!supplier) return;
    
    setIsDeleting(true);
    try {
      // First, unlink all products from this supplier
      if (linkedProductsCount > 0) {
        const { error: unlinkError } = await supabase
          .from('products')
          .update({ supplier_id: null })
          .eq('supplier_id', supplier.id);
        
        if (unlinkError) throw unlinkError;
      }

      // Then delete the supplier
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', supplier.id);

      if (error) throw error;

      toast.success('Fornecedor excluído com sucesso!');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao excluir fornecedor:', error);
      toast.error('Erro ao excluir fornecedor: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const displayName = supplier?.trade_name || supplier?.company_name || 'Fornecedor';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Fornecedor</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Tem certeza que deseja excluir o fornecedor{' '}
              <span className="font-semibold text-foreground">{displayName}</span>?
            </p>
            {linkedProductsCount > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <p className="text-sm">
                  Este fornecedor está vinculado a <strong>{linkedProductsCount}</strong> produto(s). 
                  Os produtos serão desvinculados, mas <strong>não</strong> excluídos.
                </p>
              </div>
            )}
            <p className="text-destructive font-medium">
              Esta ação não pode ser desfeita.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Excluir
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
