

## Adicionar Link Externo "FOB Master Planner" na Sidebar

### O que muda
Adiciona um novo grupo na sidebar chamado "Tools" (ou similar) com um link externo para o projeto **FOB Master Planner** em `https://fob-china-builder.lovable.app`. O link abre em uma nova aba do navegador.

### Detalhes

**Arquivo: `src/components/layout/AppSidebar.tsx`**

1. Importar o icone `ExternalLink` do lucide-react (para indicar visualmente que e um link externo)
2. Adicionar uma nova `SidebarGroup` chamada **"Tools"** entre a secao Settings e o footer (visivel para todos exceto pure traders, ou para todos -- a definir)
3. O item usa uma tag `<a>` com `href="https://fob-china-builder.lovable.app"`, `target="_blank"` e `rel="noopener noreferrer"` em vez de `<NavLink>`, ja que e um link externo
4. Icone: `ExternalLink` (ou `Calculator` / `ClipboardList` se preferir algo mais tematico)
5. Label: "FOB Master Planner"

### Visibilidade
O link ficara visivel para todos os usuarios (nao apenas admins), seguindo o mesmo padrao da secao "Main Menu". Se quiser restringir, basta informar.

### Resultado visual
```
Tools
  🔗 FOB Master Planner ↗
```

O icone `ExternalLink` ao lado indica que abre em nova aba.
