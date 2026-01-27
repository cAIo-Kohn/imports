import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { DollarSign, Package, Container } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { MoveCardModal } from './MoveCardModal';

interface CommercialDataSectionProps {
  cardId: string;
  fobPriceUsd: number | null;
  moq: number | null;
  qtyPerContainer: number | null;
  containerType: string | null;
  currentOwner: 'mor' | 'arc';
  canEdit: boolean;
  onOwnerChange?: (newOwner: 'mor' | 'arc') => void;
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
  currentOwner,
  canEdit,
  onOwnerChange,
}: CommercialDataSectionProps) {
  const { isTrader } = useUserRole();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [localFobPrice, setLocalFobPrice] = useState(fobPriceUsd?.toString() || '');
  const [localMoq, setLocalMoq] = useState(moq?.toString() || '');
  const [localQtyPerContainer, setLocalQtyPerContainer] = useState(qtyPerContainer?.toString() || '');
  const [localContainerType, setLocalContainerType] = useState(containerType || '');
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [pendingField, setPendingField] = useState<string | null>(null);

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

  const moveCardMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      
      const { error } = await (supabase.from('development_items') as any)
        .update({ 
          current_owner: 'mor',
          is_new_for_other_team: true,
        })
        .eq('id', cardId);
      if (error) throw error;

      // Log the movement
      await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'ownership_change',
        content: 'Card moved to MOR (Brazil)',
        metadata: { new_owner: 'mor', trigger: 'commercial_data' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      onOwnerChange?.('mor');
      toast({ title: 'Card moved to MOR (Brazil)' });
    },
  });

  // Significant fields that might require buyer input
  const isSignificantField = (fieldName: string) => {
    return ['fob_price_usd'].includes(fieldName);
  };

  const handleBlur = (fieldName: string, value: string, isNumeric: boolean = false) => {
    const parsedValue = isNumeric ? (value ? parseFloat(value) : null) : (value || null);
    updateMutation.mutate({ name: fieldName, value: parsedValue });

    // If trader is filling significant field and card is with ARC, prompt to move
    if (isTrader && currentOwner === 'arc' && isSignificantField(fieldName) && parsedValue) {
      setPendingField(fieldName);
      setShowMoveModal(true);
    }
  };

  const handleContainerTypeChange = (value: string) => {
    setLocalContainerType(value);
    updateMutation.mutate({ name: 'container_type', value: value || null });
  };

  const handleMoveConfirm = () => {
    moveCardMutation.mutate();
    setPendingField(null);
    setShowMoveModal(false);
  };

  const handleMoveCancel = () => {
    setPendingField(null);
    setShowMoveModal(false);
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

      {/* Move Card Modal */}
      <MoveCardModal
        open={showMoveModal}
        onOpenChange={setShowMoveModal}
        targetOwner="mor"
        onConfirm={handleMoveConfirm}
        onCancel={handleMoveCancel}
        triggerAction="added commercial data"
      />
    </div>
  );
}
