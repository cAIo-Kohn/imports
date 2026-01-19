import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const formSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório').max(50, 'Código muito longo'),
  technical_description: z.string().min(1, 'Descrição é obrigatória').max(500, 'Descrição muito longa'),
  ncm: z.string().max(20, 'NCM muito longo').optional().or(z.literal('')),
  ean_13: z.string().max(20, 'EAN muito longo').optional().or(z.literal('')),
  brand: z.string().max(100, 'Marca muito longa').optional().or(z.literal('')),
  warehouse_status: z.string().max(50, 'Status muito longo').optional().or(z.literal('')),
  fob_price_usd: z.coerce.number().min(0, 'Preço deve ser positivo').optional().or(z.literal('')),
  moq: z.coerce.number().int().min(0, 'MOQ deve ser positivo').optional().or(z.literal('')),
  lead_time_days: z.coerce.number().int().min(0, 'Lead time deve ser positivo').optional().or(z.literal('')),
  is_active: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface Product {
  id: string;
  code: string;
  technical_description: string;
  ncm?: string | null;
  ean_13?: string | null;
  brand?: string | null;
  warehouse_status?: string | null;
  fob_price_usd?: number | null;
  moq?: number | null;
  lead_time_days?: number | null;
  is_active?: boolean;
}

interface EditProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  onSuccess: () => void;
}

const warehouseStatusOptions = [
  'DISPONÍVEL',
  'EM COMPRA',
  'EM TRÂNSITO',
  'INATIVO',
];

export function EditProductModal({ open, onOpenChange, product, onSuccess }: EditProductModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fullProduct, setFullProduct] = useState<any>(null);

  // Fetch full product data when modal opens
  useEffect(() => {
    if (open && product.id) {
      supabase
        .from('products')
        .select('*')
        .eq('id', product.id)
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            setFullProduct(data);
          }
        });
    }
  }, [open, product.id]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: product.code,
      technical_description: product.technical_description,
      ncm: product.ncm || '',
      ean_13: '',
      brand: '',
      warehouse_status: product.warehouse_status || '',
      fob_price_usd: product.fob_price_usd || '',
      moq: '',
      lead_time_days: '',
      is_active: product.is_active ?? true,
    },
  });

  // Update form when full product data is loaded
  useEffect(() => {
    if (fullProduct) {
      form.reset({
        code: fullProduct.code,
        technical_description: fullProduct.technical_description,
        ncm: fullProduct.ncm || '',
        ean_13: fullProduct.ean_13 || '',
        brand: fullProduct.brand || '',
        warehouse_status: fullProduct.warehouse_status || '',
        fob_price_usd: fullProduct.fob_price_usd || '',
        moq: fullProduct.moq || '',
        lead_time_days: fullProduct.lead_time_days || '',
        is_active: fullProduct.is_active ?? true,
      });
    }
  }, [fullProduct, form]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({
          code: data.code.trim(),
          technical_description: data.technical_description.trim(),
          ncm: data.ncm?.trim() || null,
          ean_13: data.ean_13?.trim() || null,
          brand: data.brand?.trim() || null,
          warehouse_status: data.warehouse_status || null,
          fob_price_usd: data.fob_price_usd || null,
          moq: data.moq || null,
          lead_time_days: data.lead_time_days || null,
          is_active: data.is_active,
        })
        .eq('id', product.id);

      if (error) {
        throw error;
      }

      toast.success('Produto atualizado com sucesso!');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao atualizar produto:', error);
      toast.error('Erro ao atualizar produto: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Produto</DialogTitle>
          <DialogDescription>
            Atualize os dados do produto {product.code}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Produto Ativo</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Desative para ocultar este produto das listagens
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 006029" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="warehouse_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status Depósito</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {warehouseStatusOptions.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="technical_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição Técnica *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descrição detalhada do produto..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="ncm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NCM</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 9503.00.10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ean_13"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>EAN-13</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 7891234567890" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="brand"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Marca</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Marca XYZ" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="fob_price_usd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço FOB (USD)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="moq"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MOQ</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lead_time_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead Time (dias)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
