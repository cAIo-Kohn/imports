import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'admin' | 'buyer' | 'quality' | 'marketing' | 'trader' | 'viewer';

export function useUserRole() {
  const { user } = useAuth();

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['user-roles', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data.map(r => r.role as AppRole);
    },
    enabled: !!user?.id,
  });

  const hasRole = (role: AppRole): boolean => {
    return roles.includes(role);
  };

  const isAdmin = hasRole('admin');
  const isBuyer = hasRole('buyer');
  const isQuality = hasRole('quality');
  const isMarketing = hasRole('marketing');
  const isTrader = hasRole('trader');
  const isViewer = hasRole('viewer');

  // Helper para verificar se é APENAS trader (sem outras roles privilegiadas)
  const isOnlyTrader = isTrader && !isAdmin && !isBuyer;

  const canManageOrders = isAdmin || isBuyer;
  const canApproveAsTrader = isTrader;

  return {
    roles,
    isLoading,
    hasRole,
    isAdmin,
    isBuyer,
    isQuality,
    isMarketing,
    isTrader,
    isViewer,
    isOnlyTrader,
    canManageOrders,
    canApproveAsTrader,
  };
}
