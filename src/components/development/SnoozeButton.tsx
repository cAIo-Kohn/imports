import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Clock, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from '@/hooks/use-toast';
import { addDays, addWeeks, format } from 'date-fns';

interface SnoozeButtonProps {
  cardId: string;
  currentActionType?: string | null;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'icon';
  className?: string;
  onSnooze?: () => void;
}

const SNOOZE_OPTIONS = [
  { label: '1 day', days: 1 },
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
];

export function SnoozeButton({
  cardId,
  currentActionType,
  variant = 'outline',
  size = 'sm',
  className,
  onSnooze,
}: SnoozeButtonProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [snoozeReason, setSnoozeReason] = useState('');

  const snoozeMutation = useMutation({
    mutationFn: async (snoozeUntil: Date) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Update the card with snooze info
      const { error: updateError } = await (supabase.from('development_items') as any)
        .update({
          pending_action_snoozed_until: snoozeUntil.toISOString(),
          pending_action_snoozed_by: user.id,
        })
        .eq('id', cardId);

      if (updateError) throw updateError;

      // Log the snooze activity
      const { error: activityError } = await supabase
        .from('development_card_activity')
        .insert({
          card_id: cardId,
          user_id: user.id,
          activity_type: 'action_snoozed',
          content: snoozeReason || `Snoozed until ${format(snoozeUntil, 'MMM d, yyyy')}`,
          metadata: {
            snooze_until: snoozeUntil.toISOString(),
            original_action_type: currentActionType,
          },
        });

      if (activityError) throw activityError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      toast({ title: 'Action snoozed' });
      setIsOpen(false);
      setShowCustom(false);
      setCustomDate('');
      setSnoozeReason('');
      onSnooze?.();
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  const handleQuickSnooze = (days: number) => {
    const snoozeUntil = addDays(new Date(), days);
    snoozeMutation.mutate(snoozeUntil);
  };

  const handleCustomSnooze = () => {
    if (!customDate) return;
    const snoozeUntil = new Date(customDate);
    if (snoozeUntil <= new Date()) {
      toast({ 
        title: 'Invalid date', 
        description: 'Please select a future date', 
        variant: 'destructive' 
      });
      return;
    }
    snoozeMutation.mutate(snoozeUntil);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Clock className="h-3 w-3 mr-1" />
          Snooze
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-3">
          <p className="text-sm font-medium">Snooze this action</p>
          
          {!showCustom ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {SNOOZE_OPTIONS.map((option) => (
                  <Button
                    key={option.days}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickSnooze(option.days)}
                    disabled={snoozeMutation.isPending}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => setShowCustom(true)}
              >
                Custom date...
              </Button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="snooze-date" className="text-xs">Snooze until</Label>
                <Input
                  id="snooze-date"
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="snooze-reason" className="text-xs">Reason (optional)</Label>
                <Textarea
                  id="snooze-reason"
                  value={snoozeReason}
                  onChange={(e) => setSnoozeReason(e.target.value)}
                  placeholder="e.g., Waiting for factory response"
                  rows={2}
                  className="text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCustom(false)}
                >
                  Back
                </Button>
                <Button
                  size="sm"
                  onClick={handleCustomSnooze}
                  disabled={!customDate || snoozeMutation.isPending}
                  className="flex-1"
                >
                  {snoozeMutation.isPending ? 'Snoozing...' : 'Snooze'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Resume snooze button component
interface ResumeSnoozeButtonProps {
  cardId: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm';
  onResume?: () => void;
}

export function ResumeSnoozeButton({
  cardId,
  variant = 'outline',
  size = 'sm',
  onResume,
}: ResumeSnoozeButtonProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const resumeMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      // Clear snooze fields
      const { error: updateError } = await (supabase.from('development_items') as any)
        .update({
          pending_action_snoozed_until: null,
          pending_action_snoozed_by: null,
        })
        .eq('id', cardId);

      if (updateError) throw updateError;

      // Log the resume activity
      await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'action_resumed',
        content: 'Resumed snoozed action',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      toast({ title: 'Action resumed' });
      onResume?.();
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => resumeMutation.mutate()}
      disabled={resumeMutation.isPending}
    >
      {resumeMutation.isPending ? 'Resuming...' : 'Resume Now'}
    </Button>
  );
}
