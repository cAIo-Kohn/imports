import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, Loader2, CheckCircle, AlertCircle, Plus, RefreshCw, Minus, ChevronDown, ChevronUp } from 'lucide-react';
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
import { toast } from '@/hooks/use-toast';

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

interface CompareResult {
  newProducts: string[];
  existingProducts: { code: string; description: string }[];
  removedProducts: { code: string; description: string }[];
  summary: {
    newCount: number;
    existingCount: number;
    removedCount: number;
  };
}

type ImportStep = 'upload' | 'preview' | 'comparing' | 'compare' | 'importing' | 'complete' | 'error';

export function ImportProductsModal({ open, onOpenChange, onSuccess }: ImportProductsModalProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedSection, setExpandedSection] = useState<'new' | 'existing' | 'removed' | null>(null);

  const resetState = useCallback(() => {
    setStep('upload');
    setProducts([]);
    setProgress(0);
    setResult(null);
    setCompareResult(null);
    setError(null);
    setExpandedSection(null);
  }, []);

  const handleClose = useCallback(() => {
    if (result?.success) {
      onSuccess();
    }
    resetState();
    onOpenChange(false);
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

        if (parsedProducts.length === 0) {
          setError('Nenhum produto válido encontrado no arquivo.');
          toast({
            title: "Arquivo inválido",
            description: "Nenhum produto válido encontrado no arquivo.",
            variant: "destructive"
          });
          return;
        }

        setProducts(parsedProducts);
        setStep('preview');
        setError(null);
        
        toast({
          title: "Arquivo carregado",
          description: `${parsedProducts.length} linhas encontradas no arquivo.`,
        });
      } catch (err) {
        const errorMsg = 'Erro ao processar o arquivo. Verifique se é um arquivo Excel válido.';
        setError(errorMsg);
        toast({
          title: "Erro ao ler arquivo",
          description: errorMsg,
          variant: "destructive"
        });
        console.error('Error parsing Excel:', err);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      parseExcel(file);
    } else {
      const errorMsg = 'Por favor, selecione um arquivo Excel (.xlsx ou .xls)';
      setError(errorMsg);
      toast({
        title: "Formato inválido",
        description: errorMsg,
        variant: "destructive"
      });
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

  const handleCompare = useCallback(async () => {
    setStep('comparing');
    setProgress(20);

    try {
      // Get unique codes from uploaded products
      const uniqueCodes = [...new Set(products.map(p => p.codigo))];

      toast({
        title: "Analisando arquivo",
        description: `Comparando ${uniqueCodes.length} produtos com o banco de dados...`,
      });

      const { data, error: fnError } = await supabase.functions.invoke('compare-products', {
        body: { codes: uniqueCodes }
      });

      if (fnError) {
        throw new Error(fnError.message || 'Erro ao comparar produtos');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const comparison = data as CompareResult;
      setCompareResult(comparison);
      setStep('compare');
      setProgress(100);

      toast({
        title: "Comparativo concluído",
        description: `${comparison.summary.newCount} novos, ${comparison.summary.existingCount} existentes, ${comparison.summary.removedCount} não estão no arquivo.`,
      });

    } catch (err) {
      console.error('Compare error:', err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(`Erro ao comparar: ${errorMsg}`);
      setStep('error');
      
      toast({
        title: "❌ Erro no comparativo",
        description: errorMsg,
        variant: "destructive"
      });
    }
  }, [products]);

  const handleImport = useCallback(async () => {
    setStep('importing');
    setProgress(10);
    setError(null);

    toast({
      title: "Importação iniciada",
      description: `Processando ${new Set(products.map(p => p.codigo)).size} produtos...`,
    });

    try {
      setProgress(30);
      
      const { data, error: fnError } = await supabase.functions.invoke('import-products', {
        body: { products }
      });

      setProgress(90);

      if (fnError) {
        throw new Error(fnError.message || 'Erro na função de importação');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const importResult = data as ImportResult;
      setResult(importResult);
      setStep('complete');
      setProgress(100);

      toast({
        title: "✅ Importação concluída!",
        description: `${importResult.productsCreated} produtos criados, ${importResult.productsUpdated} atualizados, ${importResult.unitsLinked} vínculos com unidades.`,
      });

      if (importResult.errors && importResult.errors.length > 0) {
        toast({
          title: "⚠️ Alguns erros ocorreram",
          description: `${importResult.errors.length} erros durante a importação. Verifique os detalhes.`,
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error('Import error:', err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(`Erro durante a importação: ${errorMsg}`);
      setStep('error');
      
      toast({
        title: "❌ Erro na importação",
        description: errorMsg,
        variant: "destructive"
      });
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

  const toggleSection = (section: 'new' | 'existing' | 'removed') => {
    setExpandedSection(prev => prev === section ? null : section);
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
                <Button onClick={handleCompare}>
                  Continuar e Comparar
                </Button>
              </div>
            </div>
          )}

          {step === 'comparing' && (
            <div className="py-8 space-y-4">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              <p className="text-center text-muted-foreground">
                Comparando {uniqueProducts} produtos com o banco de dados...
              </p>
              <Progress value={progress} />
            </div>
          )}

          {step === 'compare' && compareResult && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => toggleSection('new')}
                  className={`p-4 rounded-lg text-left transition-colors ${
                    expandedSection === 'new' ? 'ring-2 ring-green-500' : ''
                  } bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30`}
                >
                  <div className="flex items-center justify-between">
                    <Plus className="h-5 w-5 text-green-600" />
                    {expandedSection === 'new' ? (
                      <ChevronUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                  <p className="text-2xl font-bold text-green-600 mt-2">{compareResult.summary.newCount}</p>
                  <p className="text-sm text-green-700 dark:text-green-400">Produtos novos</p>
                </button>

                <button
                  onClick={() => toggleSection('existing')}
                  className={`p-4 rounded-lg text-left transition-colors ${
                    expandedSection === 'existing' ? 'ring-2 ring-blue-500' : ''
                  } bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30`}
                >
                  <div className="flex items-center justify-between">
                    <RefreshCw className="h-5 w-5 text-blue-600" />
                    {expandedSection === 'existing' ? (
                      <ChevronUp className="h-4 w-4 text-blue-600" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                  <p className="text-2xl font-bold text-blue-600 mt-2">{compareResult.summary.existingCount}</p>
                  <p className="text-sm text-blue-700 dark:text-blue-400">Serão atualizados</p>
                </button>

                <button
                  onClick={() => toggleSection('removed')}
                  className={`p-4 rounded-lg text-left transition-colors ${
                    expandedSection === 'removed' ? 'ring-2 ring-amber-500' : ''
                  } bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30`}
                >
                  <div className="flex items-center justify-between">
                    <Minus className="h-5 w-5 text-amber-600" />
                    {expandedSection === 'removed' ? (
                      <ChevronUp className="h-4 w-4 text-amber-600" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-amber-600" />
                    )}
                  </div>
                  <p className="text-2xl font-bold text-amber-600 mt-2">{compareResult.summary.removedCount}</p>
                  <p className="text-sm text-amber-700 dark:text-amber-400">Não estão no arquivo</p>
                </button>
              </div>

              {/* Expanded section content */}
              {expandedSection && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-48 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left p-2">Código</th>
                          <th className="text-left p-2">Descrição</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expandedSection === 'new' && compareResult.newProducts.slice(0, 50).map((code, i) => {
                          const product = products.find(p => p.codigo === code);
                          return (
                            <tr key={i} className="border-t">
                              <td className="p-2 font-mono text-green-600">{code}</td>
                              <td className="p-2 truncate max-w-[300px]">{product?.descricao || '-'}</td>
                            </tr>
                          );
                        })}
                        {expandedSection === 'existing' && compareResult.existingProducts.slice(0, 50).map((p, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-2 font-mono text-blue-600">{p.code}</td>
                            <td className="p-2 truncate max-w-[300px]">{p.description}</td>
                          </tr>
                        ))}
                        {expandedSection === 'removed' && compareResult.removedProducts.slice(0, 50).map((p, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-2 font-mono text-amber-600">{p.code}</td>
                            <td className="p-2 truncate max-w-[300px]">{p.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {((expandedSection === 'new' && compareResult.newProducts.length > 50) ||
                    (expandedSection === 'existing' && compareResult.existingProducts.length > 50) ||
                    (expandedSection === 'removed' && compareResult.removedProducts.length > 50)) && (
                    <div className="p-2 text-center text-sm text-muted-foreground bg-muted">
                      Mostrando 50 primeiros itens
                    </div>
                  )}
                </div>
              )}

              {/* Info message about removed products */}
              {compareResult.summary.removedCount > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-amber-800 dark:text-amber-200">
                    <strong>{compareResult.summary.removedCount} produtos</strong> existem no banco mas não estão no arquivo. 
                    Eles não serão removidos automaticamente.
                  </p>
                </div>
              )}

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
                Importando {uniqueProducts} produtos, aguarde...
              </p>
              <Progress value={progress} />
              <p className="text-center text-xs text-muted-foreground">
                Este processo pode levar alguns segundos
              </p>
            </div>
          )}

          {step === 'error' && (
            <div className="py-8 space-y-4">
              <div className="flex items-center justify-center">
                <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
              </div>
              <p className="text-center text-lg font-medium text-destructive">
                Erro na importação
              </p>
              {error && (
                <p className="text-center text-sm text-muted-foreground">
                  {error}
                </p>
              )}
              <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={resetState}>
                  Tentar novamente
                </Button>
                <Button onClick={handleClose}>Fechar</Button>
              </div>
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
