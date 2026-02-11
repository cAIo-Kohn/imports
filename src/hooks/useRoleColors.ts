import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppRole } from './useUserRole';

interface RoleColor {
  id: string;
  role: AppRole;
  color_hex: string;
  label: string;
}

const DEFAULT_COLORS: Record<string, { color_hex: string; label: string }> = {
  admin: { color_hex: '#8B5CF6', label: 'Admin' },
  buyer: { color_hex: '#3B82F6', label: 'Comex' },
  quality: { color_hex: '#14B8A6', label: 'Quality' },
  marketing: { color_hex: '#EC4899', label: 'Marketing' },
  trader: { color_hex: '#10B981', label: 'ARC' },
  viewer: { color_hex: '#6B7280', label: 'Viewer' },
};

export function useRoleColors() {
  const { data: colors = [], isLoading } = useQuery({
    queryKey: ['role-card-colors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_card_colors')
        .select('*')
        .order('role');
      if (error) throw error;
      return data as RoleColor[];
    },
  });

  const getColorForRole = (role: string | null | undefined): { color: string; label: string } => {
    if (!role) return { color: '#6B7280', label: 'Unknown' };
    
    const found = colors.find(c => c.role === role);
    if (found) return { color: found.color_hex, label: found.label };
    
    const defaultColor = DEFAULT_COLORS[role];
    if (defaultColor) return { color: defaultColor.color_hex, label: defaultColor.label };
    
    return { color: '#6B7280', label: 'Unknown' };
  };

  return { colors, isLoading, getColorForRole };
}
