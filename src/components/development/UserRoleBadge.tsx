import { useRoleColors } from '@/hooks/useRoleColors';
import { AppRole } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';

interface UserRoleBadgeProps {
  roles: AppRole[];
  className?: string;
  showAll?: boolean; // If true, show all roles; if false, show only primary role
}

// Priority order for determining "primary" role
const ROLE_PRIORITY: AppRole[] = ['admin', 'buyer', 'trader', 'quality', 'marketing', 'viewer'];

export function UserRoleBadge({ roles, className, showAll = false }: UserRoleBadgeProps) {
  const { getColorForRole } = useRoleColors();
  
  if (!roles || roles.length === 0) return null;
  
  // Sort roles by priority to show primary role first
  const sortedRoles = [...roles].sort((a, b) => {
    const aIndex = ROLE_PRIORITY.indexOf(a);
    const bIndex = ROLE_PRIORITY.indexOf(b);
    return aIndex - bIndex;
  });
  
  const rolesToShow = showAll ? sortedRoles : [sortedRoles[0]];
  
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {rolesToShow.map((role) => {
        const { color, label } = getColorForRole(role);
        return (
          <span
            key={role}
            className="inline-flex items-center px-1.5 py-0 text-[10px] font-medium rounded-full"
            style={{ 
              backgroundColor: `${color}20`, 
              color: color,
              border: `1px solid ${color}40`
            }}
          >
            {label}
          </span>
        );
      })}
    </span>
  );
}

// Simplified inline version for compact displays
export function UserRoleDot({ roles, className }: { roles: AppRole[]; className?: string }) {
  const { getColorForRole } = useRoleColors();
  
  if (!roles || roles.length === 0) return null;
  
  // Get the primary role
  const sortedRoles = [...roles].sort((a, b) => {
    const aIndex = ROLE_PRIORITY.indexOf(a);
    const bIndex = ROLE_PRIORITY.indexOf(b);
    return aIndex - bIndex;
  });
  
  const { color, label } = getColorForRole(sortedRoles[0]);
  
  return (
    <span
      className={cn("inline-block w-2 h-2 rounded-full flex-shrink-0", className)}
      style={{ backgroundColor: color }}
      title={label}
    />
  );
}
