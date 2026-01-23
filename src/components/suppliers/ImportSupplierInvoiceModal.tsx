import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Upload, FileSpreadsheet, Check, X, Building2, MapPin, Phone, Package } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImportSupplierInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ParsedSupplier {
  companyName: string;
  tradeName: string;
  address: string;
  city: string;
  stateProvince: string;
  country: string;
  phone: string;
  fax: string;
}

interface ProductMatch {
  code: string;
  description: string;
  productId: string | null;
  found: boolean;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'complete' | 'error';

function normalizeProductCode(code: string): string {
  return code.replace(/^0+/, '');
}

function extractSupplierData(rows: any[][]): ParsedSupplier {
  // Row 0: Company name (first non-empty cell)
  const companyName = rows[0]?.[0]?.toString().trim() || '';
  
  // Row 6: Full address
  const addressLine = rows[6]?.[0]?.toString().trim() || '';
  
  // Row 7: Phone/Fax
  const contactLine = rows[7]?.[0]?.toString().trim() || '';
  
  // Parse phone and fax from contact line
  let phone = '';
  let fax = '';
  if (contactLine) {
    const phoneMatch = contactLine.match(/TEL[:\s]*([0-9\s-+]+)/i);
    const faxMatch = contactLine.match(/FAX[:\s]*([0-9\s-+]+)/i);
    phone = phoneMatch ? phoneMatch[1].trim() : '';
    fax = faxMatch ? faxMatch[1].trim() : '';
  }
  
  // Parse address components
  let city = '';
  let stateProvince = '';
  let country = 'China';
  let address = addressLine;
  
  // Try to extract city and state from address
  // Format: "..., City, State/Province, Country"
  const addressParts = addressLine.split(',').map(p => p.trim());
  if (addressParts.length >= 3) {
    // Last part is usually country
    const lastPart = addressParts[addressParts.length - 1].toLowerCase();
    if (lastPart.includes('china')) {
      country = 'China';
    }
    
    // Look for city patterns
    for (const part of addressParts) {
      if (part.toLowerCase().includes('city')) {
        city = part.replace(/city/i, '').trim() + ' City';
      }
      if (part.toLowerCase() === 'gd' || part.toLowerCase().includes('guangdong')) {
        stateProvince = 'Guangdong';
      }
    }
  }
  
  return {
    companyName,
    tradeName: '',
    address,
    city,
    stateProvince,
    country,
    phone,
    fax
  };
}

function extractProductCodes(rows: any[][]): { code: string; description: string }[] {
  const products: { code: string; description: string }[] = [];
  
  // Find the header row (look for "MOR CODE" or similar)
  let dataStartRow = -1;
  let codeColIndex = -1;
  let descColIndex = -1;
  
  for (let i = 0; i < Math.min(30, rows.length); i++) {
    const row = rows[i];
    if (!row) continue;
    
    for (let j = 0; j < row.length; j++) {
      const cell = row[j]?.toString().toLowerCase() || '';
      if (cell.includes('mor code') || cell.includes('mor. code') || cell === 'code') {
        codeColIndex = j;
        dataStartRow = i + 1;
      }
      if (cell.includes('description') || cell.includes('descrição')) {
        descColIndex = j;
      }
    }
    
    if (dataStartRow > 0) break;
  }
  
  // If we found the header, extract products
  if (dataStartRow > 0 && codeColIndex >= 0) {
    for (let i = dataStartRow; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      
      const code = row[codeColIndex]?.toString().trim() || '';
      const description = descColIndex >= 0 ? (row[descColIndex]?.toString().trim() || '') : '';
      
      // Check if it looks like a valid product code (6 digits)
      if (code && /^\d{5,6}$/.test(code)) {
        products.push({ code, description });
      }
    }
  }
  
  return products;
}

export function ImportSupplierInvoiceModal({ open, onOpenChange, onSuccess }: ImportSupplierInvoiceModalProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [parsedSupplier, setParsedSupplier] = useState<ParsedSupplier | null>(null);
  const [productMatches, setProductMatches] = useState<ProductMatch[]>([]);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Editable supplier fields
  const [editedSupplier, setEditedSupplier] = useState<ParsedSupplier | null>(null);

  // Fetch existing products for matching
  const { data: existingProducts = [] } = useQuery({
    queryKey: ['products-for-supplier-import'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, code, technical_description')
        .eq('is_active', true);
      
      if (error) throw error;
      return data || [];
    },
    enabled: open
  });

  // Fetch existing suppliers to check for duplicates
  const { data: existingSuppliers = [] } = useQuery({
    queryKey: ['suppliers-for-import-check'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, company_name, trade_name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: open
  });

  const processFile = useCallback(async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
      
      // Extract supplier data
      const supplier = extractSupplierData(rows);
      setParsedSupplier(supplier);
      setEditedSupplier(supplier);
      
      // Extract and match product codes
      const extractedProducts = extractProductCodes(rows);
      
      // Create a map for quick lookup (normalized code -> product)
      const productMap = new Map<string, { id: string; description: string }>();
      for (const p of existingProducts) {
        const normalizedCode = normalizeProductCode(p.code);
        productMap.set(normalizedCode, { id: p.id, description: p.technical_description });
      }
      
      // Match products
      const matches: ProductMatch[] = extractedProducts.map(ep => {
        const normalizedCode = normalizeProductCode(ep.code);
        const match = productMap.get(normalizedCode);
        return {
          code: ep.code,
          description: ep.description || match?.description || '',
          productId: match?.id || null,
          found: !!match
        };
      });
      
      setProductMatches(matches);
      setStep('preview');
    } catch (error) {
      console.error('Error processing file:', error);
      setErrorMessage('Erro ao processar o arquivo. Verifique se é um arquivo Excel válido.');
      setStep('error');
    }
  }, [existingProducts]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      processFile(file);
    } else {
      toast.error('Por favor, selecione um arquivo Excel (.xlsx ou .xls)');
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleImport = async () => {
    if (!editedSupplier) return;
    
    setStep('importing');
    setProgress(0);
    
    try {
      // Check if supplier already exists
      const existingSupplier = existingSuppliers.find(
        s => s.company_name.toLowerCase() === editedSupplier.companyName.toLowerCase()
      );
      
      let supplierId: string;
      
      if (existingSupplier) {
        supplierId = existingSupplier.id;
        setProgress(30);
      } else {
        // Create new supplier
        const { data: newSupplier, error: supplierError } = await supabase
          .from('suppliers')
          .insert({
            company_name: editedSupplier.companyName,
            trade_name: editedSupplier.tradeName || null,
            country: editedSupplier.country,
            city: editedSupplier.city || null,
            state_province: editedSupplier.stateProvince || null,
            address: editedSupplier.address || null,
            contact_phone: editedSupplier.phone || null,
            is_active: true
          })
          .select('id')
          .single();
        
        if (supplierError) throw supplierError;
        supplierId = newSupplier.id;
        setProgress(30);
      }
      
      // Link products to supplier
      const productsToLink = productMatches.filter(p => p.found && p.productId);
      const totalProducts = productsToLink.length;
      let linkedCount = 0;
      
      // Update products in batches
      const batchSize = 50;
      for (let i = 0; i < productsToLink.length; i += batchSize) {
        const batch = productsToLink.slice(i, i + batchSize);
        const productIds = batch.map(p => p.productId!);
        
        const { error: updateError } = await supabase
          .from('products')
          .update({ supplier_id: supplierId })
          .in('id', productIds);
        
        if (updateError) throw updateError;
        
        linkedCount += batch.length;
        setProgress(30 + Math.round((linkedCount / totalProducts) * 70));
      }
      
      setStep('complete');
      
      toast.success(
        existingSupplier 
          ? `${linkedCount} produtos vinculados ao fornecedor existente`
          : `Fornecedor criado e ${linkedCount} produtos vinculados`
      );
      
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 1500);
      
    } catch (error: any) {
      console.error('Import error:', error);
      setErrorMessage(error.message || 'Erro ao importar fornecedor');
      setStep('error');
    }
  };

