import { useState, useMemo } from 'react';
import { Sparkles, ClipboardList, ShoppingCart, ArrowDown, CheckCircle2, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useNewProductsData, useNewProductFlow } from '@/hooks/useNewProductFlow';
import { EligibleProductCard } from '@/components/new-products/EligibleProductCard';
import { Step1ResearchSection } from '@/components/new-products/Step1ResearchSection';
import { WorkflowStepSection } from '@/components/new-products/WorkflowStepSection';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ItemDetailDrawer } from '@/components/development/ItemDetailDrawer';
import { CreateProductModal, type ProductPrefillData } from '@/components/products/CreateProductModal';
import { supabase } from '@/integrations/supabase/client';
import type { DevelopmentItem } from '@/pages/Development';

export default function NewProducts() {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [step2Card, setStep2Card] = useState<any>(null);
  const [completedOpen, setCompletedOpen] = useState(false);
  
  const { data, isLoading, error } = useNewProductsData();
  const { startFlow, startFlowPending, advanceStep } = useNewProductFlow();

  const handleOpenCard = (cardId: string) => {
    setSelectedItemId(cardId);
  };

  const handleStep2CardClick = (cardId: string) => {
    if (!data?.step2) return;
    const card = data.step2.find((item: any) => item.id === cardId);
    if (card) {
      setStep2Card(card);
    }
  };

  const buildPrefillData = (card: any): ProductPrefillData => {
    // Parse qty_per_master_inner to number if possible
    let qtyMasterBox: number | undefined;
    if (card.qty_per_master_inner) {
      const parsed = parseInt(card.qty_per_master_inner, 10);
      if (!isNaN(parsed)) qtyMasterBox = parsed;
    }

    // Use customs description if available, otherwise card title + description
    const description = card._customs_description || 
      [card.title, card.description].filter(Boolean).join(' - ');

    return {
      technical_description: description || undefined,
      ncm: card._customs_ncm || undefined,
      fob_price_usd: card.fob_price_usd || undefined,
      supplier_id: card.supplier_id || undefined,
      qty_master_box: qtyMasterBox,
      image_url: card.image_url || undefined,
      moq: card.moq || undefined,
      container_type: card.container_type || undefined,
      qty_per_container: card.qty_per_container || undefined,
    };
  };

  const handleProductCreated = async (productId?: string) => {
    if (step2Card && productId) {
      // Store registered_product_id on the card
      await supabase
        .from('development_items')
        .update({ registered_product_id: productId })
        .eq('id', step2Card.id);

      advanceStep({
        targetCardId: step2Card.id,
        nextStatus: 'step3_ready_for_order',
      });
    }
    setStep2Card(null);
  };

  // Find the selected item from all available items
  const selectedItem = useMemo(() => {
    if (!selectedItemId || !data) return null;
    const allItems = [...(data.eligible || []), ...(data.step1 || []), ...(data.step2 || []), ...(data.step3 || []), ...(data.completed || [])];
    return allItems.find((item: DevelopmentItem) => item.id === selectedItemId) || null;
  }, [selectedItemId, data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-destructive py-8">
        Error loading new products
      </div>
    );
  }


  const { eligible, step1, step2, step3, completed, approvals } = data || {
    eligible: [],
    step1: [],
    step2: [],
    step3: [],
    completed: [],
    approvals: [],
  };

  const hasAnyItems = eligible.length > 0 || step1.length > 0 || step2.length > 0 || step3.length > 0;

  return (
    <div className="space-y-8 p-4 md:p-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">New Products</h1>
        </div>
        <p className="text-muted-foreground">
          Products ready for catalog integration. Track their progress through research and compliance steps.
        </p>
      </div>

      {!hasAnyItems && (
        <div className="text-center py-16 text-muted-foreground">
          <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No products in the workflow yet</p>
          <p className="text-sm">Products with approved samples will appear here</p>
        </div>
      )}

      {/* Eligible Products Section */}
      {eligible.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">Eligible Products</h2>
            <Badge variant="outline">{eligible.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Products with approved samples ready to start the new product workflow.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {eligible.map((item: any) => (
              <EligibleProductCard
                key={item.id}
                item={item}
                onOpenCard={handleOpenCard}
                onStartFlow={startFlow}
                startFlowPending={startFlowPending}
              />
            ))}
          </div>
        </section>
      )}

      {/* Flow Arrow */}
      {eligible.length > 0 && (step1.length > 0 || step2.length > 0 || step3.length > 0) && (
        <div className="flex justify-center">
          <ArrowDown className="h-6 w-6 text-muted-foreground" />
        </div>
      )}

      {/* Step 1: Research & Compliance (Parallel) */}
      <Step1ResearchSection
        items={step1}
        approvals={approvals}
        onOpenCard={handleOpenCard}
      />

      {/* Flow Arrow */}
      {step1.length > 0 && (step2.length > 0 || step3.length > 0) && (
        <div className="flex justify-center">
          <ArrowDown className="h-6 w-6 text-muted-foreground" />
        </div>
      )}

      {/* Step 2: Cadastrar Codigo — opens CreateProductModal */}
      <WorkflowStepSection
        title="Step 2: Cadastrar Código"
        subtitle="Code Registration"
        responsibleRole="Quality"
        items={step2}
        onOpenCard={handleStep2CardClick}
        colorScheme="green"
        icon={<ClipboardList className="h-5 w-5 text-green-600" />}
      />

      {/* Flow Arrow */}
      {step2.length > 0 && step3.length > 0 && (
        <div className="flex justify-center">
          <ArrowDown className="h-6 w-6 text-muted-foreground" />
        </div>
      )}

      {/* Step 3: Ready for Order */}
      <WorkflowStepSection
        title="Step 3: Ready for Order"
        subtitle="Products ready to be added to purchase orders"
        responsibleRole="Comex"
        items={step3}
        onOpenCard={handleOpenCard}
        colorScheme="blue"
        icon={<ShoppingCart className="h-5 w-5 text-blue-600" />}
      />

      {/* Completed Section */}
      {completed.length > 0 && (
        <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:underline cursor-pointer">
            <ChevronDown className={`h-4 w-4 transition-transform ${completedOpen ? '' : '-rotate-90'}`} />
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Completed</span>
            <Badge variant="outline" className="text-xs">{completed.length}</Badge>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <WorkflowStepSection
              title="Completed"
              subtitle="Products that completed the workflow and were ordered"
              responsibleRole=""
              items={completed}
              onOpenCard={handleOpenCard}
              colorScheme="emerald"
              icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            />
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Item Detail Drawer (for non-Step2 cards) */}
      <ItemDetailDrawer
        item={selectedItem as DevelopmentItem | null}
        open={!!selectedItemId}
        onOpenChange={(open) => {
          if (!open) setSelectedItemId(null);
        }}
      />

      {/* Step 2: Product Registration Modal */}
      <CreateProductModal
        open={!!step2Card}
        onOpenChange={(open) => {
          if (!open) setStep2Card(null);
        }}
        onSuccess={handleProductCreated}
        prefillData={step2Card ? buildPrefillData(step2Card) : undefined}
      />
    </div>
  );
}