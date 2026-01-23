import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';

interface ArrivalInputProps {
  productId: string;
  monthKey: string;
  initialValue: string;
  existingPurchases: number;
  onValueChange: (productId: string, monthKey: string, value: string) => void;
}

export const ArrivalInput = memo(function ArrivalInput({
  productId,
  monthKey,
  initialValue,
  existingPurchases,
  onValueChange,
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

  // Debounce: only propagate change after 300ms without typing
  useEffect(() => {
    // Skip if value hasn't changed from initial
    if (localValue === initialValue) return;

    const timer = setTimeout(() => {
      onValueChange(productId, monthKey, localValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [localValue, productId, monthKey, onValueChange, initialValue]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  }, []);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
  }, []);

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

  // Display mode: show formatted value
  if (!isEditing) {
    return (
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
  }

  // Edit mode: show input
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
});
