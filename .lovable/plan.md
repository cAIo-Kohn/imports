

## Plano: Reformatar Visualização de Pedido de Compra

### Objetivo
Ajustar a página `PurchaseOrderDetails.tsx` para exibir o pedido de compra no formato idêntico ao arquivo `Jilong.xlsx`, utilizando os dados existentes no cadastro de produtos e fornecedores.

---

### Análise do Formato Jilong.xlsx

O arquivo contém as seguintes seções:

**1. Cabeçalho do Fornecedor:**
- Nome da empresa (JIANGSU JILONG SPORT AND LEISURE PRODUCTS CO., LTD.)
- Endereço completo
- Contato (Nome + telefone)

**2. Cabeçalho do Pedido:**
- Título "COMMERCIAL INVOICE"
- Destinatário (TO: METALURGICA MOR SA + endereço)
- Número do pedido (NO.)
- Data (DATE)
- ETD/Shipment (Ex: "SHIPMENT (ETD): 30th March 2025")
- Porto de origem/destino (SHIP FROM / TO)
- Condições de pagamento (PAYMENT)

**3. Colunas da Tabela de Itens:**
| Coluna Excel | Campo no Sistema | Origem |
|--------------|------------------|--------|
| ITEM NO | Numeração sequencial | Gerado |
| PICTURE | Imagem do produto | `products.image_url` |
| MOR CODE | Código do produto | `products.code` |
| INNER BOX (L/W/H) | Dimensões inner | `products.individual_length/width/height` |
| MASTER CARTON (L/W/H) | Dimensões caixa master | `products.master_box_length/width/height` |
| MASTER CARTON (m³) | Volume caixa master | `products.master_box_volume` |
| DESCRIPTION TECHNICAL PARTS | Especificações técnicas | `products.supplier_specs` ou `products.technical_description` |
| DESCRIPTION PACKING | Tipo de embalagem | `products.packaging_type` |
| MOR REFERENCE | Referência interna | Novo campo ou `products.origin_description` |
| NCM | Código NCM | `products.ncm` |
| QTY | Quantidade de caixas | Calculado: `quantity / qty_master_box` |
| PCS/CTN | Peças por caixa | `products.qty_master_box` |
| QUANTITY INNER | Quantidade inner | `products.qty_inner` |
| QUANTITY CTN | Total de caixas | Calculado |
| Q'TY (peças) | Quantidade total | `purchase_order_items.quantity` |
| UNIT PRICE FOB | Preço unitário | `purchase_order_items.unit_price_usd` |
| AMOUNT | Valor total | Calculado |
| CBM (m³) | Cubagem total | Calculado: `caixas × master_box_volume` |

**4. Rodapé:**
- Totais (quantidade, CBM, valor)
- Technical parts status
- Observações (REMARK)
- Informações bancárias

---

### Campos Disponíveis vs. Necessários

| Campo Necessário | Disponível? | Fonte |
|------------------|-------------|-------|
| Dados fornecedor | ✅ Sim | `suppliers.*` |
| Dimensões master box | ✅ Sim | `products.master_box_length/width/height` |
| Volume master box | ✅ Sim | `products.master_box_volume` |
| Dimensões inner box | ⚠️ Parcial | `products.individual_length/width/height` |
| Technical parts | ✅ Sim | `products.supplier_specs` |
| Packing | ✅ Sim | `products.packaging_type` |
| NCM | ✅ Sim | `products.ncm` |
| PCS/CTN | ✅ Sim | `products.qty_master_box` |
| FOB Price | ✅ Sim | `products.fob_price_usd` |
| Imagem produto | ✅ Sim | `products.image_url` |
| Dados bancários | ❌ Não | Precisa adicionar no fornecedor |
| MOR Reference | ⚠️ Usar | `products.origin_description` |
| ETD | ⚠️ Parcial | `purchase_order_items.expected_arrival` |
| Porto origem/destino | ❌ Não | Precisa adicionar no pedido |

