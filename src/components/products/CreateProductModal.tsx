import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Constants } from '@/integrations/supabase/types';

const unitOfMeasureOptions = Constants.public.Enums.unit_of_measure;

const formSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório').max(50, 'Código muito longo'),
  technical_description: z.string().min(1, 'Descrição é obrigatória').max(500, 'Descrição muito longa'),
  unit_of_measure: z.enum(unitOfMeasureOptions as unknown as [string, ...string[]]),
  ncm: z.string().max(20, 'NCM muito longo').optional().or(z.literal('')),
  ean_13: z.string().max(13, 'EAN-13 deve ter no máximo 13 caracteres').optional().or(z.literal('')),
  brand: z.string().max(100, 'Marca muito longa').optional().or(z.literal('')),
  warehouse_status: z.string().max(10, 'Status muito longo').optional().or(z.literal('')),
  qty_master_box: z.coerce.number().int().positive().optional().or(z.literal('')),
  fob_price_usd: z.coerce.number().positive().optional().or(z.literal('')),
  supplier_id: z.string().optional().or(z.literal('')),
});

interface Supplier {
  id: string;
  company_name: string;
  trade_name: string | null;
}

type FormData = z.infer<typeof formSchema>;

interface CreateProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultSupplierId?: string;
}

export function CreateProductModal({ open, onOpenChange, onSuccess, defaultSupplierId }: CreateProductModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, company_name, trade_name')
        .eq('is_active', true)
        .order('company_name');
      
      if (error) throw error;
      return data as Supplier[];
    }
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: '',
      technical_description: '',
      unit_of_measure: 'pcs',
      ncm: '',
      ean_13: '',
      brand: '',
      warehouse_status: '',
      qty_master_box: '',
      fob_price_usd: '',
      supplier_id: defaultSupplierId || '',
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('products').insert({
        code: data.code.trim(),
        technical_description: data.technical_description.trim(),
        unit_of_measure: data.unit_of_measure as any,
        ncm: data.ncm?.trim() || null,
        ean_13: data.ean_13?.trim() || null,
        brand: data.brand?.trim() || null,
        warehouse_status: data.warehouse_status?.trim() || null,
        qty_master_box: data.qty_master_box ? Number(data.qty_master_box) : null,
        fob_price_usd: data.fob_price_usd ? Number(data.fob_price_usd) : null,
        supplier_id: data.supplier_id || null,
      });

      if (error) {
        if (error.code === '23505') {
          toast.error('Já existe um produto com este código');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Produto cadastrado com sucesso!');
      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao cadastrar produto:', error);
      toast.error('Erro ao cadastrar produto: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Produto</DialogTitle>
          <DialogDescription>
            Preencha os dados para cadastrar um novo produto.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: ABC-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit_of_measure"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidade de Medida *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {unitOfMeasureOptions.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit.toUpperCase()}
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
                      placeholder="Descreva o produto..."
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
                      <Input placeholder="Ex: 8471.30.19" {...field} />
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
                      <Input placeholder="Código de barras" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marca</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Samsung" {...field} />
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
                    <FormControl>
                      <Input placeholder="Ex: A, B, NPD" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="qty_master_box"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Qtd. Master Box</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Ex: 24" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fob_price_usd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço FOB (USD)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="Ex: 10.50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="supplier_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fornecedor</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um fornecedor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {suppliers?.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.trade_name || supplier.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cadastrar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
