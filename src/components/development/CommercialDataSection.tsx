import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, Package, Container } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

interface CommercialDataSectionProps {
  cardId: string;
  fobPriceUsd: number | null;
  moq: number | null;
  qtyPerContainer: number | null;
  containerType: string | null;
  canEdit: boolean;
}

const CONTAINER_TYPES = [
  { value: '20ft', label: '20ft Container' },
  { value: '40ft', label: '40ft Container' },
  { value: '40hq', label: '40ft High Cube' },
];

export function CommercialDataSection({
  cardId,
  fobPriceUsd,
  moq,
  qtyPerContainer,
  containerType,
  canEdit,
}: CommercialDataSectionProps) {
  const queryClient = useQueryClient();
  const [localFobPrice, setLocalFobPrice] = useState(fobPriceUsd?.toString() || '');
  const [localMoq, setLocalMoq] = useState(moq?.toString() || '');
  const [localQtyPerContainer, setLocalQtyPerContainer] = useState(qtyPerContainer?.toString() || '');
  const [localContainerType, setLocalContainerType] = useState(containerType || '');

  useEffect(() => {
    setLocalFobPrice(fobPriceUsd?.toString() || '');
    setLocalMoq(moq?.toString() || '');
    setLocalQtyPerContainer(qtyPerContainer?.toString() || '');
    setLocalContainerType(containerType || '');
  }, [fobPriceUsd, moq, qtyPerContainer, containerType]);

  const updateMutation = useMutation({
    mutationFn: async (field: { name: string; value: string | number | null }) => {
      const { error } = await (supabase.from('development_items') as any)
        .update({ [field.name]: field.value })
        .eq('id', cardId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update commercial data',
        variant: 'destructive',
      });
    },
  });

  const handleBlur = (fieldName: string, value: string, isNumeric: boolean = false) => {
    const parsedValue = isNumeric ? (value ? parseFloat(value) : null) : (value || null);
    updateMutation.mutate({ name: fieldName, value: parsedValue });
  };

  const handleContainerTypeChange = (value: string) => {
    setLocalContainerType(value);
    updateMutation.mutate({ name: 'container_type', value: value || null });
  };

  return (
    <div className="space-y-4 border-t pt-4 mt-4">
      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <DollarSign className="h-4 w-4" />
        Commercial Data
      </h4>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="fob-price" className="text-xs">FOB Price (USD)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id="fob-price"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={localFobPrice}
              onChange={(e) => setLocalFobPrice(e.target.value)}
              onBlur={() => handleBlur('fob_price_usd', localFobPrice, true)}
              disabled={!canEdit}
              className="pl-7"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="moq" className="text-xs flex items-center gap-1">
            <Package className="h-3 w-3" />
            MOQ
          </Label>
          <Input
            id="moq"
            type="number"
            min="0"
            placeholder="Minimum order qty"
            value={localMoq}
            onChange={(e) => setLocalMoq(e.target.value)}
            onBlur={() => handleBlur('moq', localMoq, true)}
            disabled={!canEdit}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="qty-container" className="text-xs flex items-center gap-1">
            <Container className="h-3 w-3" />
            Qty / Container
          </Label>
          <Input
            id="qty-container"
            type="number"
            min="0"
            placeholder="Quantity per container"
            value={localQtyPerContainer}
            onChange={(e) => setLocalQtyPerContainer(e.target.value)}
            onBlur={() => handleBlur('qty_per_container', localQtyPerContainer, true)}
            disabled={!canEdit}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="container-type" className="text-xs">Container Type</Label>
          <Select
            value={localContainerType}
            onValueChange={handleContainerTypeChange}
            disabled={!canEdit}
          >
            <SelectTrigger id="container-type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {CONTAINER_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