---

### Modificações Necessárias

#### 1. Adicionar Campos no Banco de Dados

**Tabela `suppliers`** - Dados bancários:
```sql
ALTER TABLE suppliers ADD COLUMN bank_name TEXT;
ALTER TABLE suppliers ADD COLUMN bank_swift TEXT;
ALTER TABLE suppliers ADD COLUMN bank_account TEXT;
ALTER TABLE suppliers ADD COLUMN bank_address TEXT;
```

**Tabela `purchase_orders`** - Dados de embarque:
```sql
ALTER TABLE purchase_orders ADD COLUMN etd DATE;  -- Estimated Time of Departure
ALTER TABLE purchase_orders ADD COLUMN crd DATE;  -- Cargo Ready Date
ALTER TABLE purchase_orders ADD COLUMN port_origin TEXT;
ALTER TABLE purchase_orders ADD COLUMN port_destination TEXT;
ALTER TABLE purchase_orders ADD COLUMN payment_terms TEXT;
ALTER TABLE purchase_orders ADD COLUMN invoice_number TEXT;
```

**Tabela `units`** - Dados do destinatário (já existe):
- Pode usar dados existentes: `name`, `address`, `cnpj`, `city`, `state`, `zip_code`
- Adicionar telefone/fax se necessário

---

#### 2. Expandir Query de Dados do Pedido

**Arquivo**: `src/pages/PurchaseOrderDetails.tsx`

Atualizar a query para incluir todos os campos necessários:

```tsx
const { data, error } = await supabase
  .from('purchase_orders')
  .select(`
    *,
    suppliers (
      id, company_name, country, address, city, state_province,
      contact_name, contact_phone, contact_email,
      bank_name, bank_swift, bank_account, bank_address,
      payment_terms
    ),
    purchase_order_items (
      id, quantity, unit_price_usd, expected_arrival,
      products (
        id, code, technical_description, ncm,
        qty_master_box, qty_inner,
        master_box_length, master_box_width, master_box_height,
        master_box_volume, packaging_type, supplier_specs,
        individual_length, individual_width, individual_height,
        image_url, fob_price_usd, origin_description
      ),
      units (id, name, address, city, state, cnpj)
    )
  `)
  .eq('id', id)
  .single();
```

---

#### 3. Criar Layout de Invoice Comercial

**Novo componente**: `src/components/orders/PurchaseOrderInvoice.tsx`

Layout visual dividido em seções:

```
┌────────────────────────────────────────────────────────────────────┐
│ JIANGSU JILONG SPORT AND LEISURE PRODUCTS CO., LTD.               │
│ NO1 INDUSTRIAL AREA SOUTH ZHONGCHEN ROAD...                       │
│ Lily Chow +86-18721329459                                         │
├────────────────────────────────────────────────────────────────────┤
│                      COMMERCIAL INVOICE                            │
│ TO: METALURGICA MOR SA                        NO.: PO-2025-0001   │
│ BR 471 KM 312, DISTRITO INDUSTRIAL            DATE: Dec 20, 2024  │
│ SANTA CRUZ DO SUL - RS                                            │
│ BRASIL                                                            │
│ TEL: 55-51 2106 7500                                              │
├────────────────────────────────────────────────────────────────────┤
│ SHIPMENT (ETD): 30th March 2025 (CRD: 20th March 2025)           │
│ SHIP FROM: QINGDAO, CHINA                                         │
│ TO: RIO GRANDE, BRAZIL                                            │
│ PAYMENT: 100% T/T AFTER RECEIVED SHIPPING DOCUMENTS              │
├────────────────────────────────────────────────────────────────────┤
│ # │ PIC │ CODE │ INNER │ MASTER CTN │ m³ │ DESC │ NCM │ QTY │ ... │
├───┼─────┼──────┼───────┼────────────┼────┼──────┼─────┼─────┼─────┤
│ 1 │ img │ 001048│       │35x12x33    │0.014│...  │9506 │9000 │...  │
│ 2 │ img │ 001049│       │26x26x29    │0.020│...  │9506 │1000 │...  │
├────────────────────────────────────────────────────────────────────┤
│                          TOTAL: 4x40HQ  │     │64,674│     │$XXX │
├────────────────────────────────────────────────────────────────────┤
│ REMARK:                                                           │
│ * MOR LOGO POSITION ON EACH ITEM TO BE ADVISED                   │
│ * USE MOR LOGO TAPE TO SEAL CARTON BOX                           │
├────────────────────────────────────────────────────────────────────┤
│ BANK INFORMATION:                                                 │
│ Company: JIANGSU JILONG...                                        │
│ Bank: BANK OF COMMUNICATIONS...                                   │
│ Swift: COMMCNSHSQN                                                │
│ A/C NO: 398899991140003010721                                     │
└────────────────────────────────────────────────────────────────────┘
```