  const handleClose = () => {
    setStep('upload');
    setParsedSupplier(null);
    setEditedSupplier(null);
    setProductMatches([]);
    setProgress(0);
    setErrorMessage('');
    onOpenChange(false);
  };

  const foundProducts = productMatches.filter(p => p.found);
  const notFoundProducts = productMatches.filter(p => !p.found);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Fornecedor
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Faça upload de uma Proforma Invoice para importar fornecedor e vincular produtos'}
            {step === 'preview' && 'Revise os dados extraídos antes de importar'}
            {step === 'importing' && 'Importando fornecedor e vinculando produtos...'}
            {step === 'complete' && 'Importação concluída com sucesso!'}
            {step === 'error' && 'Ocorreu um erro durante a importação'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {step === 'upload' && (
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">
                Arraste e solte o arquivo aqui
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                ou clique para selecionar (Excel .xlsx ou .xls)
              </p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id="supplier-file-input"
              />
              <Button variant="outline" asChild>
                <label htmlFor="supplier-file-input" className="cursor-pointer">
                  Selecionar Arquivo
                </label>
              </Button>
            </div>
          )}

          {step === 'preview' && editedSupplier && (
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-6">
                {/* Supplier Data Card */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Building2 className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Dados do Fornecedor</h3>
                      {existingSuppliers.some(s => 
                        s.company_name.toLowerCase() === editedSupplier.companyName.toLowerCase()
                      ) && (
                        <Badge variant="secondary">Já cadastrado</Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Label>Nome da Empresa</Label>
                        <Input 
                          value={editedSupplier.companyName}
                          onChange={(e) => setEditedSupplier({ ...editedSupplier, companyName: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>País</Label>
                        <Input 
                          value={editedSupplier.country}
                          onChange={(e) => setEditedSupplier({ ...editedSupplier, country: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Cidade</Label>
                        <Input 
                          value={editedSupplier.city}
                          onChange={(e) => setEditedSupplier({ ...editedSupplier, city: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Estado/Província</Label>
                        <Input 
                          value={editedSupplier.stateProvince}
                          onChange={(e) => setEditedSupplier({ ...editedSupplier, stateProvince: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Telefone</Label>
                        <Input 
                          value={editedSupplier.phone}
                          onChange={(e) => setEditedSupplier({ ...editedSupplier, phone: e.target.value })}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Products Card */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold">Produtos Encontrados</h3>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="default">{foundProducts.length} encontrados</Badge>
                        {notFoundProducts.length > 0 && (
                          <Badge variant="destructive">{notFoundProducts.length} não encontrados</Badge>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 max-h-[250px] overflow-y-auto">
                      {productMatches.map((product, index) => (
                        <div 
                          key={index}
                          className={`flex items-center gap-3 p-2 rounded-md ${
                            product.found ? 'bg-primary/10' : 'bg-destructive/10'
                          }`}
                        >
                          {product.found ? (
                            <Check className="h-4 w-4 text-primary flex-shrink-0" />
                          ) : (
                            <X className="h-4 w-4 text-destructive flex-shrink-0" />
                          )}
                          <span className="font-mono text-sm">{product.code}</span>
                          <span className="text-sm text-muted-foreground truncate flex-1">
                            {product.description}
                          </span>
                        </div>
                      ))}
                    </div>

                    {productMatches.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum código de produto encontrado na planilha
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Summary */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm">
                    <strong>Resumo:</strong>{' '}
                    {existingSuppliers.some(s => 
                      s.company_name.toLowerCase() === editedSupplier.companyName.toLowerCase()
                    ) 
                      ? 'Fornecedor já existe. '
                      : 'Novo fornecedor será criado. '
                    }
                    {foundProducts.length} produto(s) serão vinculados.
                    {notFoundProducts.length > 0 && (
                      <span className="text-destructive">
                        {' '}{notFoundProducts.length} produto(s) não encontrados no banco.
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </ScrollArea>
          )}

          {step === 'importing' && (
            <div className="py-12 space-y-4">
              <Progress value={progress} />
              <p className="text-center text-sm text-muted-foreground">
                {progress < 30 ? 'Criando fornecedor...' : 'Vinculando produtos...'}
              </p>
            </div>
          )}

          {step === 'complete' && (
            <div className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <p className="text-lg font-medium">Importação Concluída!</p>
              <p className="text-sm text-muted-foreground">
                {foundProducts.length} produto(s) vinculado(s) ao fornecedor
              </p>
            </div>
          )}

          {step === 'error' && (
            <div className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <X className="h-8 w-8 text-destructive" />
              </div>
              <p className="text-lg font-medium">Erro na Importação</p>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          )}
          
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Voltar
              </Button>
              <Button 
                onClick={handleImport}
                disabled={foundProducts.length === 0}
              >
                Importar Fornecedor
              </Button>
            </>
          )}
          
          {step === 'error' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Fechar
              </Button>
              <Button onClick={() => setStep('upload')}>
                Tentar Novamente
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
