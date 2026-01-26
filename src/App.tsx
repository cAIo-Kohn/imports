import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
    <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
    <Route path="/products/:id" element={<ProtectedRoute><ProductDetails /></ProtectedRoute>} />
    <Route path="/units" element={<ProtectedRoute><Units /></ProtectedRoute>} />
    <Route path="/suppliers" element={<ProtectedRoute><Suppliers /></ProtectedRoute>} />
    <Route path="/suppliers/:id" element={<ProtectedRoute><SupplierDetails /></ProtectedRoute>} />
    <Route path="/categories" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
    <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
    <Route path="/demand-planning" element={<ProtectedRoute><DemandPlanning /></ProtectedRoute>} />
    <Route path="/demand-planning/:id" element={<ProtectedRoute><SupplierPlanning /></ProtectedRoute>} />
    <Route path="/purchase-orders" element={<ProtectedRoute><PurchaseOrders /></ProtectedRoute>} />
    <Route path="/purchase-orders/:id" element={<ProtectedRoute><PurchaseOrderDetails /></ProtectedRoute>} />
    <Route path="/trader" element={<ProtectedRoute><TraderDashboard /></ProtectedRoute>} />
    <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
