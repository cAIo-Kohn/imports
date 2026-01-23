import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

interface ImportSalesHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface SalesRow {
  productCode: string;
  months: { date: Date; quantity: number }[];
}

type ImportStep = 'upload' | 'configure' | 'preview' | 'importing' | 'complete' | 'error';

function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\s]+/g, ' ')
    .trim();
}

function findColumnIndex(headers: string[], possibleNames: string[]): number {
  const normalizedHeaders = headers.map(h => h ? normalizeColumnName(String(h)) : '');
  const normalizedNames = possibleNames.map(normalizeColumnName);

  for (const name of normalizedNames) {
    const idx = normalizedHeaders.indexOf(name);
    if (idx !== -1) return idx;
  }

  for (const name of normalizedNames) {
    const idx = normalizedHeaders.findIndex(h => h.startsWith(name));
    if (idx !== -1) return idx;
  }

  return -1;
}

function parseMonthHeader(header: string): Date | null {
  const normalized = header.toLowerCase().trim();
  
  const monthMap: Record<string, number> = {
    // Português
    jan: 0, janeiro: 0, fev: 1, fevereiro: 1, mar: 2, marco: 2, março: 2,
    abr: 3, abril: 3, mai: 4, maio: 4, jun: 5, junho: 5,
    jul: 6, julho: 6, ago: 7, agosto: 7, set: 8, setembro: 8,
    out: 9, outubro: 9, nov: 10, novembro: 10, dez: 11, dezembro: 11,
    // Inglês
    feb: 1, february: 1, apr: 3, april: 3, may: 4, aug: 7, august: 7,
    sep: 8, sept: 8, september: 8, oct: 9, october: 9, dec: 11, december: 11,
  };

  const match = normalized.match(/([a-zç]+)[\/\-\s]?(\d{2,4})/);
  if (match) {
    const monthName = match[1].normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const yearStr = match[2];
    const month = monthMap[monthName];
    
    if (month !== undefined) {
      const year = yearStr.length === 2 ? 2000 + parseInt(yearStr) : parseInt(yearStr);
      return new Date(year, month, 1);
    }
  }

  return null;
}

function parseNumericValue(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Math.round(value);

  let cleaned = value.toString().replace(/\s/g, '').replace(/[R$]/g, '');
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');

  if (lastDot > lastComma) {
    cleaned = cleaned.replace(/,/g, '');
  } else if (lastComma > lastDot) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num);
}

