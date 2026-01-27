import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  estabelecimento_code: z.coerce.number().int().positive('Code must be a positive number'),
  cnpj: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
  phone: z.string().optional(),
  fax: z.string().optional(),
  responsible_name: z.string().optional(),
  responsible_email: z.string().email('Invalid email').optional().or(z.literal('')),
  responsible_phone: z.string().optional(),
  is_active: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface Unit {
  id: string;
  name: string;
  estabelecimento_code: number | null;
  cnpj: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  phone: string | null;
  fax: string | null;
  responsible_name: string | null;
  responsible_email: string | null;
  responsible_phone: string | null;
  is_active: boolean;
}

interface EditUnitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit: Unit | null;
}

export function EditUnitModal({ open, onOpenChange, unit }: EditUnitModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      estabelecimento_code: undefined,
      cnpj: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      phone: '',
      fax: '',
      responsible_name: '',
      responsible_email: '',
      responsible_phone: '',
      is_active: true,
    },
  });

  useEffect(() => {
    if (unit) {
      form.reset({
        name: unit.name,
        estabelecimento_code: unit.estabelecimento_code || undefined,
        cnpj: unit.cnpj || '',
        address: unit.address || '',
        city: unit.city || '',
        state: unit.state || '',
        zip_code: unit.zip_code || '',
        phone: unit.phone || '',
        fax: unit.fax || '',
        responsible_name: unit.responsible_name || '',
        responsible_email: unit.responsible_email || '',
        responsible_phone: unit.responsible_phone || '',
        is_active: unit.is_active,
      });
    }
  }, [unit, form]);

  const updateMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!unit) throw new Error('No unit selected');

      const { data, error } = await supabase
        .from('units')
        .update({
          name: values.name,
          estabelecimento_code: values.estabelecimento_code,
          cnpj: values.cnpj || null,
          address: values.address || null,
          city: values.city || null,
          state: values.state || null,
          zip_code: values.zip_code || null,
          phone: values.phone || null,
          fax: values.fax || null,
          responsible_name: values.responsible_name || null,
          responsible_email: values.responsible_email || null,
          responsible_phone: values.responsible_phone || null,
          is_active: values.is_active,
        })
        .eq('id', unit.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Unit updated successfully');
      queryClient.invalidateQueries({ queryKey: ['units'] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      if (error.message.includes('units_estabelecimento_code_unique')) {
        toast.error('This establishment code is already in use');
      } else {
        toast.error('Error updating unit: ' + error.message);
      }
    },
  });

  const onSubmit = (values: FormValues) => {
    updateMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Unit</DialogTitle>
          <DialogDescription>
            Update the unit information. The establishment code is used for automatic recognition in file uploads.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Matriz" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="estabelecimento_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Establishment Code *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g., 1"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Active</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Inactive units will not appear in selection lists
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cnpj"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CNPJ</FormLabel>
                  <FormControl>
                    <Input placeholder="00.000.000/0000-00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input placeholder="Street, number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="City" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input placeholder="SP" maxLength={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="zip_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ZIP Code</FormLabel>
                    <FormControl>
                      <Input placeholder="00000-000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="(00) 0000-0000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fax"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fax</FormLabel>
                    <FormControl>
                      <Input placeholder="(00) 0000-0000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t pt-4">
              <Label className="text-sm font-medium">Contact Information</Label>
            </div>

            <FormField
              control={form.control}
              name="responsible_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Responsible Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Full name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="responsible_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="responsible_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="(00) 00000-0000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
