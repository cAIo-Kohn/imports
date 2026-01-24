import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Package, TrendingDown, AlertTriangle, TrendingUp, Building2, Upload, FileSpreadsheet, RefreshCw, Ship, Bug, Database } from 'lucide-react';
import { SupplierHealthRow } from '@/components/planning/SupplierHealthRow';
import { HealthBar } from '@/components/planning/HealthBar';
import { ImportForecastModal } from '@/components/planning/ImportForecastModal';
import { ImportInventoryModal } from '@/components/planning/ImportInventoryModal';
import { ImportArrivalsModal } from '@/components/planning/ImportArrivalsModal';
import { ImportSalesHistoryModal } from '@/components/planning/ImportSalesHistoryModal';
import { useSupplierHealth } from '@/hooks/useSupplierHealth';
import { format } from 'date-fns';

export default function DemandPlanning() {
  const [searchParams, setSearchParams] = useSearchParams();
  const debugMode = searchParams.get('debug') === '1';
  
  // Modal states
  const [importForecastOpen, setImportForecastOpen] = useState(false);
  const [importInventoryOpen, setImportInventoryOpen] = useState(false);
  const [importHistoryOpen, setImportHistoryOpen] = useState(false);
  const [importArrivalsOpen, setImportArrivalsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Use the optimized hook that reads from materialized view
  const { supplierHealthData, overallStats, isLoading, refreshData } = useSupplierHealth();

  // Handle refresh with loading state
  const handleRefreshData = useCallback(async () => {
    setIsRefreshing(true);
    await refreshData();
    setIsRefreshing(false);
  }, [refreshData]);

  // Handle import success
  const handleImportSuccess = useCallback(() => {
    handleRefreshData();
  }, [handleRefreshData]);

  // Toggle debug mode
  const toggleDebug = useCallback(() => {
    if (debugMode) {
      searchParams.delete('debug');
    } else {
      searchParams.set('debug', '1');
    }
    setSearchParams(searchParams);
  }, [debugMode, searchParams, setSearchParams]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
        <p className="text-sm text-muted-foreground text-center">Carregando dados pré-calculados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Planejamento de Demanda</h1>
          <p className="text-muted-foreground">
            Selecione um fornecedor para analisar a projeção de estoque
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={debugMode ? "default" : "outline"} 
            size="icon" 
            onClick={toggleDebug} 
            title={debugMode ? "Desativar modo debug" : "Ativar modo debug"}
          >
            <Bug className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleRefreshData} 
            title="Atualizar dados"
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" onClick={() => setImportInventoryOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Estoque
          </Button>
          <Button variant="outline" onClick={() => setImportHistoryOpen(true)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Histórico
          </Button>
          <Button variant="outline" onClick={() => setImportArrivalsOpen(true)}>
            <Ship className="mr-2 h-4 w-4" />
            Chegadas
          </Button>
          <Button onClick={() => setImportForecastOpen(true)}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Previsão
          </Button>
        </div>
      </div>

      {/* Debug Panel */}
      {debugMode && (
        <Card className="border-dashed border-2 border-amber-500 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bug className="h-4 w-4 text-amber-500" />
              Modo Diagnóstico
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Database className="h-3 w-3" />
                View Materializada
              </Badge>
              <Badge variant="secondary">
                Fornecedores: {supplierHealthData.length}
              </Badge>
              <Badge variant="secondary">
                Produtos: {overallStats.totalProducts.toLocaleString()}
              </Badge>
              {overallStats.calculatedAt && (
                <Badge variant="outline">
                  Calculado em: {format(new Date(overallStats.calculatedAt), 'dd/MM/yyyy HH:mm')}
                </Badge>
              )}
            </div>
            <p className="text-xs text-green-600">
              ✓ Dados pré-calculados no banco. Clique em atualizar para recalcular após importações.
            </p>
            <p className="text-xs text-muted-foreground">
              Passe o mouse nos indicadores de período (3m, 6m...) para ver os produtos com ruptura.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Overall Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Resumo Geral</CardTitle>
          <CardDescription>Visão consolidada por horizonte de planejamento</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overallStats.totalProducts}</p>
                <p className="text-xs text-muted-foreground">produtos</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">{overallStats.totalCritical}</p>
                <p className="text-xs text-muted-foreground">crítico (3m)</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-500">{overallStats.totalAlert}</p>
                <p className="text-xs text-muted-foreground">alerta (6m)</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-500">{overallStats.totalAttention}</p>
                <p className="text-xs text-muted-foreground">atenção (9m)</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-500">{overallStats.totalOk}</p>
                <p className="text-xs text-muted-foreground">OK</p>
              </div>
            </div>
          </div>
          <HealthBar
            critical={overallStats.totalCritical}
            warning={overallStats.totalAlert + overallStats.totalAttention}
            healthy={overallStats.totalOk}
            className="mt-4"
          />
        </CardContent>
      </Card>

      {/* Supplier Rows */}
      {supplierHealthData.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <Building2 className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">Nenhum fornecedor com produtos</p>
              <p className="text-sm text-muted-foreground">
                Cadastre produtos e associe a fornecedores para visualizar o planejamento
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {supplierHealthData.map(data => (
            <SupplierHealthRow key={data.supplier.id} data={data} />
          ))}
        </div>
      )}

      {/* Import Modals */}
      <ImportForecastModal
        open={importForecastOpen}
        onOpenChange={setImportForecastOpen}
        onSuccess={handleImportSuccess}
      />
      <ImportInventoryModal
        open={importInventoryOpen}
        onOpenChange={setImportInventoryOpen}
        onSuccess={handleImportSuccess}
      />
      <ImportSalesHistoryModal
        open={importHistoryOpen}
        onOpenChange={setImportHistoryOpen}
        onSuccess={handleImportSuccess}
      />
      <ImportArrivalsModal
        open={importArrivalsOpen}
        onOpenChange={setImportArrivalsOpen}
        onSuccess={handleImportSuccess}
      />
    </div>
  );
}