---

#### 4. Atualizar Tabela de Itens

**Colunas a adicionar na tabela**:

| Nova Coluna | Cálculo |
|-------------|---------|
| # (Item No) | Índice sequencial |
| Imagem | Thumbnail do produto |
| Inner Box (L×W×H) | `individual_length × individual_width × individual_height` |
| Master CTN (L×W×H) | `master_box_length × master_box_width × master_box_height` |
| m³ | `master_box_volume` |
| Technical Parts | `supplier_specs` ou `technical_description` |
| Packing | `packaging_type` |
| Reference | `origin_description` |
| PCS/CTN | `qty_master_box` |
| CTN (caixas) | `Math.ceil(quantity / qty_master_box)` |
| Total QTY | `quantity` |
| FOB | `unit_price_usd` |
| Amount | `quantity × unit_price_usd` |
| CBM Total | `caixas × master_box_volume` |

---

#### 5. Adicionar Campos de Embarque na UI

**Arquivo**: `src/pages/PurchaseOrderDetails.tsx`

Adicionar seção editável para:
- ETD (Estimated Time of Departure)
- CRD (Cargo Ready Date)
- Porto de origem
- Porto de destino
- Condições de pagamento
- Número da invoice

---

#### 6. Atualizar Modal de Edição do Fornecedor

**Arquivo**: `src/components/suppliers/EditSupplierModal.tsx`

Adicionar aba/seção "Dados Bancários":
- Nome do banco
- SWIFT/BIC
- Número da conta
- Endereço do banco

---

### Arquivos a Modificar/Criar

| Arquivo | Ação |
|---------|------|
| **Migração SQL** | Adicionar campos no banco (suppliers, purchase_orders) |
| `src/pages/PurchaseOrderDetails.tsx` | Reformular layout completo |
| `src/components/orders/PurchaseOrderInvoice.tsx` | **Criar** - Componente de visualização invoice |
| `src/components/suppliers/EditSupplierModal.tsx` | Adicionar campos bancários |
| `src/components/planning/CreatePurchaseOrderModal.tsx` | Adicionar campos de embarque |

---

### Funcionalidades Adicionais

1. **Botão "Exportar Excel"**: Gerar arquivo .xlsx no mesmo formato do Jilong.xlsx
2. **Botão "Imprimir/PDF"**: Versão para impressão da invoice comercial
3. **Toggle "Mostrar imagens"**: Opção para incluir/excluir thumbnails na visualização

---

### Priorização

**Fase 1 - Essencial:**
1. Migração SQL para novos campos
2. Reformular tabela de itens com todas as colunas
3. Adicionar seção de cabeçalho do fornecedor

**Fase 2 - Complementar:**
4. Adicionar campos de embarque (ETD, portos)
5. Adicionar dados bancários do fornecedor
6. Seção de observações/remarks

**Fase 3 - Extras:**
7. Exportação para Excel
8. Versão para impressão

