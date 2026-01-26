
## Plan: Rename Dashboard to "MOR Imports" and Translate UI to English

### Objective

1. Change the app name from "ImportFlow" to "MOR Imports"
2. Translate all menu names, column headers, labels, and UI text to English

---

### Files to Modify

#### 1. `index.html` - App Title and Meta Tags
```
Lines 7-12: Change title and meta tags from "Lovable App" to "MOR Imports"
```

#### 2. `src/components/layout/AppSidebar.tsx` - Sidebar Menu
| Portuguese | English |
|------------|---------|
| ImportFlow | MOR Imports |
| Gestão de Importados | Import Management |
| Menu Principal | Main Menu |
| Dashboard | Dashboard |
| Produtos | Products |
| Fornecedores | Suppliers |
| Unidades | Units |
| Categorias | Categories |
| Planejamento | Planning |
| Pedidos de Compra | Purchase Orders |
| Trader | Trader |
| Painel do Trader | Trader Dashboard |
| Cadastros | Registry |
| Usuários | Users |
| Configurações | Settings |
| Sair | Sign Out |

#### 3. `src/pages/Auth.tsx` - Login Page
| Portuguese | English |
|------------|---------|
| ImportFlow | MOR Imports |
| Gestão de Produtos Importados | Import Products Management |
| Entrar | Sign In |
| Cadastrar | Sign Up |
| Email inválido | Invalid email |
| Senha deve ter no mínimo 6 caracteres | Password must have at least 6 characters |
| As senhas não coincidem | Passwords don't match |
| Nome deve ter no mínimo 2 caracteres | Name must have at least 2 characters |
| Erro ao entrar | Login error |
| Erro ao cadastrar | Signup error |
| Nome completo | Full name |
| Senha | Password |
| Confirmar senha | Confirm password |
| Criar conta | Create account |

#### 4. `src/pages/Dashboard.tsx` - Main Dashboard
| Portuguese | English |
|------------|---------|
| Dashboard | Dashboard |
| Visão geral do sistema de gestão de importados | Overview of the import management system |
| Produtos | Products |
| cadastrados | registered |
| Fornecedores | Suppliers |
| ativos | active |
| Unidades | Units |
| configuradas | configured |
| Categorias | Categories |
| criadas | created |
| Próximos Passos | Next Steps |
| Complete a configuração do sistema | Complete the system setup |
| Cadastre suas unidades de destino | Register your destination units |
| Adicione seus fornecedores | Add your suppliers |
| Crie categorias para organizar produtos | Create categories to organize products |
| Cadastre seus produtos importados | Register your imported products |
| Pedidos de Compra | Purchase Orders |
| Funcionalidade em breve | Coming soon |

#### 5. `src/pages/Products.tsx` - Products List
| Portuguese | English |
|------------|---------|
| Produtos | Products |
| Gerencie seus produtos importados | Manage your imported products |
| Importar Produtos | Import Products |
| Importar Detalhes | Import Details |
| Dados Cadastrais | Cadastral Data |
| Novo Produto | New Product |
| Buscar por código ou descrição... | Search by code or description... |
| Status | Status |
| Todos os status | All statuses |
| Fornecedor | Supplier |
| Todos os fornecedores | All suppliers |
| Sem fornecedor | No supplier |
| Mais filtros | More filters |
| Filtros Avançados | Advanced Filters |
| Apenas incompletos | Incomplete only |
| Marca | Brand |
| Todas as marcas | All brands |
| Prefixo NCM | NCM Prefix |
| Limpar filtros | Clear filters |
| Código | Code |
| Descrição | Description |
| NCM | NCM |
| Qtd/Caixa | Qty/Box |
| Peso Bruto | Gross Weight |
| Unidades | Units |
| (table column headers and all tooltips) |

#### 6. `src/pages/Suppliers.tsx` - Suppliers List
| Portuguese | English |
|------------|---------|
| Fornecedores | Suppliers |
| Gerencie seus fornecedores internacionais | Manage your international suppliers |
| Importar | Import |
| Novo Fornecedor | New Supplier |
| Buscar fornecedores... | Search suppliers... |
| fornecedor(es) | supplier(s) |
| Lista de Fornecedores | Supplier List |
| Nenhum fornecedor cadastrado ainda | No suppliers registered yet |
| Localização | Location |
| Contato | Contact |
| Produtos | Products |
| Status | Status |
| Ações | Actions |
| Ativo | Active |
| Inativo | Inactive |
| Excluir fornecedor | Delete supplier |
| Nenhum fornecedor encontrado | No suppliers found |
| Comece cadastrando seu primeiro fornecedor | Start by registering your first supplier |
| Cadastrar Fornecedor | Register Supplier |

