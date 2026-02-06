import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import ProductDetails from "./pages/ProductDetails";
import Suppliers from "./pages/Suppliers";
import SupplierDetails from "./pages/SupplierDetails";
import Units from "./pages/Units";
import Categories from "./pages/Categories";
import Settings from "./pages/Settings";
import DemandPlanning from "./pages/DemandPlanning";
import SupplierPlanning from "./pages/SupplierPlanning";
import PurchaseOrders from "./pages/PurchaseOrders";
import PurchaseOrderDetails from "./pages/PurchaseOrderDetails";
import TraderDashboard from "./pages/TraderDashboard";
import Users from "./pages/Users";
import Development from "./pages/Development";
import NewProducts from "./pages/NewProducts";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Componente para proteção baseada em role
function RoleProtectedRoute({ 
  children, 
  allowedRoles,
  redirectTo = '/'
}: { 
  children: React.ReactNode;
  allowedRoles: AppRole[];
  redirectTo?: string;
}) {
  const { user, loading } = useAuth();
  const { roles, isLoading: rolesLoading, isOnlyTrader } = useUserRole();

  if (loading || rolesLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Verifica se o usuário tem pelo menos uma das roles permitidas
  const hasAccess = roles.some(role => allowedRoles.includes(role));
  
  if (!hasAccess) {
    // Se for apenas trader, redireciona para /trader
    const finalRedirect = isOnlyTrader ? '/trader' : redirectTo;
    return <Navigate to={finalRedirect} replace />;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}

// Componente especial para a rota inicial que redireciona traders
function HomeRedirect({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isOnlyTrader, isLoading } = useUserRole();

  if (loading || isLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Se é apenas trader, redireciona para o painel do trader
  if (isOnlyTrader) {
    return <Navigate to="/trader" replace />;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
    
    {/* Rota inicial com redirecionamento para traders */}
    <Route path="/" element={<HomeRedirect><Dashboard /></HomeRedirect>} />
    
    {/* Development / New Items & Samples - accessible by all roles including traders */}
    <Route path="/development" element={
      <RoleProtectedRoute allowedRoles={['admin', 'buyer', 'viewer', 'trader']}>
        <Development />
      </RoleProtectedRoute>
    } />
    
    {/* Rotas que traders NÃO podem acessar */}
    <Route path="/new-products" element={
      <RoleProtectedRoute allowedRoles={['admin', 'buyer', 'quality', 'marketing', 'viewer']}>
        <NewProducts />
      </RoleProtectedRoute>
    } />
    <Route path="/products" element={
      <RoleProtectedRoute allowedRoles={['admin', 'buyer', 'quality', 'marketing', 'viewer']}>
        <Products />
      </RoleProtectedRoute>
    } />
    <Route path="/products/:id" element={
      <RoleProtectedRoute allowedRoles={['admin', 'buyer', 'quality', 'marketing', 'viewer']}>
        <ProductDetails />
      </RoleProtectedRoute>
    } />
    <Route path="/units" element={
      <RoleProtectedRoute allowedRoles={['admin', 'buyer', 'quality', 'marketing', 'viewer']}>
        <Units />
      </RoleProtectedRoute>
    } />
    <Route path="/suppliers" element={
      <RoleProtectedRoute allowedRoles={['admin', 'buyer', 'quality', 'marketing', 'viewer']}>
        <Suppliers />
      </RoleProtectedRoute>
    } />
    <Route path="/suppliers/:id" element={
      <RoleProtectedRoute allowedRoles={['admin', 'buyer', 'quality', 'marketing', 'viewer']}>
        <SupplierDetails />
      </RoleProtectedRoute>
    } />
    <Route path="/categories" element={
      <RoleProtectedRoute allowedRoles={['admin', 'buyer', 'quality', 'marketing', 'viewer']}>
        <Categories />
      </RoleProtectedRoute>
    } />
    <Route path="/settings" element={
      <RoleProtectedRoute allowedRoles={['admin', 'buyer', 'quality', 'marketing', 'viewer']}>
        <Settings />
      </RoleProtectedRoute>
    } />
    <Route path="/demand-planning" element={
      <RoleProtectedRoute allowedRoles={['admin', 'buyer', 'quality', 'marketing', 'viewer']}>
        <DemandPlanning />
      </RoleProtectedRoute>
    } />
    <Route path="/demand-planning/:id" element={
      <RoleProtectedRoute allowedRoles={['admin', 'buyer', 'quality', 'marketing', 'viewer']}>
        <SupplierPlanning />
      </RoleProtectedRoute>
    } />
    <Route path="/purchase-orders" element={
      <RoleProtectedRoute allowedRoles={['admin', 'buyer', 'quality', 'marketing', 'viewer']}>
        <PurchaseOrders />
      </RoleProtectedRoute>
    } />
    <Route path="/purchase-orders/:id" element={
      <RoleProtectedRoute allowedRoles={['admin', 'buyer', 'quality', 'marketing', 'viewer', 'trader']}>
        <PurchaseOrderDetails />
      </RoleProtectedRoute>
    } />
    
    {/* Rota do trader - acessível por trader e admin */}
    <Route path="/trader" element={
      <RoleProtectedRoute allowedRoles={['admin', 'trader']}>
        <TraderDashboard />
      </RoleProtectedRoute>
    } />
    
    {/* Rota de usuários - apenas admin */}
    <Route path="/users" element={
      <RoleProtectedRoute allowedRoles={['admin']}>
        <Users />
      </RoleProtectedRoute>
    } />
    
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
