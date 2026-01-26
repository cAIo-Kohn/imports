import { useState } from 'react';
import { Shield, ShoppingCart, TrendingUp, Eye } from 'lucide-react';
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

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
    label: 'Buyer',
    description: 'Products, suppliers, planning and orders',
    icon: ShoppingCart,
  },
  {
    value: 'trader',
    label: 'Trader',
    description: 'Trader dashboard and order editing',
    icon: TrendingUp,
  },
  {
    value: 'viewer',
    label: 'Viewer',
    description: 'View-only access to data',
    icon: Eye,
  },
];

export function CreateUserModal({ open, onOpenChange, onSuccess }: CreateUserModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setSelectedRoles([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName || !email || !password) {
      toast({
        title: 'Required fields',
        description: 'Fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: 'Password too short',
        description: 'Password must have at least 6 characters.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedRoles.length === 0) {
      toast({
        title: 'Select a role',
        description: 'User needs at least one role.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await supabase.functions.invoke('create-user', {
        body: {
          email,
          password,
          fullName,
          roles: selectedRoles,
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (response.error) throw response.error;

      const data = response.data;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'User created',
        description: `${fullName} was added to the system.`,
      });

      resetForm();
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error creating user',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New User</DialogTitle>
          <DialogDescription>
            Create a new user and set their permissions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name *</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter full name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@company.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password *</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
            />
          </div>

          <div className="space-y-3">
            <Label>Permissions *</Label>
            <div className="space-y-2">
              {roleOptions.map((option) => {
                const Icon = option.icon;
                const isChecked = selectedRoles.includes(option.value);
                return (
                  <label
                    key={option.value}
                    htmlFor={option.value}
                    className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      id={option.value}
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
