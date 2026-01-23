import React, { memo, useState, useEffect, useCallback } from 'react';
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

  // Sync with external value when it changes (e.g., on clear)
  useEffect(() => {
    setLocalValue(initialValue);
  }, [initialValue]);

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

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        min="0"
        value={localValue}
        onChange={handleChange}
        className="w-16 h-6 text-xs p-1 text-center"
        placeholder="0"
      />
      {existingPurchases > 0 && (
        <span className="text-xs text-primary">+{existingPurchases}</span>
      )}
    </div>
  );
});
