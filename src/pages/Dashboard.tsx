import { Package, Factory, Building2, FolderTree, TrendingUp, ShoppingCart } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const { data: productCount, isLoading: loadingProducts } = useQuery({
    queryKey: ['dashboard-products-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    }
  });

  const { data: supplierCount, isLoading: loadingSuppliers } = useQuery({
    queryKey: ['dashboard-suppliers-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('suppliers')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);
      if (error) throw error;
      return count ?? 0;
    }
  });

  const { data: unitCount, isLoading: loadingUnits } = useQuery({
    queryKey: ['dashboard-units-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('units')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);
      if (error) throw error;
      return count ?? 0;
    }
  });

  const { data: categoryCount, isLoading: loadingCategories } = useQuery({
    queryKey: ['dashboard-categories-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('categories')
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    }
  });

  const stats = [
    { 
      title: 'Produtos', 
      value: productCount, 
      loading: loadingProducts,
      description: 'cadastrados', 
      icon: Package, 
      color: 'text-primary' 
    },
    { 
      title: 'Fornecedores', 
      value: supplierCount, 
      loading: loadingSuppliers,
      description: 'ativos', 
      icon: Factory, 
      color: 'text-green-600' 
    },
    { 
      title: 'Unidades', 
      value: unitCount, 
      loading: loadingUnits,
      description: 'configuradas', 
      icon: Building2, 
      color: 'text-orange-600' 
    },
    { 
      title: 'Categorias', 
      value: categoryCount, 
      loading: loadingCategories,
      description: 'criadas', 
      icon: FolderTree, 
      color: 'text-purple-600' 
    },
  ];

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
              {stat.loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{stat.value}</div>
              )}
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
                <div className={`h-2 w-2 rounded-full ${unitCount && unitCount > 0 ? 'bg-green-500' : 'bg-muted'}`} />
                Cadastre suas unidades de destino
              </li>
              <li className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${supplierCount && supplierCount > 0 ? 'bg-green-500' : 'bg-muted'}`} />
                Adicione seus fornecedores
              </li>
              <li className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${categoryCount && categoryCount > 0 ? 'bg-green-500' : 'bg-muted'}`} />
                Crie categorias para organizar produtos
              </li>
              <li className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${productCount && productCount > 0 ? 'bg-green-500' : 'bg-muted'}`} />
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
