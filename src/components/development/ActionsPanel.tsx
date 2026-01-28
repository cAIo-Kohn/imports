import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { MessageCircle, HelpCircle, DollarSign, Package, Container, Send, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from '@/hooks/use-toast';
import { cn, formatBrazilianNumber, parseBrazilianNumber } from '@/lib/utils';
import { MoveCardModal } from './MoveCardModal';
import { AddSampleForm } from './AddSampleForm';
import { SampleTrackingCard } from './SampleTrackingCard';

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
  onForcedSectionHandled?: () => void;
}

const CONTAINER_TYPES = [
  { value: '20ft', label: '20ft Container' },
  { value: '40ft', label: '40ft Container' },
  { value: '40hq', label: '40ft High Cube' },
];

type MessageType = 'comment' | 'question';

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
  onForcedSectionHandled,
}: ActionsPanelProps) {
  const { user } = useAuth();
  const { isTrader } = useUserRole();
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Accordion state - controlled
  const [openSections, setOpenSections] = useState<string[]>([]);

  // Message state
  const [messageType, setMessageType] = useState<MessageType>('comment');
  const [messageContent, setMessageContent] = useState('');
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveModalTrigger, setMoveModalTrigger] = useState<'question' | 'commercial'>('question');

  // Commercial data state - initialize with formatted values
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

  // Formatting handlers for Brazilian number format
  const handleFobPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value;
    // Remove non-numeric except comma
    input = input.replace(/[^\d,]/g, '');
    // Only allow one comma
    const parts = input.split(',');
    if (parts.length > 2) input = parts[0] + ',' + parts.slice(1).join('');
    // Limit decimal places to 2
    if (parts[1]?.length > 2) input = parts[0] + ',' + parts[1].slice(0, 2);
    
    // Format with thousand separators
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const formatted = parts.length > 1 ? `${integerPart},${parts[1]}` : integerPart;
    
    setLocalFobPrice(formatted);
  };

  const handleIntegerChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove all non-digits
    const digits = e.target.value.replace(/\D/g, '');
    // Format with thousand separators
    const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    setter(formatted);
  };

  // Handle forced section opening from parent
  useEffect(() => {
    if (forcedOpenSection) {
      setOpenSections([forcedOpenSection]);
      if (forcedMessageType) {
        setMessageType(forcedMessageType);
      }
      // Focus textarea after section opens
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      onForcedSectionHandled?.();
    }
  }, [forcedOpenSection, forcedMessageType, onForcedSectionHandled]);

  // Fetch samples
  const { data: samples = [] } = useQuery({
    queryKey: ['development-item-samples', cardId],
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

  // Real-time subscription for samples
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
          queryClient.invalidateQueries({ queryKey: ['development-item-samples', cardId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cardId, queryClient]);

  // Add message mutation
  const addMessageMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !messageContent.trim()) return;
      
      const { error } = await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: messageType,
        content: messageContent.trim(),
      });
      if (error) throw error;

      // If it's a question and we should prompt for movement
      if (messageType === 'question') {
        const targetOwner = currentOwner === 'arc' ? 'mor' : 'arc';
        setMoveModalTrigger('question');
        setShowMoveModal(true);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      setMessageContent('');
      toast({ title: messageType === 'question' ? 'Question posted' : 'Comment added' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to post message', variant: 'destructive' });
    },
  });

  // Batch save commercial data mutation
  const saveCommercialDataMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      
      // Validate all fields are filled
      if (!localFobPrice || !localMoq || !localQtyPerContainer || !localContainerType) {
        throw new Error('All commercial data fields are required');
      }

      const fobValue = parseBrazilianNumber(localFobPrice);
      const moqValue = parseBrazilianNumber(localMoq);
      const qtyValue = parseBrazilianNumber(localQtyPerContainer);

      // Batch update all commercial fields
      const { error } = await (supabase.from('development_items') as any)
        .update({
          fob_price_usd: fobValue,
          moq: moqValue,
          qty_per_container: qtyValue,
          container_type: localContainerType,
        })
        .eq('id', cardId);
      if (error) throw error;

      // Log single activity with all values
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
        },
      });

      // Move card to other team
      const targetOwner = currentOwner === 'arc' ? 'mor' : 'arc';
      const { error: moveError } = await (supabase.from('development_items') as any)
        .update({ 
          current_owner: targetOwner,
          is_new_for_other_team: true,
        })
        .eq('id', cardId);
      if (moveError) throw moveError;

      // Log ownership change
      await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'ownership_change',
        content: `Card moved to ${targetOwner === 'mor' ? 'MOR (Brazil)' : 'ARC (China)'}`,
        metadata: { new_owner: targetOwner, trigger: 'commercial' },
      });

      return targetOwner;
    },
    onSuccess: (targetOwner) => {
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      onOwnerChange?.(targetOwner as 'mor' | 'arc');
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

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageContent.trim()) {
      addMessageMutation.mutate();
    }
  };

  const handleSaveCommercialData = () => {
    saveCommercialDataMutation.mutate();
  };

  const handleMoveConfirm = () => {
    const targetOwner = currentOwner === 'arc' ? 'mor' : 'arc';
    moveCardMutation.mutate(targetOwner);
    setShowMoveModal(false);
  };

  // Determine if commercial data is complete for the pending indicator
  const isCommercialComplete = Boolean(
    (fobPriceUsd || localFobPrice) && 
    (moq || localMoq) && 
    (qtyPerContainer || localQtyPerContainer) && 
    (containerType || localContainerType)
  );
  const isCommercialPending = !isCommercialComplete && cardType !== 'task';

  // Check if form is ready to submit
  const canSubmitCommercial = Boolean(
    localFobPrice && localMoq && localQtyPerContainer && localContainerType
  );

  const targetTeamName = currentOwner === 'arc' ? 'MOR (Brazil)' : 'ARC (China)';

  if (!canEdit) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Accordion type="multiple" value={openSections} onValueChange={setOpenSections} className="w-full">
        {/* Messaging Section */}
        <AccordionItem value="messaging" className="border rounded-lg">
          <AccordionTrigger className="py-3 px-3 hover:no-underline">
            <span className="flex items-center gap-2 text-sm font-medium">
              <MessageCircle className="h-4 w-4" />
              Add Comment / Ask Question
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-3 pb-3">
            <form onSubmit={handleSendMessage} className="space-y-3">
              <Tabs value={messageType} onValueChange={(v) => setMessageType(v as MessageType)}>
                <TabsList className="grid w-full grid-cols-2 h-8">
                  <TabsTrigger value="comment" className="text-xs flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    Comment
                  </TabsTrigger>
                  <TabsTrigger value="question" className="text-xs flex items-center gap-1">
                    <HelpCircle className="h-3 w-3" />
                    Question
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              
              <Textarea
                ref={textareaRef}
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                placeholder={messageType === 'question' 
                  ? "Ask a question that requires a response..." 
                  : "Add a comment or update..."
                }
                rows={2}
                className="text-sm"
              />
              
              <div className="flex justify-end">
                <Button 
                  type="submit" 
                  size="sm"
                  disabled={!messageContent.trim() || addMessageMutation.isPending}
                >
                  <Send className="h-3 w-3 mr-1" />
                  {addMessageMutation.isPending ? 'Sending...' : 'Send'}
                </Button>
              </div>
            </form>
          </AccordionContent>
        </AccordionItem>

        {/* Commercial Data Section - Only for non-task cards */}
        {cardType !== 'task' && (
          <AccordionItem 
            value="commercial" 
            className={cn(
              "border rounded-lg mt-2",
              isCommercialPending && "border-amber-400 animate-pulse bg-amber-50/50 dark:bg-amber-950/20"
            )}
          >
            <AccordionTrigger className="py-3 px-3 hover:no-underline">
              <span className="flex items-center gap-2 text-sm font-medium">
                <DollarSign className="h-4 w-4" />
                Commercial Data
                {isCommercialPending && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-normal ml-1">
                    (pending)
                  </span>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="fob-price" className="text-xs">FOB Price (USD)</Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      id="fob-price"
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={localFobPrice}
                      onChange={handleFobPriceChange}
                      className="pl-6 h-8 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="moq" className="text-xs flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    MOQ
                  </Label>
                  <Input
                    id="moq"
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={localMoq}
                    onChange={handleIntegerChange(setLocalMoq)}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="qty-container" className="text-xs flex items-center gap-1">
                    <Container className="h-3 w-3" />
                    Qty / Container
                  </Label>
                  <Input
                    id="qty-container"
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={localQtyPerContainer}
                    onChange={handleIntegerChange(setLocalQtyPerContainer)}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="container-type" className="text-xs">Container Type</Label>
                  <Select
                    value={localContainerType}
                    onValueChange={setLocalContainerType}
                  >
                    <SelectTrigger id="container-type" className="h-8 text-sm">
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

              {/* Batch Save Button */}
              <div className="mt-4 pt-3 border-t">
                <Button
                  onClick={handleSaveCommercialData}
                  disabled={!canSubmitCommercial || saveCommercialDataMutation.isPending}
                  className="w-full"
                  size="sm"
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  {saveCommercialDataMutation.isPending 
                    ? 'Saving...' 
                    : `Save & Move Card to ${targetTeamName}`
                  }
                </Button>
                {!canSubmitCommercial && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    All 4 fields are required to submit
                  </p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Sample Tracking Section - Only for non-task cards */}
        {cardType !== 'task' && (
          <AccordionItem value="samples" className="border rounded-lg mt-2">
            <AccordionTrigger className="py-3 px-3 hover:no-underline">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Package className="h-4 w-4" />
                Sample Tracking
                {samples.length > 0 && (
                  <span className="bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded">
                    {samples.length}
                  </span>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3">
              <div className="max-h-[50vh] overflow-y-auto space-y-3 pr-1">
                <AddSampleForm itemId={cardId} />
                
                {samples.length > 0 && (
                  <div className="space-y-2 pt-2">
                    {samples.map((sample) => (
                      <SampleTrackingCard key={sample.id} sample={sample} canEdit={canEdit} />
                    ))}
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

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
