

## Plano: Sistema de Gerenciamento de Usuários e Roles

### Objetivo

Criar nova seção "Cadastros" no menu lateral (visível apenas para Admin) com funcionalidade para:
1. Listar todos os usuários do sistema
2. Criar novos usuários
3. Atribuir roles (Admin, Comprador, Trader)

---

### Estrutura de Roles

| Role | Descrição | Acesso |
|------|-----------|--------|
| **Admin** | Acesso irrestrito | Tudo + Gerenciamento de usuários |
| **Buyer** (Comprador) | Operações do dia-a-dia | Produtos, Fornecedores, Planejamento, Pedidos (exceto Painel Trader) |
| **Trader** | Gestão de pedidos China | Painel Trader + edição de dados em pedidos |

Nota: O enum `app_role` atual já inclui: `admin`, `buyer`, `viewer`, `trader`

---

### Arquivos a Criar

#### 1. `src/pages/Users.tsx` - Página de Gerenciamento de Usuários

Componente principal com:
- Lista de usuários com suas roles
- Botão "Novo Usuário"
- Ações de editar role e excluir usuário

```typescript
interface UserWithRole {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  roles: AppRole[];
  created_at: string;
}
```

Funcionalidades:
- Query para buscar profiles + user_roles
- Tabela com colunas: Nome, Email, Roles, Data Criação, Ações
- Badge colorido por role (Admin=vermelho, Comprador=azul, Trader=verde)

#### 2. `src/components/users/CreateUserModal.tsx` - Modal de Criação

Formulário com:
- Nome completo (obrigatório)
- Email (obrigatório)
- Senha (obrigatório, min 6 caracteres)
- Seleção de Role (checkboxes múltiplos)

#### 3. `src/components/users/EditUserRoleModal.tsx` - Modal de Edição de Role

Permite alterar as roles de um usuário existente sem alterar senha/email.

#### 4. `supabase/functions/create-user/index.ts` - Edge Function

Necessária porque criar usuários via Admin API requer `service_role_key`:

```typescript
// Usa supabase.auth.admin.createUser() com service_role_key
// Cria usuário + profile + role inicial
```

---

### Arquivos a Modificar

#### 1. `src/components/layout/AppSidebar.tsx`

Adicionar nova seção "Cadastros" visível apenas para admin:

```tsx
{isAdmin && (
  <SidebarGroup>
    <SidebarGroupLabel>Cadastros</SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={location.pathname === '/users'}>
            <NavLink to="/users">
              <Users className="h-4 w-4" />
              <span>Usuários</span>
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
)}
```

#### 2. `src/App.tsx`

Adicionar nova rota:

```tsx
import Users from "./pages/Users";

// Na área de rotas
<Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
```

---

### Edge Function: create-user

Como a criação de usuários requer a `service_role_key` (não disponível no cliente), precisamos de uma edge function:

```typescript
// supabase/functions/create-user/index.ts
import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verificar se o usuário que está chamando é admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: callingUser } } = await supabaseClient.auth.getUser()
    if (!callingUser) throw new Error('Not authenticated')

    // Verificar se é admin
    const { data: roleCheck } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', callingUser.id)
      .eq('role', 'admin')
      .single()

    if (!roleCheck) throw new Error('Not authorized - admin only')

    // Criar usuário com service_role
    const { email, password, fullName, roles } = await req.json()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirma o email
      user_metadata: { full_name: fullName }
    })

    if (createError) throw createError

    // Profile é criado automaticamente pelo trigger handle_new_user
    // Mas precisamos adicionar as roles adicionais se houver
    if (roles && roles.length > 0 && newUser.user) {
      // Remover role padrão 'viewer' e adicionar as selecionadas
      await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', newUser.user.id)

      const roleInserts = roles.map((role: string) => ({
        user_id: newUser.user.id,
        role
      }))

      await supabaseAdmin.from('user_roles').insert(roleInserts)
    }

    return new Response(
      JSON.stringify({ user: newUser.user }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

---

### Componente Users.tsx - Estrutura Detalhada

```tsx
// Queries
const { data: usersData } = useQuery({
  queryKey: ['all-users'],
  queryFn: async () => {
    // Buscar profiles com suas roles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    const { data: allRoles } = await supabase
      .from('user_roles')
      .select('user_id, role')

    // Combinar dados
    return profiles.map(p => ({
      ...p,
      roles: allRoles.filter(r => r.user_id === p.user_id).map(r => r.role)
    }))
  }
})
```

---

### Interface Visual

```text
┌─────────────────────────────────────────────────────┐
│ Usuários                        [+ Novo Usuário]    │
├─────────────────────────────────────────────────────┤
│ Nome          │ Email              │ Roles    │ ... │
├───────────────┼────────────────────┼──────────┼─────┤
│ Caio Kohn     │ caio@mor.com.br    │ [Admin]  │ ... │
│ João Silva    │ joao@empresa.com   │ [Buyer]  │ ... │
│ Maria Trader  │ maria@trading.com  │ [Trader] │ ... │
└─────────────────────────────────────────────────────┘
```

---

### Proteção de Rota

A página `/users` será acessível apenas para admin. Adicionar verificação na página:

```tsx
const { isAdmin, isLoading } = useUserRole();

if (!isAdmin && !isLoading) {
  return <Navigate to="/" replace />;
}
```

---

### Resumo das Alterações

| Arquivo | Ação |
|---------|------|
| `src/pages/Users.tsx` | Criar |
| `src/components/users/CreateUserModal.tsx` | Criar |
| `src/components/users/EditUserRoleModal.tsx` | Criar |
| `supabase/functions/create-user/index.ts` | Criar |
| `src/components/layout/AppSidebar.tsx` | Modificar - adicionar seção Cadastros |
| `src/App.tsx` | Modificar - adicionar rota /users |

### Seção Técnica

#### Segurança
- Edge function valida que apenas admins podem criar usuários
- RLS existente na `user_roles` já protege: apenas admin pode gerenciar roles
- RLS existente na `profiles` permite que admin veja todos os perfis

#### Fluxo de Criação de Usuário
1. Admin preenche formulário
2. Frontend chama edge function `create-user`
3. Edge function valida que chamador é admin
4. Cria usuário via Admin API com email auto-confirmado
5. Trigger `handle_new_user` cria profile e role padrão
6. Edge function substitui role padrão pelas selecionadas
7. Retorna sucesso

#### Labels de Role no UI
- **Admin**: Badge vermelho
- **Comprador** (buyer): Badge azul
- **Trader**: Badge verde

