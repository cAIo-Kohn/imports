import { Settings as SettingsIcon, User, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

export default function Settings() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage system settings</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              My Profile
            </CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Email: </span>
                <span className="font-medium">{user?.email}</span>
              </div>
              <div>
                <span className="text-muted-foreground">ID: </span>
                <span className="font-mono text-xs">{user?.id}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Permissions
            </CardTitle>
            <CardDescription>System access levels</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li><strong>Admin:</strong> Full system access</li>
              <li><strong>Buyer:</strong> Manages products, suppliers and orders</li>
              <li><strong>Viewer:</strong> View only</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
