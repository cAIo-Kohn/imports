import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { DollarSign, Package, Container, Send, ArrowRight, X, FolderOpen, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { cn, formatBrazilianNumber, parseBrazilianNumber } from '@/lib/utils';
import { MoveCardModal } from './MoveCardModal';
import { AddSampleForm } from './AddSampleForm';
import { SampleTrackingCard } from './SampleTrackingCard';
import { TimelineUploadButton, UploadedAttachment } from './TimelineUploadButton';
import { CardFilesTab } from './CardFilesTab';
import { NewThreadComposer } from './NewThreadComposer';
import { MentionInput } from '@/components/notifications/MentionInput';
import { createMentionNotifications } from '@/hooks/useNotifications';

interface ActionsPanelProps {
  cardId: string;
  cardType: 'item' | 'item_group' | 'task';
  fobPriceUsd: number | null;
  moq: number | null;
  qtyPerContainer: number | null;
  containerType: string | null;
  currentOwner: 'mor' | 'arc';
  canEdit: boolean;
  onOwnerChange?: (newOwner: 'mor' | 'arc') => void;
  forcedOpenSection?: string | null;
  forcedMessageType?: 'comment' | 'question' | null;
  targetSampleId?: string | null;
  onForcedSectionHandled?: () => void;
}

const CONTAINER_TYPES = [
  { value: '20ft', label: '20ft' },
  { value: '40ft', label: '40ft' },
  { value: '40hq', label: '40HQ' },
];

type ActionType = 'thread' | 'commercial' | 'samples' | 'files' | null;

export function ActionsPanel({
  cardId,
  cardType,
  fobPriceUsd,
  moq,
  qtyPerContainer,
  containerType,
  currentOwner,
  canEdit,
  onOwnerChange,
  forcedOpenSection,
  forcedMessageType,
  targetSampleId,
  onForcedSectionHandled,
}: ActionsPanelProps) {
  const { user } = useAuth();
  const { isTrader } = useUserRole();
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const samplesSectionRef = useRef<HTMLDivElement>(null);

  // Active panel state
  const [activeAction, setActiveAction] = useState<ActionType>(null);

  // Message state (kept for MoveCardModal)
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveModalTrigger, setMoveModalTrigger] = useState<'question' | 'commercial'>('question');

  // Commercial data state
  const [localFobPrice, setLocalFobPrice] = useState(
    fobPriceUsd ? formatBrazilianNumber(fobPriceUsd, 2) : ''
  );
  const [localMoq, setLocalMoq] = useState(
    moq ? formatBrazilianNumber(moq, 0) : ''
  );
  const [localQtyPerContainer, setLocalQtyPerContainer] = useState(
    qtyPerContainer ? formatBrazilianNumber(qtyPerContainer, 0) : ''
  );
  const [localContainerType, setLocalContainerType] = useState(containerType || '');

  // Formatting handlers
  const handleFobPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value;
    input = input.replace(/[^\d,]/g, '');
    const parts = input.split(',');
    if (parts.length > 2) input = parts[0] + ',' + parts.slice(1).join('');
    if (parts[1]?.length > 2) input = parts[0] + ',' + parts[1].slice(0, 2);
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const formatted = parts.length > 1 ? `${integerPart},${parts[1]}` : integerPart;
    setLocalFobPrice(formatted);
  };

  const handleIntegerChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    setter(formatted);
  };

  // Handle forced section opening from parent
  useEffect(() => {
    if (forcedOpenSection) {
      if (forcedOpenSection === 'messaging') {
        setActiveAction('thread');
      } else if (forcedOpenSection === 'commercial') {
        setActiveAction('commercial');
      } else if (forcedOpenSection === 'samples') {
        setActiveAction('samples');
      }
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      onForcedSectionHandled?.();
    }
  }, [forcedOpenSection, forcedMessageType, onForcedSectionHandled]);

  // Scroll to and highlight target sample when samples section opens
  useEffect(() => {
    if (targetSampleId && activeAction === 'samples') {
      setTimeout(() => {
        const element = document.getElementById(`sample-${targetSampleId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-2', 'ring-primary');
          setTimeout(() => element.classList.remove('ring-2', 'ring-primary'), 2000);
        }
      }, 150);
    }
  }, [targetSampleId, activeAction]);

  // Fetch card title for notifications
  const { data: cardData } = useQuery({
    queryKey: ['development-item-title', cardId],
    queryFn: async () => {
      const { data } = await supabase
        .from('development_items')
        .select('title')
        .eq('id', cardId)
        .single();
      return data;
    },
  });

  // Fetch samples
  const { data: samples = [] } = useQuery({
    queryKey: ['development-item-samples', cardId],
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('development_item_samples')
        .select('*')
        .eq('item_id', cardId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription for samples
  const invalidateSamplesTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    const channel = supabase
      .channel(`samples-${cardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'development_item_samples',
          filter: `item_id=eq.${cardId}`,
        },
        () => {
          if (invalidateSamplesTimeoutRef.current) clearTimeout(invalidateSamplesTimeoutRef.current);
          invalidateSamplesTimeoutRef.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['development-item-samples', cardId] });
          }, 300);
        }
      )
      .subscribe();

    return () => {
      if (invalidateSamplesTimeoutRef.current) clearTimeout(invalidateSamplesTimeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [cardId, queryClient]);

  // Note: Thread creation is now handled by NewThreadComposer component

  // Save commercial data mutation
  const saveCommercialDataMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      
      if (!localFobPrice || !localMoq || !localQtyPerContainer || !localContainerType) {
        throw new Error('All commercial data fields are required');
      }

      const fobValue = parseBrazilianNumber(localFobPrice);
      const moqValue = parseBrazilianNumber(localMoq);
      const qtyValue = parseBrazilianNumber(localQtyPerContainer);

      const { error } = await (supabase.from('development_items') as any)
        .update({
          fob_price_usd: fobValue,
          moq: moqValue,
          qty_per_container: qtyValue,
          container_type: localContainerType,
        })
        .eq('id', cardId);
      if (error) throw error;

      const targetOwner = currentOwner === 'arc' ? 'mor' : 'arc';

      // Log commercial_update activity with embedded move info
      await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'commercial_update',
        content: 'Updated commercial data',
        metadata: {
          fob_price_usd: fobValue,
          moq: moqValue,
          qty_per_container: qtyValue,
          container_type: localContainerType,
          moved_from: currentOwner,
          moved_to: targetOwner,
        },
      });

      // Move card to other team
      const { error: moveError } = await (supabase.from('development_items') as any)
        .update({ 
          current_owner: targetOwner,
          is_new_for_other_team: true,
        })
        .eq('id', cardId);
      if (moveError) throw moveError;

      // NO separate ownership_change entry - move is embedded in commercial_update activity

      return targetOwner;
    },
    onSuccess: (targetOwner) => {
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      onOwnerChange?.(targetOwner as 'mor' | 'arc');
      setActiveAction(null);
      toast({ title: `Commercial data saved & card moved to ${targetOwner === 'mor' ? 'MOR (Brazil)' : 'ARC (China)'}` });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Move card mutation
  const moveCardMutation = useMutation({
    mutationFn: async (targetOwner: 'mor' | 'arc') => {
      if (!user?.id) return;
      
      const { error } = await (supabase.from('development_items') as any)
        .update({ 
          current_owner: targetOwner,
          is_new_for_other_team: true,
        })
        .eq('id', cardId);
      if (error) throw error;

      await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'ownership_change',
        content: `Card moved to ${targetOwner === 'mor' ? 'MOR (Brazil)' : 'ARC (China)'}`,
        metadata: { new_owner: targetOwner, trigger: moveModalTrigger },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      const targetOwner = currentOwner === 'arc' ? 'mor' : 'arc';
      onOwnerChange?.(targetOwner);
      toast({ title: `Card moved to ${targetOwner === 'mor' ? 'MOR (Brazil)' : 'ARC (China)'}` });
    },
  });

  // Drag and drop handlers removed - now using NewThreadComposer

  const handleMoveConfirm = () => {
    const targetOwner = currentOwner === 'arc' ? 'mor' : 'arc';
    moveCardMutation.mutate(targetOwner);
    setShowMoveModal(false);
  };

  const isCommercialComplete = Boolean(
    (fobPriceUsd || localFobPrice) && 
    (moq || localMoq) && 
    (qtyPerContainer || localQtyPerContainer) && 
    (containerType || localContainerType)
  );
  const isCommercialPending = !isCommercialComplete && cardType !== 'task';
  const canSubmitCommercial = Boolean(
    localFobPrice && localMoq && localQtyPerContainer && localContainerType
  );
  const targetTeamName = currentOwner === 'arc' ? 'MOR (Brazil)' : 'ARC (China)';

  // All authenticated users can comment/question/upload files
  // Only users with canEdit can manage commercial data and samples

  const toggleAction = (action: ActionType) => {
    setActiveAction(activeAction === action ? null : action);
  };

  return (
    <div className="border-t bg-background">
      {/* Quick Action Bar */}
      <div className="flex items-center gap-1 p-2">
        <Button 
          variant={activeAction === 'thread' ? 'default' : 'outline'} 
          size="sm" 
          className="h-8 flex-1 gap-1"
          onClick={() => toggleAction('thread')}
        >
          <Plus className="h-4 w-4" />
          <span className="text-xs">New Thread</span>
        </Button>
        {cardType !== 'task' && canEdit && (
          <>
            <Button 
              variant={activeAction === 'commercial' ? 'secondary' : 'ghost'} 
              size="sm" 
              className={cn(
                "h-8 flex-1 gap-1 relative",
                isCommercialPending && "text-destructive"
              )}
              onClick={() => toggleAction('commercial')}
            >
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Commercial</span>
              {isCommercialPending && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-destructive rounded-full" />
              )}
            </Button>
            <Button 
              variant={activeAction === 'samples' ? 'secondary' : 'ghost'} 
              size="sm" 
              className={cn(
                "h-8 flex-1 gap-1 relative",
                samples.some(s => s.status === 'pending') && "text-amber-600"
              )}
              onClick={() => toggleAction('samples')}
            >
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Samples</span>
              {samples.some(s => s.status === 'pending') ? (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
              ) : samples.length > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 bg-secondary text-secondary-foreground text-[10px] rounded-full flex items-center justify-center">
                  {samples.length}
                </span>
              ) : null}
            </Button>
          </>
        )}
        <Button 
          variant={activeAction === 'files' ? 'secondary' : 'ghost'} 
          size="sm" 
          className="h-8 flex-1 gap-1"
          onClick={() => toggleAction('files')}
        >
          <FolderOpen className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">Files</span>
        </Button>
      </div>

      {/* Expanded Action Panel */}
      {activeAction && (
        <div className="p-3 border-t bg-muted/20 max-h-[50vh] overflow-y-auto">
          {activeAction !== 'thread' && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground capitalize">
                {activeAction === 'commercial' ? 'Commercial Data' :
                 activeAction === 'samples' ? 'Sample Tracking' : 'Files'}
              </span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-5 w-5"
                onClick={() => setActiveAction(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* New Thread Composer */}
          {activeAction === 'thread' && (
            <NewThreadComposer
              cardId={cardId}
              currentOwner={currentOwner}
              onClose={() => setActiveAction(null)}
              onCardMove={() => onOwnerChange?.(currentOwner === 'arc' ? 'mor' : 'arc')}
            />
          )}

          {/* Commercial Data Form */}
          {activeAction === 'commercial' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="fob-price" className="text-[10px]">FOB Price (USD)</Label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                    <Input
                      id="fob-price"
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={localFobPrice}
                      onChange={handleFobPriceChange}
                      className="pl-5 h-7 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="moq" className="text-[10px] flex items-center gap-1">
                    <Package className="h-2.5 w-2.5" />
                    MOQ
                  </Label>
                  <Input
                    id="moq"
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={localMoq}
                    onChange={handleIntegerChange(setLocalMoq)}
                    className="h-7 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="qty-container" className="text-[10px] flex items-center gap-1">
                    <Container className="h-2.5 w-2.5" />
                    Qty / Container
                  </Label>
                  <Input
                    id="qty-container"
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={localQtyPerContainer}
                    onChange={handleIntegerChange(setLocalQtyPerContainer)}
                    className="h-7 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="container-type" className="text-[10px]">Container</Label>
                  <Select
                    value={localContainerType}
                    onValueChange={setLocalContainerType}
                  >
                    <SelectTrigger id="container-type" className="h-7 text-xs">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTAINER_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value} className="text-xs">
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={() => saveCommercialDataMutation.mutate()}
                disabled={!canSubmitCommercial || saveCommercialDataMutation.isPending}
                className="w-full h-8"
                size="sm"
              >
                <ArrowRight className="h-3 w-3 mr-1" />
                {saveCommercialDataMutation.isPending 
                  ? 'Saving...' 
                  : `Save & Move to ${targetTeamName}`
                }
              </Button>
              {!canSubmitCommercial && (
                <p className="text-[10px] text-muted-foreground text-center">
                  All 4 fields required
                </p>
              )}
            </div>
          )}

          {/* Samples Section */}
          {activeAction === 'samples' && (
            <div ref={samplesSectionRef} className="space-y-3">
              <AddSampleForm itemId={cardId} />
              
              {samples.length > 0 && (
                <div className="space-y-2 pt-2">
                  {samples.map((sample) => (
                    <SampleTrackingCard 
                      key={sample.id} 
                      sample={sample} 
                      canEdit={canEdit}
                      onSampleArrived={() => {
                        setTimeout(() => {
                          samplesSectionRef.current?.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'end' 
                          });
                        }, 300);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Files Section */}
          {activeAction === 'files' && (
            <CardFilesTab cardId={cardId} />
          )}
        </div>
      )}

      {/* Move Card Modal */}
      <MoveCardModal
        open={showMoveModal}
        onOpenChange={setShowMoveModal}
        targetOwner={currentOwner === 'arc' ? 'mor' : 'arc'}
        onConfirm={handleMoveConfirm}
        onCancel={() => setShowMoveModal(false)}
        triggerAction={moveModalTrigger === 'question' ? 'asked a question' : 'added commercial data'}
      />
    </div>
  );
}
