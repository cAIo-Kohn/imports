import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';

interface ImportProductsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ProductRow {
  estabelecimento: number;
  codigo: string;
  descricao: string;
  statusDeposito: string;
}

interface ImportResult {
  success: boolean;
  productsCreated: number;
  productsUpdated: number;
  unitsLinked: number;
  totalProcessed: number;
  errors?: string[];
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'complete';

export function ImportProductsModal({ open, onOpenChange, onSuccess }: ImportProductsModalProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const resetState = useCallback(() => {
    setStep('upload');
    setProducts([]);
    setProgress(0);
    setResult(null);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
    if (result?.success) {
      onSuccess();
    }
  }, [resetState, onOpenChange, result, onSuccess]);

  const parseExcel = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

        // Skip header row and parse data
        const parsedProducts: ProductRow[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (row && row.length >= 4) {
            const estabelecimento = Number(row[0]);
            const codigo = String(row[1] || '').trim();
            const descricao = String(row[2] || '').trim();
            const statusDeposito = String(row[3] || '').trim();

            if (codigo && descricao) {
              parsedProducts.push({
                estabelecimento,
                codigo,
                descricao,
                statusDeposito
              });
            }
          }
        }

        setProducts(parsedProducts);
        setStep('preview');
        setError(null);
      } catch (err) {
        setError('Erro ao processar o arquivo. Verifique se é um arquivo Excel válido.');
        console.error('Error parsing Excel:', err);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      parseExcel(file);
    } else {
      setError('Por favor, selecione um arquivo Excel (.xlsx ou .xls)');
    }
  }, [parseExcel]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleImport = useCallback(async () => {
    setStep('importing');
    setProgress(10);

    try {
      setProgress(30);
      
      const { data, error: fnError } = await supabase.functions.invoke('import-products', {
        body: { products }
      });

      setProgress(90);

      if (fnError) {
        throw fnError;
      }

      setResult(data as ImportResult);
      setStep('complete');
      setProgress(100);
    } catch (err) {
      console.error('Import error:', err);
      setError(`Erro durante a importação: ${String(err)}`);
      setStep('upload');
    }
  }, [products]);

  const getEstabelecimentoName = (num: number) => {
    switch (num) {
      case 1: return 'Matriz';
      case 9: return 'Filial PE';
      case 10: return 'Filial RJ';
      default: return `Est. ${num}`;
    }
  };

  // Count unique products
  const uniqueProducts = new Set(products.map(p => p.codigo)).size;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Produtos
          </DialogTitle>
          <DialogDescription>
            Importe produtos a partir de um arquivo Excel (.xlsx)
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">
                  Arraste e solte seu arquivo Excel aqui, ou
                </p>
                <Button asChild variant="outline">
                  <label className="cursor-pointer">
                    Selecionar Arquivo
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(file);
                      }}
                    />
                  </label>
                </Button>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-2">Formato esperado:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Coluna 1: Estabelecimento (1=Matriz, 9=Filial PE, 10=Filial RJ)</li>
                  <li>Coluna 2: Código do produto</li>
                  <li>Coluna 3: Descrição</li>
                  <li>Coluna 4: Status Depósito</li>
                </ul>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-2xl font-bold">{products.length}</p>
                  <p className="text-sm text-muted-foreground">Linhas no arquivo</p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-2xl font-bold">{uniqueProducts}</p>
                  <p className="text-sm text-muted-foreground">Produtos únicos</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-60 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2">Estab.</th>
                        <th className="text-left p-2">Código</th>
                        <th className="text-left p-2">Descrição</th>
                        <th className="text-left p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.slice(0, 50).map((product, index) => (
                        <tr key={index} className="border-t">
                          <td className="p-2">{getEstabelecimentoName(product.estabelecimento)}</td>
                          <td className="p-2 font-mono">{product.codigo}</td>
                          <td className="p-2 truncate max-w-[200px]">{product.descricao}</td>
                          <td className="p-2">{product.statusDeposito}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {products.length > 50 && (
                  <div className="p-2 text-center text-sm text-muted-foreground bg-muted">
                    Mostrando 50 de {products.length} linhas
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetState}>
                  Cancelar
                </Button>
                <Button onClick={handleImport}>
                  Importar {uniqueProducts} Produtos
                </Button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="py-8 space-y-4">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              <p className="text-center text-muted-foreground">
                Importando produtos, aguarde...
              </p>
              <Progress value={progress} />
            </div>
          )}

          {step === 'complete' && result && (
            <div className="space-y-4">
              <div className="flex items-center justify-center py-4">
                <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </div>

              <p className="text-center text-lg font-medium">
                Importação concluída com sucesso!
              </p>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted text-center">
                  <p className="text-2xl font-bold text-green-600">{result.productsCreated}</p>
                  <p className="text-sm text-muted-foreground">Produtos criados</p>
                </div>
                <div className="p-4 rounded-lg bg-muted text-center">
                  <p className="text-2xl font-bold text-blue-600">{result.productsUpdated}</p>
                  <p className="text-sm text-muted-foreground">Produtos atualizados</p>
                </div>
                <div className="p-4 rounded-lg bg-muted text-center">
                  <p className="text-2xl font-bold text-purple-600">{result.unitsLinked}</p>
                  <p className="text-sm text-muted-foreground">Vínculos criados</p>
                </div>
              </div>

              {result.errors && result.errors.length > 0 && (
                <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/20 text-sm">
                  <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                    Alguns erros ocorreram:
                  </p>
                  <ul className="list-disc list-inside text-yellow-700 dark:text-yellow-300 space-y-1">
                    {result.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleClose}>Fechar</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
