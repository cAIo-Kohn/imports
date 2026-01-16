import { Package, Factory, Building2, FolderTree, TrendingUp, ShoppingCart } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const stats = [
  { title: 'Produtos', value: '0', description: 'cadastrados', icon: Package, color: 'text-primary' },
  { title: 'Fornecedores', value: '0', description: 'ativos', icon: Factory, color: 'text-green-600' },
  { title: 'Unidades', value: '0', description: 'configuradas', icon: Building2, color: 'text-orange-600' },
  { title: 'Categorias', value: '0', description: 'criadas', icon: FolderTree, color: 'text-purple-600' },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do sistema de gestão de importados</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Próximos Passos
            </CardTitle>
            <CardDescription>Complete a configuração do sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                Cadastre suas unidades de destino
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-muted" />
                Adicione seus fornecedores
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-muted" />
                Crie categorias para organizar produtos
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-muted" />
                Cadastre seus produtos importados
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Pedidos de Compra
            </CardTitle>
            <CardDescription>Funcionalidade em breve</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Na próxima fase, você poderá criar pedidos de compra, acompanhar embarques e analisar o desempenho dos fornecedores.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