#### 7. `src/pages/TraderDashboard.tsx` - Trader Dashboard
| Portuguese | English |
|------------|---------|
| Painel do Trader | Trader Dashboard |
| Pedidos de fornecedores chineses aguardando sua revisão e aprovação | Orders from Chinese suppliers awaiting your review and approval |
| Pedidos Pendentes | Pending Orders |
| aguardando revisão | awaiting review |
| Com ETD Definido | With ETD Set |
| prontos para aprovar | ready to approve |
| Sem ETD | Without ETD |
| precisam de data | need date |
| Pedidos Aguardando Aprovação | Orders Awaiting Approval |
| Clique em um pedido para revisar, editar e aprovar ETD, preços e quantidades | Click on an order to review, edit and approve ETD, prices and quantities |
| Nenhum pedido pendente | No pending orders |
| Todos os pedidos de fornecedores chineses foram revisados | All orders from Chinese suppliers have been reviewed |
| Acesso Restrito | Restricted Access |
| Esta página é exclusiva para traders | This page is for traders only |
| Voltar ao Início | Back to Home |
| Pedido | Order |
| Fornecedor | Supplier |
| Data Criação | Created Date |
| Containers | Containers |
| Não definido | Not set |

#### 8. `src/pages/PurchaseOrders.tsx` - Purchase Orders
| Portuguese | English |
|------------|---------|
| Pedidos de Compra | Purchase Orders |
| Gerencie seus pedidos de importação | Manage your import orders |
| Novo Pedido | New Order |
| Total de Pedidos | Total Orders |
| pedidos registrados | orders registered |
| Aguard. Trader | Awaiting Trader |
| aguardando aprovação | awaiting approval |
| Mudanças Pendentes | Pending Changes |
| requerem aprovação | require approval |
| Valor Total | Total Value |
| Buscar por número ou fornecedor... | Search by number or supplier... |
| Todos os Status | All Statuses |
| Rascunho | Draft |
| Confirmado | Confirmed |
| Embarcado | Shipped |
| Recebido | Received |
| Cancelado | Cancelled |
| Lista de Pedidos | Order List |
| Clique em um pedido para ver os detalhes | Click on an order to see details |
| Número | Number |
| ETD | ETD |
| Nenhum pedido de compra registrado. Crie o primeiro! | No purchase orders registered. Create the first one! |
| Nenhum pedido encontrado com os filtros aplicados. | No orders found with the applied filters. |
| Excluir pedido | Delete order |
| Cancelar | Cancel |
| Excluir | Delete |

#### 9. `src/pages/DemandPlanning.tsx` - Demand Planning
| Portuguese | English |
|------------|---------|
| Planejamento de Demanda | Demand Planning |
| Selecione um fornecedor para analisar a projeção de estoque | Select a supplier to analyze stock projection |
| Dados atualizados | Data updated |
| Os indicadores foram recalculados... | The indicators were recalculated... |
| Importar Previsões | Import Forecasts |
| Importar Estoque | Import Inventory |
| Importar Histórico | Import History |
| Importar Chegadas | Import Arrivals |
| Resumo Geral | General Summary |
| produtos analisados | products analyzed |
| Crítico (3m) | Critical (3m) |
| Alerta (6m) | Alert (6m) |
| Atenção (9m) | Attention (9m) |
| OK (12m) | OK (12m) |
| Saúde do Estoque por Fornecedor | Stock Health by Supplier |
| Fornecedores ordenados por urgência | Suppliers sorted by urgency |
| Carregando dados e calculando indicadores... | Loading data and calculating indicators... |

#### 10. `src/pages/Users.tsx` - Users Management
| Portuguese | English |
|------------|---------|
| Usuários | Users |
| Gerencie os usuários e suas permissões no sistema | Manage users and their system permissions |
| Novo Usuário | New User |
| Nome | Name |
| Email | Email |
| Roles | Roles |
| Criado em | Created at |
| Ações | Actions |
| Nenhum usuário encontrado | No users found |
| Admin | Admin |
| Comprador | Buyer |
| Trader | Trader |
| Visualizador | Viewer |
| Sem roles | No roles |
| Excluir usuário? | Delete user? |
| Tem certeza que deseja excluir | Are you sure you want to delete |
| Esta ação não pode ser desfeita | This action cannot be undone |
| Cancelar | Cancel |
| Excluir | Delete |
| Usuário excluído | User deleted |
| foi removido do sistema | was removed from the system |

