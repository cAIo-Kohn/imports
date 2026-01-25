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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const formSchema = z.object({
  company_name: z.string().min(1, 'Razão Social é obrigatória').max(200, 'Razão Social muito longa'),
  trade_name: z.string().max(200, 'Nome Fantasia muito longo').optional().or(z.literal('')),
  country: z.string().min(1, 'País é obrigatório').max(100, 'País muito longo'),
  tax_id: z.string().max(50, 'Tax ID muito longo').optional().or(z.literal('')),
  address: z.string().max(300, 'Endereço muito longo').optional().or(z.literal('')),
  city: z.string().max(100, 'Cidade muito longa').optional().or(z.literal('')),
  state_province: z.string().max(100, 'Estado muito longo').optional().or(z.literal('')),
  postal_code: z.string().max(20, 'CEP muito longo').optional().or(z.literal('')),
  contact_name: z.string().max(100, 'Nome do contato muito longo').optional().or(z.literal('')),
  contact_email: z.string().email('Email inválido').max(100, 'Email muito longo').optional().or(z.literal('')),
  contact_phone: z.string().max(50, 'Telefone muito longo').optional().or(z.literal('')),
  website: z.string().max(200, 'Website muito longo').optional().or(z.literal('')),
  payment_terms: z.string().max(200, 'Condições de pagamento muito longas').optional().or(z.literal('')),
  notes: z.string().max(1000, 'Observações muito longas').optional().or(z.literal('')),
  is_active: z.boolean(),
  container_20_cbm: z.string().optional().or(z.literal('')),
  container_40_cbm: z.string().optional().or(z.literal('')),
  container_40hq_cbm: z.string().optional().or(z.literal('')),
});

type FormData = z.infer<typeof formSchema>;

interface Supplier {
  id: string;
  company_name: string;
  trade_name: string | null;
  country: string;
  city: string | null;
  state_province: string | null;
  address: string | null;
  postal_code: string | null;
  tax_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  payment_terms: string | null;
  notes: string | null;
  is_active: boolean;
  container_20_cbm: number | null;
  container_40_cbm: number | null;
  container_40hq_cbm: number | null;
}

interface EditSupplierModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier;
  onSuccess: () => void;
}

export function EditSupplierModal({ open, onOpenChange, supplier, onSuccess }: EditSupplierModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      company_name: supplier.company_name,
      trade_name: supplier.trade_name || '',
      country: supplier.country,
      tax_id: supplier.tax_id || '',
      address: supplier.address || '',
      city: supplier.city || '',
      state_province: supplier.state_province || '',
      postal_code: supplier.postal_code || '',
      contact_name: supplier.contact_name || '',
      contact_email: supplier.contact_email || '',
      contact_phone: supplier.contact_phone || '',
      website: supplier.website || '',
      payment_terms: supplier.payment_terms || '',
      notes: supplier.notes || '',
      is_active: supplier.is_active,
      container_20_cbm: supplier.container_20_cbm?.toString() || '',
      container_40_cbm: supplier.container_40_cbm?.toString() || '',
      container_40hq_cbm: supplier.container_40hq_cbm?.toString() || '',
    },
  });

  // Reset form when supplier changes
  useEffect(() => {
    form.reset({
      company_name: supplier.company_name,
      trade_name: supplier.trade_name || '',
      country: supplier.country,
      tax_id: supplier.tax_id || '',
      address: supplier.address || '',
      city: supplier.city || '',
      state_province: supplier.state_province || '',
      postal_code: supplier.postal_code || '',
      contact_name: supplier.contact_name || '',
      contact_email: supplier.contact_email || '',
      contact_phone: supplier.contact_phone || '',
      website: supplier.website || '',
      payment_terms: supplier.payment_terms || '',
      notes: supplier.notes || '',
      is_active: supplier.is_active,
      container_20_cbm: supplier.container_20_cbm?.toString() || '',
      container_40_cbm: supplier.container_40_cbm?.toString() || '',
      container_40hq_cbm: supplier.container_40hq_cbm?.toString() || '',
    });
  }, [supplier, form]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('suppliers')
        .update({
          company_name: data.company_name.trim(),
          trade_name: data.trade_name?.trim() || null,
          country: data.country.trim(),
          tax_id: data.tax_id?.trim() || null,
          address: data.address?.trim() || null,
          city: data.city?.trim() || null,
          state_province: data.state_province?.trim() || null,
          postal_code: data.postal_code?.trim() || null,
          contact_name: data.contact_name?.trim() || null,
          contact_email: data.contact_email?.trim() || null,
          contact_phone: data.contact_phone?.trim() || null,
          website: data.website?.trim() || null,
          payment_terms: data.payment_terms?.trim() || null,
          notes: data.notes?.trim() || null,
          is_active: data.is_active,
          container_20_cbm: data.container_20_cbm ? parseFloat(data.container_20_cbm) : null,
          container_40_cbm: data.container_40_cbm ? parseFloat(data.container_40_cbm) : null,
          container_40hq_cbm: data.container_40hq_cbm ? parseFloat(data.container_40hq_cbm) : null,
        })
        .eq('id', supplier.id);

      if (error) {
        throw error;
      }

      toast.success('Fornecedor atualizado com sucesso!');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao atualizar fornecedor:', error);
      toast.error('Erro ao atualizar fornecedor: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Fornecedor</DialogTitle>
          <DialogDescription>
            Atualize os dados do fornecedor.
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
                    <FormLabel>Fornecedor Ativo</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Desative para ocultar este fornecedor das listagens
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
                name="company_name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Razão Social *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: ABC Trading Co., Ltd." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="trade_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Fantasia</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: ABC Trading" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>País *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: China" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="tax_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax ID / CNPJ</FormLabel>
                  <FormControl>
                    <Input placeholder="Identificação fiscal" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Endereço</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Endereço</FormLabel>
                      <FormControl>
                        <Input placeholder="Rua, número, complemento" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade</FormLabel>
                      <FormControl>
                        <Input placeholder="Cidade" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="state_province"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado/Província</FormLabel>
                      <FormControl>
                        <Input placeholder="Estado ou província" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="postal_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP</FormLabel>
                      <FormControl>
                        <Input placeholder="Código postal" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Contato</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="contact_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Contato</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do responsável" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contact_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input placeholder="+55 11 99999-9999" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contact_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="contato@fornecedor.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input placeholder="https://www.fornecedor.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="payment_terms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Condições de Pagamento</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: 30% adiantado, 70% antes do embarque" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Configuração de Containers</h4>
              <p className="text-xs text-muted-foreground">
                Cubagem por tipo de container (deixe vazio para usar valores padrão)
              </p>
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="container_20_cbm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>20' Dry (m³)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.1"
                          placeholder="33" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="container_40_cbm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>40' Dry (m³)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.1"
                          placeholder="67" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="container_40hq_cbm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>40' HQ (m³)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.1"
                          placeholder="76" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Observações adicionais sobre o fornecedor..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
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
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
