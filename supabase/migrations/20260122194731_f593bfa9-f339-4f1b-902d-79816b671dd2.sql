-- ==============================================
-- MÓDULO DE PLANEJAMENTO DE DEMANDA (MRP)
-- ==============================================

-- 1. Tabela de Previsão de Vendas
CREATE TABLE public.sales_forecasts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    year_month DATE NOT NULL, -- Primeiro dia do mês (2026-01-01)
    quantity INTEGER NOT NULL DEFAULT 0,
    version TEXT NOT NULL DEFAULT 'v1', -- Identificador da versão da previsão
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Constraint única para evitar duplicatas
    CONSTRAINT unique_forecast_per_product_unit_month_version 
        UNIQUE (product_id, unit_id, year_month, version)
);

-- 2. Tabela de Snapshots de Estoque
CREATE TABLE public.inventory_snapshots (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Apenas um snapshot por produto/unidade/data
    CONSTRAINT unique_inventory_snapshot 
        UNIQUE (product_id, unit_id, snapshot_date)
);

-- 3. Tabela de Pedidos de Compra
CREATE TABLE public.purchase_orders (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'draft' 
        CHECK (status IN ('draft', 'confirmed', 'shipped', 'received', 'cancelled')),
    notes TEXT,
    total_value_usd NUMERIC(12, 2),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- 4. Tabela de Itens do Pedido de Compra
CREATE TABLE public.purchase_order_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_usd NUMERIC(10, 4),
    expected_arrival DATE, -- Calculado: order_date + lead_time_days
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    -- Evitar duplicar mesmo produto no mesmo pedido para mesma unidade
    CONSTRAINT unique_item_per_order_product_unit 
        UNIQUE (purchase_order_id, product_id, unit_id)
);

-- 5. Tabela de Histórico de Vendas
CREATE TABLE public.sales_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    year_month DATE NOT NULL, -- Primeiro dia do mês
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Apenas um registro por produto/unidade/mês
    CONSTRAINT unique_sales_history_per_product_unit_month 
        UNIQUE (product_id, unit_id, year_month)
);

-- ==============================================
-- ÍNDICES PARA PERFORMANCE
-- ==============================================

CREATE INDEX idx_sales_forecasts_product ON public.sales_forecasts(product_id);
CREATE INDEX idx_sales_forecasts_unit ON public.sales_forecasts(unit_id);
CREATE INDEX idx_sales_forecasts_year_month ON public.sales_forecasts(year_month);
CREATE INDEX idx_sales_forecasts_version ON public.sales_forecasts(version);

CREATE INDEX idx_inventory_snapshots_product ON public.inventory_snapshots(product_id);
CREATE INDEX idx_inventory_snapshots_unit ON public.inventory_snapshots(unit_id);
CREATE INDEX idx_inventory_snapshots_date ON public.inventory_snapshots(snapshot_date);

CREATE INDEX idx_purchase_orders_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX idx_purchase_orders_date ON public.purchase_orders(order_date);

CREATE INDEX idx_purchase_order_items_order ON public.purchase_order_items(purchase_order_id);
CREATE INDEX idx_purchase_order_items_product ON public.purchase_order_items(product_id);
CREATE INDEX idx_purchase_order_items_arrival ON public.purchase_order_items(expected_arrival);

CREATE INDEX idx_sales_history_product ON public.sales_history(product_id);
CREATE INDEX idx_sales_history_unit ON public.sales_history(unit_id);
CREATE INDEX idx_sales_history_year_month ON public.sales_history(year_month);

-- ==============================================
-- ROW LEVEL SECURITY
-- ==============================================

-- Enable RLS em todas as tabelas
ALTER TABLE public.sales_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_history ENABLE ROW LEVEL SECURITY;

-- Políticas para sales_forecasts
CREATE POLICY "Authenticated users can view sales_forecasts" 
    ON public.sales_forecasts FOR SELECT 
    USING (true);

CREATE POLICY "Admins and buyers can manage sales_forecasts" 
    ON public.sales_forecasts FOR ALL 
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'buyer'::app_role));

-- Políticas para inventory_snapshots
CREATE POLICY "Authenticated users can view inventory_snapshots" 
    ON public.inventory_snapshots FOR SELECT 
    USING (true);

CREATE POLICY "Admins and buyers can manage inventory_snapshots" 
    ON public.inventory_snapshots FOR ALL 
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'buyer'::app_role));

-- Políticas para purchase_orders
CREATE POLICY "Authenticated users can view purchase_orders" 
    ON public.purchase_orders FOR SELECT 
    USING (true);

CREATE POLICY "Admins and buyers can manage purchase_orders" 
    ON public.purchase_orders FOR ALL 
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'buyer'::app_role));

-- Políticas para purchase_order_items
CREATE POLICY "Authenticated users can view purchase_order_items" 
    ON public.purchase_order_items FOR SELECT 
    USING (true);

CREATE POLICY "Admins and buyers can manage purchase_order_items" 
    ON public.purchase_order_items FOR ALL 
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'buyer'::app_role));

-- Políticas para sales_history
CREATE POLICY "Authenticated users can view sales_history" 
    ON public.sales_history FOR SELECT 
    USING (true);

CREATE POLICY "Admins and buyers can manage sales_history" 
    ON public.sales_history FOR ALL 
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'buyer'::app_role));

-- ==============================================
-- TRIGGERS PARA UPDATED_AT
-- ==============================================

CREATE TRIGGER update_purchase_orders_updated_at
    BEFORE UPDATE ON public.purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ==============================================
-- FUNÇÃO PARA GERAR NÚMERO DO PEDIDO
-- ==============================================

CREATE OR REPLACE FUNCTION public.generate_purchase_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    current_year TEXT;
    next_sequence INTEGER;
    new_order_number TEXT;
BEGIN
    current_year := to_char(CURRENT_DATE, 'YYYY');
    
    -- Buscar próximo número na sequência do ano atual
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(order_number FROM 'PO-' || current_year || '-(\d+)') AS INTEGER)
    ), 0) + 1
    INTO next_sequence
    FROM public.purchase_orders
    WHERE order_number LIKE 'PO-' || current_year || '-%';
    
    new_order_number := 'PO-' || current_year || '-' || LPAD(next_sequence::TEXT, 4, '0');
    
    RETURN new_order_number;
END;
$$;