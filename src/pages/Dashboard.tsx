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
      title: 'Products', 
      value: productCount, 
      loading: loadingProducts,
      description: 'registered', 
      icon: Package, 
      color: 'text-primary' 
    },
    { 
      title: 'Suppliers', 
      value: supplierCount, 
      loading: loadingSuppliers,
      description: 'active', 
      icon: Factory, 
      color: 'text-green-600' 
    },
    { 
      title: 'Units', 
      value: unitCount, 
      loading: loadingUnits,
      description: 'configured', 
      icon: Building2, 
      color: 'text-orange-600' 
    },
    { 
      title: 'Categories', 
      value: categoryCount, 
      loading: loadingCategories,
      description: 'created', 
      icon: FolderTree, 
      color: 'text-purple-600' 
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of the import management system</p>
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
              Next Steps
            </CardTitle>
            <CardDescription>Complete the system setup</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${unitCount && unitCount > 0 ? 'bg-green-500' : 'bg-muted'}`} />
                Register your destination units
              </li>
              <li className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${supplierCount && supplierCount > 0 ? 'bg-green-500' : 'bg-muted'}`} />
                Add your suppliers
              </li>
              <li className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${categoryCount && categoryCount > 0 ? 'bg-green-500' : 'bg-muted'}`} />
                Create categories to organize products
              </li>
              <li className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${productCount && productCount > 0 ? 'bg-green-500' : 'bg-muted'}`} />
                Register your imported products
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Purchase Orders
            </CardTitle>
            <CardDescription>Coming soon</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              In the next phase, you will be able to create purchase orders, track shipments and analyze supplier performance.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