export function ImportSalesHistoryModal({ open, onOpenChange, onSuccess }: ImportSalesHistoryModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<any[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<SalesRow[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [importStats, setImportStats] = useState({ imported: 0 });
  const [unmatchedCodes, setUnmatchedCodes] = useState<string[]>([]);

  const { data: units = [] } = useQuery({
    queryKey: ['units-for-import'],
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

  const { data: products = [] } = useQuery({
    queryKey: ['products-for-import'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, code')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
  });

  const resetState = useCallback(() => {
    setStep('upload');
    setFile(null);
    setRawData([]);
    setHeaders([]);
    setParsedRows([]);
    setSelectedUnit('');
    setProgress(0);
    setErrorMessage('');
    setImportStats({ imported: 0 });
    setUnmatchedCodes([]);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [resetState, onOpenChange]);

  const processFile = async (f: File) => {
    try {
      const buffer = await f.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (data.length < 2) {
        throw new Error('Arquivo vazio ou sem dados');
      }

      const headerRow = data[0].map(String);
      setHeaders(headerRow);
      setRawData(data.slice(1));
      setFile(f);
      setStep('configure');
    } catch (error: any) {
      setErrorMessage(error.message || 'Erro ao processar arquivo');
      setStep('error');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) {
      processFile(f);
    }
  };

  const handleParseData = () => {
    if (!selectedUnit) {
      toast({ title: 'Selecione uma unidade', variant: 'destructive' });
      return;
    }

    const codeColIndex = findColumnIndex(headers, ['codigo item', 'codigo produto', 'codigo', 'code', 'sku']);
    if (codeColIndex === -1) {
      toast({ title: 'Coluna de código não encontrada', variant: 'destructive' });
      return;
    }

    // Find month columns
    const monthColumns: { index: number; date: Date }[] = [];
    headers.forEach((h, i) => {
      const date = parseMonthHeader(h);
      if (date) {
        monthColumns.push({ index: i, date });
      }
    });

    if (monthColumns.length === 0) {
      toast({ title: 'Nenhuma coluna de mês encontrada (ex: Jan/25)', variant: 'destructive' });
      return;
    }

    const productMap = new Map(products.map(p => [p.code.replace(/^0+/, ''), p.id]));

    const rows: SalesRow[] = [];
    const unmatched: string[] = [];
    
    for (const row of rawData) {
      const rawCode = String(row[codeColIndex] || '').trim();
      if (!rawCode) continue;

      const normalizedCode = rawCode.replace(/^0+/, '');
      if (!productMap.has(normalizedCode)) {
        unmatched.push(rawCode);
        continue;
      }

      const months: { date: Date; quantity: number }[] = [];
      for (const { index, date } of monthColumns) {
        const qty = parseNumericValue(row[index]);
        if (qty > 0) {
          months.push({ date, quantity: qty });
        }
      }

      if (months.length > 0) {
        rows.push({
          productCode: rawCode,
          months,
        });
      }
    }

    setUnmatchedCodes(unmatched);
    setParsedRows(rows);
    setStep('preview');
  };

  const handleImport = async () => {
    setStep('importing');
    setProgress(0);

    try {
      const productMap = new Map(products.map(p => [p.code.replace(/^0+/, ''), p.id]));
      const records: any[] = [];

      for (const row of parsedRows) {
        const normalizedCode = row.productCode.replace(/^0+/, '');
        const productId = productMap.get(normalizedCode);
        if (!productId) continue;

        for (const month of row.months) {
          records.push({
            product_id: productId,
            unit_id: selectedUnit,
            year_month: format(month.date, 'yyyy-MM-dd'),
            quantity: month.quantity,
            created_by: user?.id,
          });
        }
      }

      // Batch upsert
      const batchSize = 100;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const { error } = await supabase
          .from('sales_history')
          .upsert(batch, {
            onConflict: 'product_id,unit_id,year_month',
            ignoreDuplicates: false,
          });

        if (error) throw error;

        setProgress(Math.round(((i + batch.length) / records.length) * 100));
      }

      setImportStats({ imported: records.length });
      setStep('complete');
      onSuccess();
    } catch (error: any) {
      setErrorMessage(error.message || 'Erro ao importar dados');
      setStep('error');
    }
  };

  const totalMonths = parsedRows.reduce((sum, r) => sum + r.months.length, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Histórico de Vendas</DialogTitle>
          <DialogDescription>
            Importe os dados históricos de vendas por mês
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
          >
            <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Arraste a planilha aqui</p>
            <p className="text-sm text-muted-foreground mb-4">
              Formato esperado: Código do produto + colunas de meses (Jan/25, Fev/25...)
            </p>
            <Label htmlFor="history-file-upload" className="cursor-pointer">
              <Button asChild>
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  Selecionar Arquivo
                </span>
              </Button>
            </Label>
            <Input
              id="history-file-upload"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        )}

        {step === 'configure' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <FileSpreadsheet className="h-5 w-5" />
              <span className="font-medium">{file?.name}</span>
              <span className="text-muted-foreground">({rawData.length} linhas)</span>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Unidade *</Label>
                <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map(unit => (
                      <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Colunas detectadas</Label>
                <div className="flex flex-wrap gap-2">
                  {headers.slice(0, 15).map((h, i) => {
                    const isMonth = parseMonthHeader(h) !== null;
                    return (
                      <span
                        key={i}
                        className={`px-2 py-1 rounded text-xs ${
                          isMonth ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        }`}
                      >
                        {h || `Col ${i + 1}`}
                      </span>
                    );
                  })}
                  {headers.length > 15 && (
                    <span className="px-2 py-1 text-xs text-muted-foreground">
                      +{headers.length - 15} colunas
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleParseData}>Continuar</Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            {unmatchedCodes.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{unmatchedCodes.length} códigos não encontrados</AlertTitle>
                <AlertDescription>
                  {unmatchedCodes.slice(0, 10).join(', ')}
                  {unmatchedCodes.length > 10 && ` ... e mais ${unmatchedCodes.length - 10}`}
                </AlertDescription>
              </Alert>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{parsedRows.length}</div>
                  <p className="text-sm text-muted-foreground">Produtos encontrados</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{totalMonths}</div>
                  <p className="text-sm text-muted-foreground">Registros de vendas</p>
                </CardContent>
              </Card>
            </div>

            <div className="max-h-[300px] overflow-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2">Código</th>
                    <th className="text-left p-2">Meses</th>
                    <th className="text-right p-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 font-mono">{row.productCode}</td>
                      <td className="p-2">
                        {row.months.map(m => format(m.date, 'MMM/yy', { locale: ptBR })).join(', ')}
                      </td>
                      <td className="p-2 text-right">
                        {row.months.reduce((s, m) => s + m.quantity, 0).toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 20 && (
                <p className="text-center text-sm text-muted-foreground py-2">
                  ... e mais {parsedRows.length - 20} produtos
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep('configure')}>Voltar</Button>
              <Button onClick={handleImport}>
                <Upload className="mr-2 h-4 w-4" />
                Importar Histórico
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-8 space-y-4 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <p className="font-medium">Importando histórico...</p>
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground">{progress}%</p>
          </div>
        )}

        {step === 'complete' && (
          <div className="py-8 space-y-4 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <p className="text-lg font-medium">Importação concluída!</p>
            <p className="text-muted-foreground">
              {importStats.imported} registros importados
            </p>
            <Button onClick={handleClose}>Fechar</Button>
          </div>
        )}

        {step === 'error' && (
          <div className="py-8 space-y-4 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <p className="text-lg font-medium">Erro na importação</p>
            <p className="text-muted-foreground">{errorMessage}</p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={handleClose}>Fechar</Button>
              <Button onClick={resetState}>Tentar novamente</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
