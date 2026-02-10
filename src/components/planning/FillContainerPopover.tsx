import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Target } from 'lucide-react';

interface FillContainerPopoverProps {
  draft: { partialContainerPercent: number };
  remainingVolume: string;
  monthOptions: { key: string; label: string }[];
  onFillCBM: () => void;
  onFillByMonth: (targetMonth: string) => void;
  hasProjections: boolean;
}

export function FillContainerPopover({
  draft,
  remainingVolume,
  monthOptions,
  onFillCBM,
  onFillByMonth,
  hasProjections,
}: FillContainerPopoverProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'cbm' | 'month'>('cbm');
  const [targetMonth, setTargetMonth] = useState('');

  const handleFill = () => {
    if (mode === 'cbm') {
      onFillCBM();
    } else if (targetMonth) {
      onFillByMonth(targetMonth);
    }
    setOpen(false);
    setTargetMonth('');
    setMode('cbm');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs">
          <Plus className="mr-1 h-3 w-3" />
          +{remainingVolume}m³
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 bg-popover" align="end" side="top">
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Preencher Container</h4>

          <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'cbm' | 'month')}>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="cbm" id="fill-cbm" className="mt-0.5" />
              <Label htmlFor="fill-cbm" className="text-sm cursor-pointer">
                <span className="font-medium">Preencher CBM</span>
                <p className="text-xs text-muted-foreground">Distribui +{remainingVolume}m³ igualmente entre os produtos</p>
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="month" id="fill-month" className="mt-0.5" disabled={!hasProjections} />
              <Label htmlFor="fill-month" className={`text-sm cursor-pointer ${!hasProjections ? 'opacity-50' : ''}`}>
                <span className="font-medium flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  Equilibrar Mês
                </span>
                <p className="text-xs text-muted-foreground">Adiciona qtd para cobrir déficit de saldo até o mês alvo</p>
              </Label>
            </div>
          </RadioGroup>

          {mode === 'month' && (
            <Select value={targetMonth} onValueChange={setTargetMonth}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Equilibrar até..." />
              </SelectTrigger>
              <SelectContent className="bg-popover z-[60]">
                {monthOptions.map(m => (
                  <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={handleFill}
              disabled={mode === 'month' && !targetMonth}
            >
              Preencher
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
