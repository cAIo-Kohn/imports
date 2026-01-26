import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Shield, ShoppingCart, TrendingUp, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole, AppRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { CreateUserModal } from '@/components/users/CreateUserModal';
import { EditUserRoleModal } from '@/components/users/EditUserRoleModal';
import { format } from 'date-fns';

interface UserWithRoles {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  roles: AppRole[];
}

const roleConfig: Record<AppRole, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Shield }> = {
  admin: { label: 'Admin', variant: 'destructive', icon: Shield },
  buyer: { label: 'Buyer', variant: 'default', icon: ShoppingCart },
  trader: { label: 'Trader', variant: 'secondary', icon: TrendingUp },
  viewer: { label: 'Viewer', variant: 'outline', icon: Eye },
};

export default function Users() {
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: allRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      return (profiles || []).map(profile => ({
        ...profile,
        roles: (allRoles || [])
          .filter(r => r.user_id === profile.user_id)
          .map(r => r.role as AppRole),
      })) as UserWithRoles[];
    },
    enabled: isAdmin,
  });

  const handleEditRoles = (user: UserWithRoles) => {
    setSelectedUser(user);
    setEditModalOpen(true);
  };

  const handleDeleteClick = (user: UserWithRoles) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedUser) return;

    try {
      // Delete via edge function (requires admin API)
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('delete-user', {
        body: { userId: selectedUser.user_id },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (response.error) throw response.error;

      toast({
        title: 'User deleted',
        description: `${selectedUser.full_name || selectedUser.email} was removed from the system.`,
      });

      refetch();
    } catch (error: any) {
      toast({
        title: 'Error deleting user',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedUser(null);
    }
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Manage users and their system permissions.
          </p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New User
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Created at</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.full_name || '-'}
                    </TableCell>
                    <TableCell>{user.email || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => {
                          const config = roleConfig[role];
                          const Icon = config.icon;
                          return (
                            <Badge key={role} variant={config.variant} className="gap-1">
                              <Icon className="h-3 w-3" />
                              {config.label}
                            </Badge>
                          );
                        })}
                        {user.roles.length === 0 && (
                          <span className="text-muted-foreground text-sm">No roles</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(user.created_at), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditRoles(user)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(user)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateUserModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={() => {
          refetch();
          setCreateModalOpen(false);
        }}
      />

      <EditUserRoleModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        user={selectedUser}
        onSuccess={() => {
          refetch();
          setEditModalOpen(false);
          setSelectedUser(null);
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <strong>{selectedUser?.full_name || selectedUser?.email}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
