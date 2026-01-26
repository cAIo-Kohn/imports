import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';

interface SimulatorQuantityInputProps {
  productId: string;
  monthKey: string;
  value: number;
  qtyMasterBox: number | null;
  onUpdate: (productId: string, monthKey: string, newValue: number) => void;
}

export const SimulatorQuantityInput = memo(function SimulatorQuantityInput({
  productId,
  monthKey,
  value,
  qtyMasterBox,
  onUpdate,
}: SimulatorQuantityInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync when external value changes
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(value.toString());
    }
  }, [value, isEditing]);

  // Focus on edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  }, []);

  const commitValue = useCallback(() => {
    setIsEditing(false);
    let numValue = parseInt(localValue) || 0;
    
    // Round up to master box if applicable
    if (numValue > 0 && qtyMasterBox && qtyMasterBox > 0) {
      const boxes = Math.ceil(numValue / qtyMasterBox);
      numValue = boxes * qtyMasterBox;
    }
    
    setLocalValue(numValue.toString());
    onUpdate(productId, monthKey, numValue);
  }, [localValue, qtyMasterBox, productId, monthKey, onUpdate]);

  const handleBlur = useCallback(() => {
    commitValue();
  }, [commitValue]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter' || e.key === 'Escape') {
      commitValue();
    }
  }, [commitValue]);

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
        onClick={(e) => e.stopPropagation()}
        className="w-20 h-7 text-sm text-right p-1"
      />
    );
  }

  return (
    <div 
      className="cursor-pointer hover:bg-muted/50 rounded px-2 py-1 text-right text-sm transition-colors"
      onClick={handleClick}
    >
      {value.toLocaleString('pt-BR')}
    </div>
  );
});
