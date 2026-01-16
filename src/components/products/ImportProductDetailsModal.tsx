import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface ImportProductDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ProductDetails {
  code: string;
  technical_description?: string;
  ean_13?: string;
  dun_14?: string;
  ncm?: string;
  item_type?: string;
  origin_description?: string;
  qty_master_box?: number;
  master_box_length?: number;
  master_box_width?: number;
  master_box_height?: number;
  master_box_volume?: number;
  gross_weight?: number;
  weight_per_unit?: number;
  individual_length?: number;
  individual_width?: number;
  individual_height?: number;
  individual_weight?: number;
  packaging_type?: string;
  product_length?: number;
  product_width?: number;
  product_height?: number;
}

interface CompareResult {
  toUpdate: ProductDetails[];
  toIgnore: ProductDetails[];
}

type ImportStep = 'upload' | 'preview' | 'comparing' | 'compared' | 'importing' | 'complete' | 'error';

export function ImportProductDetailsModal({ open, onOpenChange, onSuccess }: ImportProductDetailsModalProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [products, setProducts] = useState<ProductDetails[]>([]);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ updated: number; ignored: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const resetState = () => {
    setStep('upload');
    setProducts([]);
    setCompareResult(null);
    setProgress(0);
    setError(null);
    setResult(null);
  };

  const handleClose = () => {
    if (step === 'complete') {
      onSuccess?.();
    }
    resetState();
    onOpenChange(false);
  };

  const parseNumber = (value: any): number | undefined => {
    if (value === null || value === undefined || value === '') return undefined;
    const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
    return isNaN(num) ? undefined : num;
  };

  const parseExcel = useCallback(async (file: File): Promise<ProductDetails[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          // Find header row (should be first row)
          const headers = jsonData[0] as string[];
          
          // Map column indices
          const colMap: Record<string, number> = {};
          headers.forEach((header, index) => {
            const normalized = String(header || '').trim().toLowerCase();
            if (normalized.includes('código') || normalized === 'codigo') colMap['code'] = index;
            if (normalized.includes('descrição') || normalized === 'descricao') colMap['description'] = index;
            if (normalized === 'ean 13' || normalized === 'ean13') colMap['ean_13'] = index;
            if (normalized === 'dun 14' || normalized === 'dun14') colMap['dun_14'] = index;
            if (normalized === 'ncm') colMap['ncm'] = index;
            if (normalized.includes('tipo item')) colMap['item_type'] = index;
            if (normalized.includes('desc. origem') || normalized.includes('origem')) colMap['origin_description'] = index;
            if (normalized === 'qt' || normalized === 'quantidade') colMap['qty_master_box'] = index;
            if (normalized.includes('c. (m)') && normalized.includes('master')) colMap['master_box_length'] = index;
            if (normalized.includes('l. (m)') && normalized.includes('master')) colMap['master_box_width'] = index;
            if (normalized.includes('a. (m)') && normalized.includes('master')) colMap['master_box_height'] = index;
            if (normalized.includes('vol') || normalized === 'vol (m³)') colMap['master_box_volume'] = index;
            if (normalized.includes('peso bruto')) colMap['gross_weight'] = index;
            if (normalized.includes('peso líquido') || normalized.includes('peso liquido')) colMap['weight_per_unit'] = index;
            if (normalized.includes('c. individual') || normalized === 'c.individual') colMap['individual_length'] = index;
            if (normalized.includes('l. individual') || normalized === 'l.individual') colMap['individual_width'] = index;
            if (normalized.includes('a. individual') || normalized === 'a.individual') colMap['individual_height'] = index;
            if (normalized.includes('p. individual') || normalized === 'p.individual') colMap['individual_weight'] = index;
            if (normalized.includes('tipo emb')) colMap['packaging_type'] = index;
            if (normalized.includes('c. produto') || normalized === 'c.produto') colMap['product_length'] = index;
            if (normalized.includes('l. produto') || normalized === 'l.produto') colMap['product_width'] = index;
            if (normalized.includes('a. produto') || normalized === 'a.produto') colMap['product_height'] = index;
          });

          console.log('Column mapping:', colMap);

          const products: ProductDetails[] = [];
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;

            const code = String(row[colMap['code']] || '').trim();
            if (!code) continue;

            products.push({
              code,
              technical_description: String(row[colMap['description']] || '').trim() || undefined,
              ean_13: String(row[colMap['ean_13']] || '').trim() || undefined,
              dun_14: String(row[colMap['dun_14']] || '').trim() || undefined,
              ncm: String(row[colMap['ncm']] || '').trim() || undefined,
              item_type: String(row[colMap['item_type']] || '').trim() || undefined,
              origin_description: String(row[colMap['origin_description']] || '').trim() || undefined,
              qty_master_box: parseNumber(row[colMap['qty_master_box']]),
              master_box_length: parseNumber(row[colMap['master_box_length']]),
              master_box_width: parseNumber(row[colMap['master_box_width']]),
              master_box_height: parseNumber(row[colMap['master_box_height']]),
              master_box_volume: parseNumber(row[colMap['master_box_volume']]),
              gross_weight: parseNumber(row[colMap['gross_weight']]),
              weight_per_unit: parseNumber(row[colMap['weight_per_unit']]),
              individual_length: parseNumber(row[colMap['individual_length']]),
              individual_width: parseNumber(row[colMap['individual_width']]),
              individual_height: parseNumber(row[colMap['individual_height']]),
              individual_weight: parseNumber(row[colMap['individual_weight']]),
              packaging_type: String(row[colMap['packaging_type']] || '').trim() || undefined,
              product_length: parseNumber(row[colMap['product_length']]),
              product_width: parseNumber(row[colMap['product_width']]),
              product_height: parseNumber(row[colMap['product_height']]),
            });
          }

          resolve(products);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    try {
      setProgress(10);
      const parsed = await parseExcel(file);
      setProducts(parsed);
      setProgress(100);
      setStep('preview');
    } catch (err) {
      setError('Erro ao processar arquivo Excel');
      setStep('error');
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) await processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleCompare = async () => {
    setStep('comparing');
    setProgress(0);

    try {
      // Get all product codes from uploaded data
      const codes = products.map(p => p.code);
      
      // Fetch existing products from database
      const { data: existingProducts, error } = await supabase
        .from('products')
        .select('code')
        .in('code', codes);

      if (error) throw error;

      setProgress(50);

      const existingCodes = new Set(existingProducts?.map(p => p.code) || []);
      
      const toUpdate = products.filter(p => existingCodes.has(p.code));
      const toIgnore = products.filter(p => !existingCodes.has(p.code));

      setCompareResult({ toUpdate, toIgnore });
      setProgress(100);
      setStep('compared');
    } catch (err: any) {
      setError(err.message || 'Erro ao comparar produtos');
      setStep('error');
    }
  };

  const handleImport = async () => {
    if (!compareResult) return;

    setStep('importing');
    setProgress(0);

    try {
      const { data, error } = await supabase.functions.invoke('import-product-details', {
        body: { products: compareResult.toUpdate }
      });

      if (error) throw error;

      setProgress(100);
      setResult({ updated: data.updated, ignored: data.ignored });
      setStep('complete');
      toast.success(`${data.updated} produtos atualizados com sucesso!`);
    } catch (err: any) {
      setError(err.message || 'Erro ao importar produtos');
      setStep('error');
    }
  };

  const renderContent = () => {
    switch (step) {
      case 'upload':
        return (
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Arraste o arquivo Excel aqui</p>
            <p className="text-sm text-muted-foreground mb-4">ou clique para selecionar</p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload-details"
            />
            <label htmlFor="file-upload-details">
              <Button variant="outline" asChild>
                <span><FileSpreadsheet className="h-4 w-4 mr-2" />Selecionar Arquivo</span>
              </Button>
            </label>
          </div>
        );

      case 'preview':
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Arquivo Carregado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{products.length}</p>
                <p className="text-sm text-muted-foreground">produtos no arquivo</p>
              </CardContent>
            </Card>
            
            <ScrollArea className="h-48 border rounded-lg p-4">
              <div className="space-y-1">
                {products.slice(0, 20).map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Badge variant="outline">{p.code}</Badge>
                    <span className="truncate text-muted-foreground">{p.technical_description}</span>
                  </div>
                ))}
                {products.length > 20 && (
                  <p className="text-sm text-muted-foreground pt-2">
                    ... e mais {products.length - 20} produtos
                  </p>
                )}
              </div>
            </ScrollArea>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={resetState}>Cancelar</Button>
              <Button onClick={handleCompare}>Comparar com Banco</Button>
            </div>
          </div>
        );

      case 'comparing':
        return (
          <div className="space-y-4 py-8">
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
            <p className="text-center font-medium">Comparando com banco de dados...</p>
            <Progress value={progress} />
          </div>
        );

      case 'compared':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-green-500/50 bg-green-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    Serão Atualizados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">{compareResult?.toUpdate.length}</p>
                  <p className="text-sm text-muted-foreground">produtos existentes no banco</p>
                </CardContent>
              </Card>

              <Card className="border-amber-500/50 bg-amber-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-amber-600">
                    <AlertCircle className="h-5 w-5" />
                    Serão Ignorados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-amber-600">{compareResult?.toIgnore.length}</p>
                  <p className="text-sm text-muted-foreground">não existem no banco</p>
                </CardContent>
              </Card>
            </div>

            {compareResult && compareResult.toIgnore.length > 0 && (
              <ScrollArea className="h-32 border rounded-lg p-4 border-amber-500/30">
                <p className="text-sm font-medium text-amber-600 mb-2">Códigos que serão ignorados:</p>
                <div className="flex flex-wrap gap-1">
                  {compareResult.toIgnore.slice(0, 30).map((p, i) => (
                    <Badge key={i} variant="outline" className="text-amber-600 border-amber-500/50">
                      {p.code}
                    </Badge>
                  ))}
                  {compareResult.toIgnore.length > 30 && (
                    <Badge variant="outline" className="text-amber-600">
                      +{compareResult.toIgnore.length - 30}
                    </Badge>
                  )}
                </div>
              </ScrollArea>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={resetState}>Cancelar</Button>
              <Button onClick={handleImport} disabled={!compareResult?.toUpdate.length}>
                Importar {compareResult?.toUpdate.length} Produtos
              </Button>
            </div>
          </div>
        );

      case 'importing':
        return (
          <div className="space-y-4 py-8">
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
            <p className="text-center font-medium">Importando dados...</p>
            <Progress value={progress} />
          </div>
        );

      case 'complete':
        return (
          <div className="space-y-4 py-8 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
            <div>
              <p className="text-xl font-bold">{result?.updated} produtos atualizados</p>
              {result?.ignored ? (
                <p className="text-sm text-muted-foreground">{result.ignored} produtos ignorados</p>
              ) : null}
            </div>
            <Button onClick={handleClose}>Fechar</Button>
          </div>
        );

      case 'error':
        return (
          <div className="space-y-4 py-8 text-center">
            <XCircle className="h-16 w-16 mx-auto text-destructive" />
            <div>
              <p className="text-xl font-bold text-destructive">Erro na importação</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button onClick={resetState}>Tentar Novamente</Button>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Detalhes dos Produtos</DialogTitle>
          <DialogDescription>
            Importe dados complementares da base Partner para atualizar produtos existentes.
          </DialogDescription>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
