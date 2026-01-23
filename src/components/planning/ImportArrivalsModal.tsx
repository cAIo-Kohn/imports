import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileText, AlertTriangle, CheckCircle2, X, Ship } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parse, startOfMonth, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ImportArrivalsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ArrivalRow {
  productCode: string;
  arrivalDate: Date;
  quantity: number;
  processNumber: string;
  lineNumber: number;
}

interface MonthlyArrivalData {
  quantity: number;
  processNumbers: Set<string>;
}

interface ProductArrival {
  productCode: string;
  productId: string | null;
  productName?: string;
  monthlyArrivals: Map<string, MonthlyArrivalData>; // monthKey (yyyy-MM) -> data
  totalQuantity: number;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'complete' | 'error';

// Column positions in the fixed-width file
const COLUMN_POSITIONS = {
  estabelecimento: { start: 0, end: 3 },
  processo: { start: 4, end: 18 },
  item: { start: 19, end: 35 },
  entrega: { start: 36, end: 46 },
  qtdeSaldo: { start: 47, end: 62 },
};

function parseFixedWidthLine(line: string): ArrivalRow | null {
  // Skip header lines, empty lines, separator lines
  if (line.trim().length < 50) return null;
  if (line.includes('---')) return null;
  if (line.toLowerCase().includes('estabelec')) return null;
  if (line.toLowerCase().includes('processo')) return null;
  if (line.toLowerCase().includes('total')) return null;
  if (line.toLowerCase().includes('página')) return null;

  try {
    const estabelecimento = line.substring(COLUMN_POSITIONS.estabelecimento.start, COLUMN_POSITIONS.estabelecimento.end).trim();
    
    // Skip if estabelecimento is not numeric (header line)
    if (!/^\d+$/.test(estabelecimento)) return null;

    const processo = line.substring(COLUMN_POSITIONS.processo.start, COLUMN_POSITIONS.processo.end).trim();
    const item = line.substring(COLUMN_POSITIONS.item.start, COLUMN_POSITIONS.item.end).trim();
    const entregaStr = line.substring(COLUMN_POSITIONS.entrega.start, COLUMN_POSITIONS.entrega.end).trim();
    const qtdeSaldoStr = line.substring(COLUMN_POSITIONS.qtdeSaldo.start, COLUMN_POSITIONS.qtdeSaldo.end).trim();

    // Skip if item is empty
    if (!item) return null;

    // Parse date (dd/mm/yyyy)
    let arrivalDate: Date;
    try {
      arrivalDate = parse(entregaStr, 'dd/MM/yyyy', new Date());
      if (isNaN(arrivalDate.getTime())) return null;
    } catch {
      return null;
    }

    // Parse quantity (Brazilian format: 4.704,0000)
    // Remove thousands separator (.), replace decimal separator (,) with (.)
    const cleanQty = qtdeSaldoStr.replace(/\./g, '').replace(',', '.');
    const quantity = parseFloat(cleanQty);
    if (isNaN(quantity) || quantity <= 0) return null;

    return {
      productCode: item,
      arrivalDate,
      quantity: Math.round(quantity), // Round to integer
      processNumber: processo,
      lineNumber: 0, // Will be set later
    };
  } catch {
    return null;
  }
}

export function ImportArrivalsModal({ open, onOpenChange, onSuccess }: ImportArrivalsModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ArrivalRow[]>([]);
  const [productArrivals, setProductArrivals] = useState<ProductArrival[]>([]);
  const [unmatchedCodes, setUnmatchedCodes] = useState<string[]>([]);
  const [monthColumns, setMonthColumns] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch units
  const { data: units = [] } = useQuery({
    queryKey: ['units-for-arrivals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('units')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Note: suppliers not needed anymore - we insert directly into scheduled_arrivals

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ['products-for-arrivals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, code, technical_description, supplier_id')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
  });

  const resetState = useCallback(() => {
    setStep('upload');
    setFile(null);
    setParsedRows([]);
    setProductArrivals([]);
    setUnmatchedCodes([]);
    setMonthColumns([]);
    setProgress(0);
    setErrorMessage('');
    setSelectedUnit('');
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [resetState, onOpenChange]);

  const processFile = useCallback(async (f: File) => {
    setFile(f);
    
    try {
      const text = await f.text();
      const lines = text.split('\n');
      
      const rows: ArrivalRow[] = [];
      lines.forEach((line, index) => {
        const parsed = parseFixedWidthLine(line);
        if (parsed) {
          parsed.lineNumber = index + 1;
          rows.push(parsed);
        }
      });

      if (rows.length === 0) {
        toast({ title: 'Nenhuma linha de chegada encontrada no arquivo', variant: 'destructive' });
        return;
      }

      setParsedRows(rows);

      // Create product code to ID map (normalize codes)
      const productMap = new Map<string, { id: string; name: string }>();
      products.forEach(p => {
        // Store both with and without leading zeros
        productMap.set(p.code, { id: p.id, name: p.technical_description });
        const normalized = p.code.replace(/^0+/, '');
        if (normalized !== p.code) {
          productMap.set(normalized, { id: p.id, name: p.technical_description });
        }
      });

      // Group arrivals by product
      const arrivalsByProduct = new Map<string, ProductArrival>();
      const unmatched = new Set<string>();
      const allMonths = new Set<string>();

      rows.forEach(row => {
        const monthKey = format(startOfMonth(row.arrivalDate), 'yyyy-MM');
        allMonths.add(monthKey);

        // Try to find product (with and without leading zeros)
        let productInfo = productMap.get(row.productCode);
        if (!productInfo) {
          const normalized = row.productCode.replace(/^0+/, '');
          productInfo = productMap.get(normalized);
        }

        if (!productInfo) {
          unmatched.add(row.productCode);
        }

        const existing = arrivalsByProduct.get(row.productCode);
        if (existing) {
          const currentData = existing.monthlyArrivals.get(monthKey);
          if (currentData) {
            currentData.quantity += row.quantity;
            if (row.processNumber) currentData.processNumbers.add(row.processNumber);
          } else {
            const processNumbers = new Set<string>();
            if (row.processNumber) processNumbers.add(row.processNumber);
            existing.monthlyArrivals.set(monthKey, { quantity: row.quantity, processNumbers });
          }
          existing.totalQuantity += row.quantity;
        } else {
          const monthlyArrivals = new Map<string, MonthlyArrivalData>();
          const processNumbers = new Set<string>();
          if (row.processNumber) processNumbers.add(row.processNumber);
          monthlyArrivals.set(monthKey, { quantity: row.quantity, processNumbers });
          arrivalsByProduct.set(row.productCode, {
            productCode: row.productCode,
            productId: productInfo?.id || null,
            productName: productInfo?.name,
            monthlyArrivals,
            totalQuantity: row.quantity,
          });
        }
      });

      // Sort months and generate columns
      const sortedMonths = Array.from(allMonths).sort();
      setMonthColumns(sortedMonths);

      // Convert to array and sort by product code
      const arrivalsArray = Array.from(arrivalsByProduct.values())
        .sort((a, b) => a.productCode.localeCompare(b.productCode));
      
      setProductArrivals(arrivalsArray);
      setUnmatchedCodes(Array.from(unmatched).sort());
      setStep('preview');

      toast({ 
        title: 'Arquivo processado', 
        description: `${rows.length} registros encontrados em ${arrivalsArray.length} produtos` 
      });
    } catch (error) {
      console.error('Error processing file:', error);
      toast({ title: 'Erro ao processar arquivo', variant: 'destructive' });
    }
  }, [products, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.txt') || droppedFile.type === 'text/plain')) {
      processFile(droppedFile);
    } else {
      toast({ title: 'Por favor, selecione um arquivo .txt', variant: 'destructive' });
    }
  }, [processFile, toast]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  }, [processFile]);

  const handleImport = useCallback(async () => {
    if (!selectedUnit) {
      toast({ title: 'Selecione uma unidade', variant: 'destructive' });
      return;
    }

    // Filter only matched products
    const matchedArrivals = productArrivals.filter(a => a.productId);
    if (matchedArrivals.length === 0) {
      toast({ title: 'Nenhum produto válido para importar', variant: 'destructive' });
      return;
    }

    setStep('importing');
    setProgress(0);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Build items for scheduled_arrivals table
      const items: Array<{
        product_id: string;
        unit_id: string;
        arrival_date: string;
        quantity: number;
        source_file: string;
        created_by: string;
        process_number: string | null;
      }> = [];

      matchedArrivals.forEach(arrival => {
        arrival.monthlyArrivals.forEach((data, monthKey) => {
          // Use the first day of the month as arrival date
          const arrivalDate = `${monthKey}-01`;
          // Join multiple process numbers with comma
          const processNumber = data.processNumbers.size > 0 
            ? Array.from(data.processNumbers).join(', ') 
            : null;
          items.push({
            product_id: arrival.productId!,
            unit_id: selectedUnit,
            arrival_date: arrivalDate,
            quantity: data.quantity,
            source_file: file?.name || 'unknown',
            created_by: user.id,
            process_number: processNumber,
          });
        });
      });

      // Upsert items in batches (update quantity if same product/unit/date exists)
      const batchSize = 50;
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const { error: itemsError } = await supabase
          .from('scheduled_arrivals')
          .upsert(batch, { onConflict: 'product_id,unit_id,arrival_date' });
        
        if (itemsError) throw itemsError;
        
        setProgress(Math.round(((i + batch.length) / items.length) * 100));
      }

      setStep('complete');
      toast({ 
        title: 'Chegadas importadas com sucesso', 
        description: `${items.length} registros em ${matchedArrivals.length} produtos` 
      });
      onSuccess();
    } catch (error: any) {
      console.error('Error importing arrivals:', error);
      setErrorMessage(error.message || 'Erro ao importar chegadas');
      setStep('error');
    }
  }, [selectedUnit, productArrivals, file, toast, onSuccess]);

  const formatMonthLabel = (monthKey: string) => {
    const date = new Date(monthKey + '-01');
    return format(date, 'MMM/yy', { locale: ptBR });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ship className="h-5 w-5" />
            Importar Chegadas (TXT DATASUL)
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Selecione o arquivo de chegadas no formato TXT fixo'}
            {step === 'preview' && 'Confira os dados e selecione a unidade de destino'}
            {step === 'importing' && 'Importando registros...'}
            {step === 'complete' && 'Importação concluída com sucesso!'}
            {step === 'error' && 'Ocorreu um erro durante a importação'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Upload Step */}
          {step === 'upload' && (
            <div
              className={`
                border-2 border-dashed rounded-lg p-12 text-center transition-colors
                ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
              `}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">Arraste o arquivo .txt aqui</p>
              <p className="text-sm text-muted-foreground mb-4">ou clique para selecionar</p>
              <Input
                type="file"
                accept=".txt,text/plain"
                onChange={handleFileChange}
                className="max-w-xs mx-auto"
              />
            </div>
          )}

          {/* Preview Step */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Unit and Supplier Selection */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="unit">Unidade de destino</Label>
                  <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                    <SelectTrigger id="unit">
                      <SelectValue placeholder="Selecione a unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map(unit => (
                        <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Arquivo</p>
                  <p className="font-medium flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    {file?.name}
                  </p>
                </div>
              </div>

              {/* Unmatched Warning */}
              {unmatchedCodes.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{unmatchedCodes.length} códigos não encontrados</AlertTitle>
                  <AlertDescription className="mt-2">
                    <div className="flex flex-wrap gap-1">
                      {unmatchedCodes.slice(0, 10).map(code => (
                        <span key={code} className="px-2 py-0.5 bg-destructive/20 rounded text-xs">
                          {code}
                        </span>
                      ))}
                      {unmatchedCodes.length > 10 && (
                        <span className="text-xs">+{unmatchedCodes.length - 10} mais</span>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{parsedRows.length}</p>
                  <p className="text-xs text-muted-foreground">registros</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{productArrivals.filter(a => a.productId).length}</p>
                  <p className="text-xs text-muted-foreground">produtos válidos</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{monthColumns.length}</p>
                  <p className="text-xs text-muted-foreground">meses</p>
                </div>
              </div>

              {/* Data Table */}
              <ScrollArea className="h-[300px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background">Código</TableHead>
                      <TableHead>Produto</TableHead>
                      {monthColumns.map(month => (
                        <TableCell key={month} className="text-right">
                          {formatMonthLabel(month)}
                        </TableCell>
                      ))}
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productArrivals.map(arrival => (
                      <TableRow key={arrival.productCode} className={!arrival.productId ? 'opacity-50' : ''}>
                        <TableCell className="sticky left-0 bg-background font-mono text-sm">
                          {arrival.productId ? (
                            <CheckCircle2 className="h-3 w-3 inline mr-1 text-green-500" />
                          ) : (
                            <X className="h-3 w-3 inline mr-1 text-destructive" />
                          )}
                          {arrival.productCode}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">
                          {arrival.productName || '-'}
                        </TableCell>
                        {monthColumns.map(month => (
                          <TableCell key={month} className="text-right tabular-nums">
                            {arrival.monthlyArrivals.get(month)?.quantity.toLocaleString('pt-BR') || '-'}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-medium tabular-nums">
                          {arrival.totalQuantity.toLocaleString('pt-BR')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>Cancelar</Button>
                <Button 
                  onClick={handleImport} 
                  disabled={!selectedUnit || productArrivals.filter(a => a.productId).length === 0}
                >
                  Importar {productArrivals.filter(a => a.productId).length} produtos
                </Button>
              </div>
            </div>
          )}

          {/* Importing Step */}
          {step === 'importing' && (
            <div className="py-12 text-center space-y-4">
              <Progress value={progress} className="w-full" />
              <p className="text-muted-foreground">Importando registros... {progress}%</p>
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <div className="py-12 text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
              <p className="text-lg font-medium">Importação concluída!</p>
              <Button onClick={handleClose}>Fechar</Button>
            </div>
          )}

          {/* Error Step */}
          {step === 'error' && (
            <div className="py-12 text-center space-y-4">
              <AlertTriangle className="h-16 w-16 mx-auto text-destructive" />
              <p className="text-lg font-medium">Erro na importação</p>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
              <Button variant="outline" onClick={resetState}>Tentar novamente</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
