import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Check, ChevronsUpDown, Users, Briefcase, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { AppRole } from '@/hooks/useUserRole';
import { useRoleColors } from '@/hooks/useRoleColors';

interface AssignedUser {
  id: string;
  name: string;
  email: string;
}

interface ThreadAssignmentSelectProps {
  assignedUsers: AssignedUser[];
  assignedRole: AppRole | null;
  onAssignedUsersChange: (users: AssignedUser[]) => void;
  onAssignedRoleChange: (role: AppRole | null) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

const ROLES: { value: AppRole; label: string }[] = [
  { value: 'buyer', label: 'Comex' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'quality', label: 'Quality' },
  { value: 'trader', label: 'ARC' },
  { value: 'admin', label: 'Admin' },
];

export function ThreadAssignmentSelect({
  assignedUsers,
  assignedRole,
  onAssignedUsersChange,
  onAssignedRoleChange,
  disabled = false,
  required = true,
  className,
}: ThreadAssignmentSelectProps) {
  const [open, setOpen] = useState(false);
  const { getColorForRole } = useRoleColors();

  // Fetch all users with profiles
  const { data: users = [] } = useQuery({
    queryKey: ['all-users-for-assignment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .order('full_name');
      if (error) throw error;
      return data.map(p => ({
        id: p.user_id,
        name: p.full_name || p.email || 'Unknown',
        email: p.email || '',
      }));
    },
  });

  const toggleUser = (user: AssignedUser) => {
    const exists = assignedUsers.some(u => u.id === user.id);
    if (exists) {
      onAssignedUsersChange(assignedUsers.filter(u => u.id !== user.id));
    } else {
      onAssignedUsersChange([...assignedUsers, user]);
    }
  };

  const selectRole = (role: AppRole) => {
    if (assignedRole === role) {
      onAssignedRoleChange(null);
    } else {
      onAssignedRoleChange(role);
    }
  };

  const removeUser = (userId: string) => {
    onAssignedUsersChange(assignedUsers.filter(u => u.id !== userId));
  };

  const hasAssignment = assignedUsers.length > 0 || assignedRole !== null;

  const getDisplayText = () => {
    if (!hasAssignment) return 'Assign to...';
    const parts: string[] = [];
    if (assignedUsers.length > 0) {
      parts.push(`${assignedUsers.length} user${assignedUsers.length > 1 ? 's' : ''}`);
    }
    if (assignedRole) {
      const roleLabel = ROLES.find(r => r.value === assignedRole)?.label || assignedRole;
      parts.push(roleLabel);
    }
    return parts.join(' + ');
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between text-sm h-9",
              !hasAssignment && required && "border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/30"
            )}
            disabled={disabled}
          >
            <span className={cn(!hasAssignment && "text-muted-foreground")}>
              {getDisplayText()}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search users or roles..." />
            <CommandEmpty>No results found.</CommandEmpty>
            
            {/* Roles Section */}
            <CommandGroup heading="Department / Role">
              {ROLES.map((role) => {
                const roleColor = getColorForRole(role.value);
                const isSelected = assignedRole === role.value;
                return (
                  <CommandItem
                    key={role.value}
                    value={role.value}
                    onSelect={() => selectRole(role.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <Briefcase 
                      className="mr-2 h-4 w-4" 
                      style={{ color: roleColor.color }}
                    />
                    <span>{role.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            
            <CommandSeparator />
            
            {/* Users Section */}
            <CommandGroup heading="Specific Users">
              {users.map((user) => {
                const isSelected = assignedUsers.some(u => u.id === user.id);
                return (
                  <CommandItem
                    key={user.id}
                    value={`${user.name} ${user.email}`}
                    onSelect={() => toggleUser(user)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-sm">{user.name}</span>
                      {user.email && user.email !== user.name && (
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected items display */}
      {hasAssignment && (
        <div className="flex flex-wrap gap-1">
          {assignedRole && (
            <Badge 
              variant="outline" 
              className="text-xs gap-1"
              style={{ 
                borderColor: getColorForRole(assignedRole).color,
                backgroundColor: `${getColorForRole(assignedRole).color}15`
              }}
            >
              <Briefcase className="h-3 w-3" />
              {ROLES.find(r => r.value === assignedRole)?.label}
              <button
                type="button"
                onClick={() => onAssignedRoleChange(null)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {assignedUsers.map((user) => (
            <Badge 
              key={user.id} 
              variant="secondary" 
              className="text-xs gap-1"
            >
              {user.name.split(' ')[0]}
              <button
                type="button"
                onClick={() => removeUser(user.id)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {required && !hasAssignment && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Assignment required - select users or a department
        </p>
      )}
    </div>
  );
}
