import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { MessageCircle, HelpCircle, DollarSign, Package, Container, Send, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
}: ActionsPanelProps) {
  const { user } = useAuth();
  const { isTrader, isBuyer } = useUserRole();
  const queryClient = useQueryClient();

  // Message state
  const [messageType, setMessageType] = useState<MessageType>('comment');
  const [messageContent, setMessageContent] = useState('');
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveModalTrigger, setMoveModalTrigger] = useState<'question' | 'commercial'>('question');

  // Commercial data state
  const [localFobPrice, setLocalFobPrice] = useState(fobPriceUsd?.toString() || '');
  const [localMoq, setLocalMoq] = useState(moq?.toString() || '');
  const [localQtyPerContainer, setLocalQtyPerContainer] = useState(qtyPerContainer?.toString() || '');
  const [localContainerType, setLocalContainerType] = useState(containerType || '');

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

  // Update commercial data mutation
  const updateCommercialMutation = useMutation({
    mutationFn: async (field: { name: string; value: string | number | null }) => {
      const { error } = await (supabase.from('development_items') as any)
        .update({ [field.name]: field.value })
        .eq('id', cardId);
      if (error) throw error;

      // Log the update
      if (user?.id && field.value) {
        await supabase.from('development_card_activity').insert({
          card_id: cardId,
          user_id: user.id,
          activity_type: 'commercial_update',
          content: `Updated ${field.name.replace('_', ' ')}`,
          metadata: { field: field.name, value: field.value },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' });
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

  const handleCommercialBlur = (fieldName: string, value: string, isNumeric: boolean = true) => {
    const parsedValue = isNumeric ? (value ? parseFloat(value) : null) : (value || null);
    updateCommercialMutation.mutate({ name: fieldName, value: parsedValue });

    // Prompt to move card if trader updates significant field
    if (isTrader && currentOwner === 'arc' && fieldName === 'fob_price_usd' && parsedValue) {
      setMoveModalTrigger('commercial');
      setShowMoveModal(true);
    }
  };

  const handleContainerTypeChange = (value: string) => {
    setLocalContainerType(value);
    updateCommercialMutation.mutate({ name: 'container_type', value: value || null });
  };

  const handleMoveConfirm = () => {
    const targetOwner = currentOwner === 'arc' ? 'mor' : 'arc';
    moveCardMutation.mutate(targetOwner);
    setShowMoveModal(false);
  };

  if (!canEdit) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Accordion type="multiple" defaultValue={[]} className="w-full">
        {/* Messaging Section */}
        <AccordionItem value="messaging" className="border rounded-lg px-3">
          <AccordionTrigger className="py-3 hover:no-underline">
            <span className="flex items-center gap-2 text-sm font-medium">
              <MessageCircle className="h-4 w-4" />
              Add Comment / Ask Question
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-3">
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
          <AccordionItem value="commercial" className="border rounded-lg px-3 mt-2">
            <AccordionTrigger className="py-3 hover:no-underline">
              <span className="flex items-center gap-2 text-sm font-medium">
                <DollarSign className="h-4 w-4" />
                Commercial Data
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="fob-price" className="text-xs">FOB Price (USD)</Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      id="fob-price"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={localFobPrice}
                      onChange={(e) => setLocalFobPrice(e.target.value)}
                      onBlur={() => handleCommercialBlur('fob_price_usd', localFobPrice)}
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
                    type="number"
                    min="0"
                    placeholder="Min order qty"
                    value={localMoq}
                    onChange={(e) => setLocalMoq(e.target.value)}
                    onBlur={() => handleCommercialBlur('moq', localMoq)}
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
                    type="number"
                    min="0"
                    placeholder="Qty per container"
                    value={localQtyPerContainer}
                    onChange={(e) => setLocalQtyPerContainer(e.target.value)}
                    onBlur={() => handleCommercialBlur('qty_per_container', localQtyPerContainer)}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="container-type" className="text-xs">Container Type</Label>
                  <Select
                    value={localContainerType}
                    onValueChange={handleContainerTypeChange}
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
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Sample Tracking Section - Only for non-task cards */}
        {cardType !== 'task' && (
          <AccordionItem value="samples" className="border rounded-lg px-3 mt-2">
            <AccordionTrigger className="py-3 hover:no-underline">
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
            <AccordionContent className="pb-3 space-y-3">
              <AddSampleForm itemId={cardId} />
              
              {samples.length > 0 && (
                <div className="space-y-2 pt-2">
                  {samples.map((sample) => (
                    <SampleTrackingCard key={sample.id} sample={sample} canEdit={canEdit} />
                  ))}
                </div>
              )}
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
