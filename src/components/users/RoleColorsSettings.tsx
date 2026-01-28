import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRoleColors } from '@/hooks/useRoleColors';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

export function RoleColorsSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { colors, isLoading } = useRoleColors();

  const updateMutation = useMutation({
    mutationFn: async ({ id, color_hex }: { id: string; color_hex: string }) => {
      const { error } = await supabase
        .from('role_card_colors')
        .update({ color_hex, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-card-colors'] });
      toast({
        title: 'Color updated',
        description: 'Card color has been updated successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update color.',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Card Colors by Department</CardTitle>
          <CardDescription>Customize the color indicator displayed on development cards for each role.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Card Colors by Department</CardTitle>
        <CardDescription>
          Customize the color indicator displayed on development cards for each role.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {colors.map((item) => (
            <div 
              key={item.role} 
              className="flex items-center gap-3 p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
            >
              <input
                type="color"
                value={item.color_hex}
                onChange={(e) => updateMutation.mutate({ 
                  id: item.id, 
                  color_hex: e.target.value 
                })}
                className="w-12 h-12 rounded-lg cursor-pointer border-2 border-border"
                title={`Change color for ${item.label}`}
              />
              <div className="flex-1">
                <p className="font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground font-mono">{item.color_hex}</p>
              </div>
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: item.color_hex }}
                title="Preview"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
