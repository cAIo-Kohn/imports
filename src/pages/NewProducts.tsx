import { useState, useMemo } from 'react';
import { Sparkles, ClipboardList, ShoppingCart, ArrowDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useNewProductsData } from '@/hooks/useNewProductFlow';
import { EligibleProductCard } from '@/components/new-products/EligibleProductCard';
import { Step1ResearchSection } from '@/components/new-products/Step1ResearchSection';
import { WorkflowStepSection } from '@/components/new-products/WorkflowStepSection';
import { ItemDetailDrawer } from '@/components/development/ItemDetailDrawer';
import type { DevelopmentItem } from '@/pages/Development';

export default function NewProducts() {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  
  const { data, isLoading, error } = useNewProductsData();

  const handleOpenCard = (cardId: string) => {
    setSelectedItemId(cardId);
  };

  // Find the selected item from all available items
  const selectedItem = useMemo(() => {
    if (!selectedItemId || !data) return null;
    const allItems = [...(data.eligible || []), ...(data.step1 || []), ...(data.step2 || []), ...(data.step3 || [])];
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

  const { eligible, step1, step2, step3, approvals } = data || {
    eligible: [],
    step1: [],
    step2: [],
    step3: [],
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

      {/* Step 2: Cadastrar Codigo */}
      <WorkflowStepSection
        title="Step 2: Cadastrar Código"
        subtitle="Code Registration"
        responsibleRole="Quality"
        items={step2}
        onOpenCard={handleOpenCard}
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
        responsibleRole="Buyer"
        items={step3}
        onOpenCard={handleOpenCard}
        colorScheme="blue"
        icon={<ShoppingCart className="h-5 w-5 text-blue-600" />}
      />

      {/* Item Detail Drawer */}
      <ItemDetailDrawer
        item={selectedItem as DevelopmentItem | null}
        open={!!selectedItemId}
        onOpenChange={(open) => {
          if (!open) setSelectedItemId(null);
        }}
      />
    </div>
  );
}
