import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ArrivalInputProps {
  productId: string;
  monthKey: string;
  initialValue: string;
  uploadedArrivals: number; // From scheduled_arrivals (BLACK)
  appOrderArrivals: number; // From purchase_order_items (BLUE DARK)
  appOrderNumbers: string[]; // Order reference numbers for tooltip
  processNumber: string | null;
  onValueChange: (productId: string, monthKey: string, value: string) => void;
  onBlur?: (productId: string, monthKey: string) => void;
}

export const ArrivalInput = memo(function ArrivalInput({
  productId,
  monthKey,
  initialValue,
  uploadedArrivals,
  appOrderArrivals,
  appOrderNumbers,
  processNumber,
  onValueChange,
  onBlur,
}: ArrivalInputProps) {
  const [localValue, setLocalValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with external value when it changes (e.g., on clear)
  useEffect(() => {
    setLocalValue(initialValue);
  }, [initialValue]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Real-time update: propagate immediately on change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onValueChange(productId, monthKey, newValue);
  }, [onValueChange, productId, monthKey]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    onBlur?.(productId, monthKey);
  }, [onBlur, productId, monthKey]);

  const handleClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      setIsEditing(false);
      onBlur?.(productId, monthKey);
    }
  }, [onBlur, productId, monthKey]);

  const pendingValue = localValue ? parseInt(localValue) : 0;
  const totalArrival = uploadedArrivals + appOrderArrivals + pendingValue;

  // Edit mode: show input
  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        min="0"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-16 h-6 text-xs p-1 text-center"
        placeholder="0"
      />
    );
  }

  // Build the display segments
  const segments: { value: number; color: 'black' | 'blue-dark' | 'blue-light'; tooltip?: string }[] = [];
  
  // BLACK: uploads (scheduled_arrivals)
  if (uploadedArrivals > 0) {
    segments.push({ value: uploadedArrivals, color: 'black', tooltip: processNumber ? `OC: ${processNumber}` : undefined });
  }
  
  // BLUE DARK: app orders (purchase_order_items)
  if (appOrderArrivals > 0) {
    const tooltip = appOrderNumbers.length > 0 ? `Pedido: ${appOrderNumbers.join(', ')}` : undefined;
    segments.push({ value: appOrderArrivals, color: 'blue-dark', tooltip });
  }
  
  // BLUE LIGHT: pending manual input
  if (pendingValue > 0) {
    segments.push({ value: pendingValue, color: 'blue-light' });
  }

  // Display mode with tooltips for each segment
  const renderSegment = (segment: typeof segments[0], index: number, isLast: boolean) => {
    const colorClass = 
      segment.color === 'black' ? 'text-foreground' : 
      segment.color === 'blue-dark' ? 'text-blue-700 dark:text-blue-400' : 
      'text-blue-500 dark:text-blue-300';
    
    const content = (
      <span className={`text-xs font-semibold ${colorClass}`}>
        {index > 0 ? '+' : ''}{segment.value.toLocaleString('pt-BR')}
      </span>
    );

    if (segment.tooltip) {
      return (
        <TooltipProvider key={index} delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">{content}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-xs font-medium">{segment.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return <span key={index}>{content}</span>;
  };

  const displayContent = (
    <div 
      className="flex items-center justify-center gap-0.5 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 min-h-[24px] transition-colors"
      onClick={handleClick}
    >
      {totalArrival > 0 ? (
        segments.map((seg, i) => renderSegment(seg, i, i === segments.length - 1))
      ) : (
        <span className="text-xs text-muted-foreground">-</span>
      )}
    </div>
  );

  return displayContent;
});