#### 11. `src/components/users/CreateUserModal.tsx` - Create User Modal
| Portuguese | English |
|------------|---------|
| Novo Usuário | New User |
| Crie um novo usuário e defina suas permissões | Create a new user and set their permissions |
| Nome completo | Full name |
| Digite o nome completo | Enter full name |
| Email | Email |
| Senha | Password |
| Mínimo 6 caracteres | Minimum 6 characters |
| Permissões | Permissions |
| Administrador | Administrator |
| Acesso irrestrito a todas as funcionalidades | Unrestricted access to all features |
| Comprador | Buyer |
| Produtos, fornecedores, planejamento e pedidos | Products, suppliers, planning and orders |
| Trader | Trader |
| Painel do trader e edição de pedidos | Trader panel and order editing |
| Visualizador | Viewer |
| Apenas visualização de dados | View-only access to data |
| Cancelar | Cancel |
| Criar Usuário | Create User |
| Criando... | Creating... |
| Campos obrigatórios | Required fields |
| Preencha todos os campos obrigatórios | Fill in all required fields |
| Senha muito curta | Password too short |
| A senha deve ter pelo menos 6 caracteres | Password must have at least 6 characters |
| Selecione uma role | Select a role |
| O usuário precisa ter pelo menos uma role | User needs at least one role |
| Usuário criado | User created |
| foi adicionado ao sistema | was added to the system |

#### 12. `src/components/users/EditUserRoleModal.tsx` - Edit Roles Modal
Similar translations to CreateUserModal

#### 13. `src/pages/Settings.tsx` - Settings Page
| Portuguese | English |
|------------|---------|
| Configurações | Settings |
| Gerencie as configurações do sistema | Manage system settings |
| Meu Perfil | My Profile |
| Informações da sua conta | Your account information |
| Permissões | Permissions |
| Níveis de acesso do sistema | System access levels |
| Acesso total ao sistema | Full system access |
| Gerencia produtos, fornecedores e pedidos | Manages products, suppliers and orders |
| Apenas visualização | View only |

#### 14. `src/pages/Units.tsx` - Units Page
| Portuguese | English |
|------------|---------|
| Unidades | Units |
| Configure as unidades de destino no Brasil | Configure destination units in Brazil |
| Nova Unidade | New Unit |
| Buscar unidades... | Search units... |
| Lista de Unidades | Unit List |
| Nenhuma unidade cadastrada ainda | No units registered yet |
| Nenhuma unidade encontrada | No units found |
| Cadastre as unidades de destino para os produtos | Register destination units for products |
| Cadastrar Unidade | Register Unit |

#### 15. `src/pages/Categories.tsx` - Categories Page
| Portuguese | English |
|------------|---------|
| Categorias | Categories |
| Organize seus produtos por categoria | Organize your products by category |
| Nova Categoria | New Category |
| Buscar categorias... | Search categories... |
| Lista de Categorias | Category List |
| Nenhuma categoria cadastrada ainda | No categories registered yet |
| Nenhuma categoria encontrada | No categories found |
| Crie categorias para organizar seus produtos | Create categories to organize your products |
| Criar Categoria | Create Category |

---

### Additional Files to Check and Update

The following files also contain Portuguese text that will need translation:

- `src/pages/SupplierPlanning.tsx` - Stock projection page
- `src/pages/ProductDetails.tsx` - Product details page
- `src/pages/SupplierDetails.tsx` - Supplier details page
- `src/pages/PurchaseOrderDetails.tsx` - Purchase order details page
- Various modal components in `src/components/`
- Toast messages throughout the application

---

### Summary

| Area | Files Affected |
|------|----------------|
| App Title/Branding | `index.html`, `AppSidebar.tsx`, `Auth.tsx` |
| Menu/Navigation | `AppSidebar.tsx` |
| Pages | All 14 pages in `src/pages/` |
| Modals | ~15 modal components |
| Toast Messages | Throughout all files |

### Technical Section

#### Approach
1. Update `index.html` for browser tab title and meta tags
2. Modify `AppSidebar.tsx` for sidebar branding and menu items
3. Update each page file systematically
4. Update modal components
5. Ensure consistency in date format (keep `ptBR` locale for date formatting or switch to `enUS`)

#### Date Formatting
The application uses `date-fns` with `ptBR` locale. Consider whether to:
- Keep Portuguese date format (dd/MM/yyyy) - more familiar for Brazilian users
- Switch to English format (MM/dd/yyyy) - consistent with full English UI

Recommendation: Keep `dd/MM/yyyy` format as it's more internationally recognized, just update the locale to `enUS` where text labels appear.

#### Role Labels
Update the `roleConfig` object in `Users.tsx` and `CreateUserModal.tsx`:
```typescript
const roleConfig: Record<AppRole, { label: string; ... }> = {
  admin: { label: 'Admin', ... },
  buyer: { label: 'Buyer', ... },  // was "Comprador"
  trader: { label: 'Trader', ... },
  viewer: { label: 'Viewer', ... }, // was "Visualizador"
};
```

#### Status Labels
Update `STATUS_CONFIG` in `PurchaseOrders.tsx`:
```typescript
const STATUS_CONFIG = {
  draft: { label: 'Draft', ... },
  pending_trader_review: { label: 'Awaiting Trader', ... },
  pending_buyer_approval: { label: 'Pending Changes', ... },
  confirmed: { label: 'Confirmed', ... },
  shipped: { label: 'Shipped', ... },
  received: { label: 'Received', ... },
  cancelled: { label: 'Cancelled', ... },
};
```
