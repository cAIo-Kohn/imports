import { useState, useEffect } from 'react';
import { Shield, ShoppingCart, TrendingUp, Eye, CheckCircle, Megaphone, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

interface UserWithRoles {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  roles: AppRole[];
}

interface EditUserRoleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserWithRoles | null;
  onSuccess: () => void;
}

const roleOptions: { value: AppRole; label: string; description: string; icon: typeof Shield }[] = [
  {
    value: 'admin',
    label: 'Administrator',
    description: 'Unrestricted access to all features',
    icon: Shield,
  },
  {
    value: 'buyer',
    label: 'Comex',
    description: 'Products, suppliers, planning and orders',
    icon: ShoppingCart,
  },
  {
    value: 'quality',
    label: 'Quality',
    description: 'Quality assurance and control',
    icon: CheckCircle,
  },
  {
    value: 'marketing',
    label: 'Marketing',
    description: 'Product marketing and branding',
    icon: Megaphone,
  },
  {
    value: 'trader',
    label: 'ARC',
    description: 'ARC dashboard and order editing',
    icon: TrendingUp,
  },
  {
    value: 'viewer',
    label: 'Viewer',
    description: 'View-only access to data',
    icon: Eye,
  },
];

export function EditUserRoleModal({ open, onOpenChange, user, onSuccess }: EditUserRoleModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (user) {
      setSelectedRoles(user.roles);
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [user]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    if (selectedRoles.length === 0) {
      toast({
        title: 'Select a role',
        description: 'User needs at least one role.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        toast({
          title: 'Password too short',
          description: 'Password must have at least 6 characters.',
          variant: 'destructive',
        });
        return;
      }
      if (newPassword !== confirmPassword) {
        toast({
          title: 'Passwords do not match',
          description: 'Please make sure both passwords are the same.',
          variant: 'destructive',
        });
        return;
      }
    }

    setLoading(true);

    try {
      // Delete existing roles
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', user.user_id);

      if (deleteError) throw deleteError;

      // Insert new roles
      const roleInserts = selectedRoles.map((role) => ({
        user_id: user.user_id,
        role,
      }));

      const { error: insertError } = await supabase
        .from('user_roles')
        .insert(roleInserts);

      if (insertError) throw insertError;

      // Update password if provided
      if (newPassword) {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await supabase.functions.invoke('update-user-password', {
          body: { userId: user.user_id, password: newPassword },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        if (response.error) throw response.error;
        const respData = response.data;
        if (respData?.error) throw new Error(respData.error);
      }

      toast({
        title: 'Permissions updated',
        description: `Permissions for ${user.full_name || user.email} were updated.${newPassword ? ' Password changed.' : ''}`,
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error updating permissions',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Permissions</DialogTitle>
          <DialogDescription>
            Change permissions for {user.full_name || user.email}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <Label>Permissions</Label>
            <div className="space-y-2">
              {roleOptions.map((option) => {
                const Icon = option.icon;
                const isChecked = selectedRoles.includes(option.value);
                return (
                  <label
                    key={option.value}
                    htmlFor={`edit-${option.value}`}
                    className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      id={`edit-${option.value}`}
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedRoles((prev) => [...prev, option.value]);
                        } else {
                          setSelectedRoles((prev) => prev.filter((r) => r !== option.value));
                        }
                      }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{option.label}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <Label>Change Password</Label>
              <span className="text-xs text-muted-foreground">(optional)</span>
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 6 characters)"
              />
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
