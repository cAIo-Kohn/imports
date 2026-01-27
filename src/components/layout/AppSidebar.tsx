import { Package, Factory, Building2, FolderTree, LayoutDashboard, LogOut, Settings, TrendingUp, ShoppingCart, UserCheck, Users, Lightbulb } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

const menuItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'New Items & Samples', url: '/development', icon: Lightbulb },
  { title: 'Products', url: '/products', icon: Package },
  { title: 'Suppliers', url: '/suppliers', icon: Factory },
  { title: 'Units', url: '/units', icon: Building2 },
  { title: 'Categories', url: '/categories', icon: FolderTree },
];

const planningItems = [
  { title: 'Demand Planning', url: '/demand-planning', icon: TrendingUp },
  { title: 'Purchase Orders', url: '/purchase-orders', icon: ShoppingCart },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { isTrader, isAdmin, isOnlyTrader } = useUserRole();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-6 py-4">
        <div className="flex items-center gap-2">
          <Package className="h-8 w-8 text-sidebar-primary" />
          <div>
            <h1 className="text-lg font-bold text-sidebar-foreground">MOR Imports</h1>
            <p className="text-xs text-sidebar-foreground/60">Import Management</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        {/* Main Menu - hide for pure traders */}
        {!isOnlyTrader && (
          <SidebarGroup>
            <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                      <NavLink to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Planning - hide for pure traders */}
        {!isOnlyTrader && (
          <SidebarGroup>
            <SidebarGroupLabel>Planning</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {planningItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                      <NavLink to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Trader - show for trader and admin */}
        {(isTrader || isAdmin) && (
          <SidebarGroup>
            <SidebarGroupLabel>Trader</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === '/trader'}>
                    <NavLink to="/trader">
                      <UserCheck className="h-4 w-4" />
                      <span>Trader Dashboard</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Registry - admin only */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Registry</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === '/users'}>
                    <NavLink to="/users">
                      <Users className="h-4 w-4" />
                      <span>Users</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Settings - hide for pure traders */}
        {!isOnlyTrader && (
          <SidebarGroup>
            <SidebarGroupLabel>Settings</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === '/settings'}>
                    <NavLink to="/settings">
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex flex-col gap-2">
          <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
