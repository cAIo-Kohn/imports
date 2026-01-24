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
  existingPurchases: number;
  processNumber: string | null;
  onValueChange: (productId: string, monthKey: string, value: string) => void;
  onBlur?: (productId: string, monthKey: string) => void;
}

export const ArrivalInput = memo(function ArrivalInput({
  productId,
  monthKey,
  initialValue,
  existingPurchases,
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
    }
  }, []);

  const pendingValue = localValue ? parseInt(localValue) : 0;
  const totalArrival = existingPurchases + pendingValue;

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

  // Display mode with optional tooltip
  const displayContent = (
    <div 
      className="flex items-center justify-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 min-h-[24px] transition-colors"
      onClick={handleClick}
    >
      {totalArrival > 0 ? (
        <>
          <span className="text-xs font-medium">
            {totalArrival.toLocaleString('pt-BR')}
          </span>
          {pendingValue > 0 && existingPurchases > 0 && (
            <span className="text-[10px] text-muted-foreground">
              ({existingPurchases.toLocaleString('pt-BR')}+{pendingValue.toLocaleString('pt-BR')})
            </span>
          )}
          {pendingValue > 0 && existingPurchases === 0 && (
            <span className="text-[10px] text-primary">*</span>
          )}
        </>
      ) : (
        <span className="text-xs text-muted-foreground">-</span>
      )}
    </div>
  );

  // If there's a process number and existing purchases, show tooltip
  if (processNumber && existingPurchases > 0) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            {displayContent}
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-xs font-medium">OC: {processNumber}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return displayContent;
});