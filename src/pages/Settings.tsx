import { Settings as SettingsIcon, User, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

export default function Settings() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie as configurações do sistema</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Meu Perfil
            </CardTitle>
            <CardDescription>Informações da sua conta</CardDescription>
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
              Permissões
            </CardTitle>
            <CardDescription>Níveis de acesso do sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li><strong>Admin:</strong> Acesso total ao sistema</li>
              <li><strong>Comprador:</strong> Gerencia produtos, fornecedores e pedidos</li>
              <li><strong>Visualizador:</strong> Apenas visualização</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
