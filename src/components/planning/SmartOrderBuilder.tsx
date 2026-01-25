import { useState, useMemo } from 'react';
import { format, addMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Wand2, CalendarRange, Target } from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  id: string;
  code: string;
  technical_description: string;
  qty_master_box: number | null;
}

interface MonthProjection {
  month: Date;
  monthKey: string;
  monthLabel: string;
  finalBalance: number;
}

interface ProductProjection {
  product: Product;
  projections: MonthProjection[];
  hasRupture: boolean;
}

interface SmartOrderBuilderProps {
  productProjections: ProductProjection[];
  products: Product[];
  onGenerateOrder: (arrivals: Record<string, number>) => void;
}

export function SmartOrderBuilder({
  productProjections,
  products,
  onGenerateOrder,
}: SmartOrderBuilderProps) {
  const [open, setOpen] = useState(false);
  const [arrivalMonth, setArrivalMonth] = useState<string>('');
  const [targetMonth, setTargetMonth] = useState<string>('');

  // Generate list of next 12 months
  const monthOptions = useMemo(() => {
    const today = startOfMonth(new Date());
    const months = [];
    for (let i = 1; i <= 12; i++) {
      const date = addMonths(today, i);
      const key = format(date, 'yyyy-MM-dd');
      const label = format(date, 'MMMM yyyy', { locale: ptBR });
      months.push({ key, label, date });
    }
    return months;
  }, []);

  // Preview of what will be generated
  const orderPreview = useMemo(() => {
    if (!arrivalMonth || !targetMonth) return null;

    let productsWithNeed = 0;
    let totalUnits = 0;

    productProjections.forEach(pp => {
      const targetProjection = pp.projections.find(p => p.monthKey === targetMonth);
      
      if (targetProjection && targetProjection.finalBalance < 0) {
        const neededQuantity = Math.abs(targetProjection.finalBalance);
        const product = products.find(p => p.id === pp.product.id);
        
        let roundedQuantity = neededQuantity;
        if (product?.qty_master_box && product.qty_master_box > 0) {
          roundedQuantity = Math.ceil(neededQuantity / product.qty_master_box) * product.qty_master_box;
        }
        
        productsWithNeed++;
        totalUnits += roundedQuantity;
      }
    });

    return { productsWithNeed, totalUnits };
  }, [arrivalMonth, targetMonth, productProjections, products]);

  const handleGenerateOrder = () => {
    if (!arrivalMonth || !targetMonth) {
      toast.error('Selecione os meses de chegada e equilíbrio');
      return;
    }

    const arrivals: Record<string, number> = {};
    let productsAdded = 0;

    productProjections.forEach(pp => {
      // Find the projection for the target month
      const targetProjection = pp.projections.find(p => p.monthKey === targetMonth);
      
      // If the final balance is negative, we need that quantity
      if (targetProjection && targetProjection.finalBalance < 0) {
        const neededQuantity = Math.abs(targetProjection.finalBalance);
        
        // Round up to master box if available
        const product = products.find(p => p.id === pp.product.id);
        let roundedQuantity = neededQuantity;
        
        if (product?.qty_master_box && product.qty_master_box > 0) {
          roundedQuantity = Math.ceil(neededQuantity / product.qty_master_box) * product.qty_master_box;
        }
        
        // Create entry for the selected arrival month
        arrivals[`${pp.product.id}::${arrivalMonth}`] = roundedQuantity;
        productsAdded++;
      }
    });

    if (productsAdded === 0) {
      toast.info('Nenhum produto precisa de reposição para o mês alvo selecionado');
      setOpen(false);
      return;
    }

    onGenerateOrder(arrivals);
    setOpen(false);
    setArrivalMonth('');
    setTargetMonth('');
    
    toast.success(`Pedido gerado com ${productsAdded} produtos! Ajuste as quantidades conforme necessário.`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="default" className="gap-2">
          <Wand2 className="h-4 w-4" />
          Montar Pedido Inteligente
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-popover" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              Montagem Inteligente de Pedido
            </h4>
            <p className="text-sm text-muted-foreground">
              Configure a chegada e o mês alvo para equilibrar o estoque automaticamente.
            </p>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <CalendarRange className="h-4 w-4 text-muted-foreground" />
                Mês de Chegada
              </label>
              <Select value={arrivalMonth} onValueChange={setArrivalMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Quando o pedido chegará?" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {monthOptions.map(month => (
                    <SelectItem key={month.key} value={month.key}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                Equilibrar Estoque Até
              </label>
              <Select value={targetMonth} onValueChange={setTargetMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Até quando garantir estoque?" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {monthOptions.map(month => (
                    <SelectItem key={month.key} value={month.key}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview */}
          {orderPreview && orderPreview.productsWithNeed > 0 && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium">Prévia do pedido:</p>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{orderPreview.productsWithNeed}</span> produtos precisam de reposição
              </p>
              <p className="text-sm text-muted-foreground">
                Total estimado: <span className="font-semibold text-foreground">{orderPreview.totalUnits.toLocaleString()}</span> unidades
              </p>
            </div>
          )}

          {orderPreview && orderPreview.productsWithNeed === 0 && arrivalMonth && targetMonth && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
              <p className="text-sm text-green-600 dark:text-green-400">
                ✓ Nenhum produto precisa de reposição para este período
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => {
                setOpen(false);
                setArrivalMonth('');
                setTargetMonth('');
              }}
            >
              Cancelar
            </Button>
            <Button 
              className="flex-1"
              onClick={handleGenerateOrder}
              disabled={!arrivalMonth || !targetMonth || !orderPreview?.productsWithNeed}
            >
              Gerar Pedido
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
