

## Plano: Restringir Acesso do Trader Apenas ao Painel do Trader

### Problema Identificado

O usuário com role "trader" consegue ver todas as abas/páginas porque:
1. O `AppSidebar` mostra todas as seções para todos os usuários autenticados
2. O `App.tsx` usa apenas `ProtectedRoute` que verifica autenticação, não roles
3. Não há redirecionamento automático para traders após login

### Regras de Acesso por Role

| Role | Páginas Visíveis |
|------|------------------|
| **Trader** | Apenas `/trader` (Painel do Trader) |
| **Buyer** | Tudo exceto `/trader` e `/users` |
| **Admin** | Tudo (acesso irrestrito) |

---

## Arquivos a Modificar

### 1. `src/components/layout/AppSidebar.tsx`

Adicionar lógica para verificar roles e mostrar apenas as seções permitidas:

```tsx
// Se for APENAS trader (sem admin ou buyer), mostrar só o painel trader
const isOnlyTrader = isTrader && !isAdmin && !isBuyer;

// Atualizar o hook para incluir isBuyer
const { isTrader, isAdmin, isBuyer, isLoading } = useUserRole();
```

**Mudanças na renderização:**

```tsx
{/* Menu Principal - esconder para traders puros */}
{!isOnlyTrader && (
  <SidebarGroup>
    <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
    {/* ... menuItems ... */}
  </SidebarGroup>
)}

{/* Planejamento - esconder para traders puros */}
{!isOnlyTrader && (
  <SidebarGroup>
    <SidebarGroupLabel>Planejamento</SidebarGroupLabel>
    {/* ... planningItems ... */}
  </SidebarGroup>
)}

{/* Trader - mostrar para trader e admin */}
{(isTrader || isAdmin) && (
  <SidebarGroup>
    <SidebarGroupLabel>Trader</SidebarGroupLabel>
    {/* ... /trader link ... */}
  </SidebarGroup>
)}

{/* Cadastros - apenas admin */}
{isAdmin && (
  <SidebarGroup>
    <SidebarGroupLabel>Cadastros</SidebarGroupLabel>
    {/* ... /users link ... */}
  </SidebarGroup>
)}

{/* Configurações - esconder para traders puros */}
{!isOnlyTrader && (
  <SidebarGroup>
    <SidebarGroupLabel>Configurações</SidebarGroupLabel>
    {/* ... settings link ... */}
  </SidebarGroup>
)}
```

### 2. `src/App.tsx`

Criar um componente de proteção específico para roles e redirecionar traders:

```tsx
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
  const { roles, isLoading: rolesLoading } = useUserRole();

  if (loading || rolesLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Verifica se o usuário tem pelo menos uma das roles permitidas
  const hasAccess = roles.some(role => allowedRoles.includes(role));
  
  if (!hasAccess) {
    return <Navigate to={redirectTo} replace />;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}

// Componente especial para a rota inicial que redireciona traders
function HomeRedirect({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isTrader, isAdmin, isBuyer, isLoading } = useUserRole();

  if (loading || isLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Se é apenas trader, redireciona para o painel
  const isOnlyTrader = isTrader && !isAdmin && !isBuyer;
  if (isOnlyTrader) {
    return <Navigate to="/trader" replace />;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
```

**Atualizar as rotas:**

```tsx
const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
    
    {/* Rota inicial com redirecionamento para traders */}
    <Route path="/" element={<HomeRedirect><Dashboard /></HomeRedirect>} />
    
    {/* Rotas que traders NÃO podem acessar */}
    <Route path="/products" element={
      <RoleProtectedRoute allowedRoles={['admin', 'buyer', 'viewer']} redirectTo="/trader">
        <Products />
      </RoleProtectedRoute>
    } />
    <Route path="/products/:id" element={
      <RoleProtectedRoute allowedRoles={['admin', 'buyer', 'viewer']} redirectTo="/trader">
        <ProductDetails />
      </RoleProtectedRoute>
    } />
    {/* ... repetir para outras rotas restritas ... */}
    
    {/* Rota do trader - acessível por trader e admin */}
    <Route path="/trader" element={
      <RoleProtectedRoute allowedRoles={['admin', 'trader']}>
        <TraderDashboard />
      </RoleProtectedRoute>
    } />
    
    {/* Rota de usuários - apenas admin */}
    <Route path="/users" element={
      <RoleProtectedRoute allowedRoles={['admin']} redirectTo="/">
        <Users />
      </RoleProtectedRoute>
    } />
    
    <Route path="*" element={<NotFound />} />
  </Routes>
);
```

### 3. `src/hooks/useUserRole.ts`

Adicionar helper para verificar se é "apenas trader":

```typescript
// Adicionar no retorno:
const isOnlyTrader = isTrader && !isAdmin && !isBuyer;

return {
  // ... propriedades existentes
  isOnlyTrader,
};
```

---

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Trader faz login | Vê Dashboard e todas as abas | Vai direto para `/trader` |
| Trader no sidebar | Vê todas as seções | Vê apenas "Painel do Trader" e logout |
| Trader acessa `/products` | Consegue acessar | Redirecionado para `/trader` |
| Buyer faz login | Vê Dashboard | Vê Dashboard (sem Painel Trader) |
| Admin faz login | Vê tudo | Continua vendo tudo |

---

## Seção Técnica

### Arquivos Modificados
1. `src/components/layout/AppSidebar.tsx` - Controle de visibilidade por role
2. `src/App.tsx` - Proteção de rotas e redirecionamento automático
3. `src/hooks/useUserRole.ts` - Helper `isOnlyTrader`

### Fluxo de Login do Trader
1. Trader faz login em `/auth`
2. `PublicRoute` redireciona para `/`
3. `HomeRedirect` detecta que é apenas trader
4. Redireciona automaticamente para `/trader`
5. Sidebar mostra apenas "Painel do Trader"

### Segurança
- Proteção acontece tanto no frontend (sidebar) quanto nas rotas
- Mesmo que trader tente acessar URL direta, será redirecionado
- RLS no banco de dados continua como camada adicional de segurança

