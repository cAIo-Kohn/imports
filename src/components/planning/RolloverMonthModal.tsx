import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, addMonths, subMonths } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Calendar, AlertTriangle, RotateCcw, Upload, FileSpreadsheet, Ship, TrendingUp, Package, Loader2 } from 'lucide-react';
import { ImportForecastModal } from './ImportForecastModal';
import { ImportInventoryModal } from './ImportInventoryModal';
import { ImportSalesHistoryModal } from './ImportSalesHistoryModal';
import { ImportArrivalsModal } from './ImportArrivalsModal';
import { toast } from 'sonner';

interface RolloverMonthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ValidationStatus {
  valid: boolean;
  message: string;
  date?: string;
  partial?: boolean;
  missingMonths?: string[];
  historyAvailable?: boolean;
}

export const RolloverMonthModal: React.FC<RolloverMonthModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const now = new Date();
  const currentMonth = startOfMonth(now);
  const previousMonth = subMonths(currentMonth, 1);
  const endOfNewPeriod = addMonths(currentMonth, 11);

  // Format dates for display
  const currentPeriodStart = format(previousMonth, 'MMM/yyyy');
  const currentPeriodEnd = format(addMonths(previousMonth, 11), 'MMM/yyyy');
  const newPeriodStart = format(currentMonth, 'MMM/yyyy');
  const newPeriodEnd = format(endOfNewPeriod, 'MMM/yyyy');
  const closingMonth = format(previousMonth, 'MMM/yyyy');

  // Import modal states
  const [importInventoryOpen, setImportInventoryOpen] = useState(false);
  const [importHistoryOpen, setImportHistoryOpen] = useState(false);
  const [importArrivalsOpen, setImportArrivalsOpen] = useState(false);
  const [importForecastOpen, setImportForecastOpen] = useState(false);

  // Date validation: today must be >= 1st of current month (always true if we're in the current month)
  const dayOfMonth = now.getDate();
  const dateValid = dayOfMonth >= 1;

  // Query: Check if inventory was uploaded for current month
  const { data: inventoryStatus, refetch: refetchInventory } = useQuery({
    queryKey: ['rollover-inventory-check', format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      const monthStart = format(currentMonth, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('inventory_snapshots')
        .select('snapshot_date')
        .gte('snapshot_date', monthStart)
        .order('snapshot_date', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        return {
          valid: true,
          message: 'Uploaded',
          date: data[0].snapshot_date,
        } as ValidationStatus;
      }
      return {
        valid: false,
        message: `Not uploaded for ${format(currentMonth, 'MMM/yyyy')}`,
      } as ValidationStatus;
    },
    enabled: open,
  });

  // Query: Check if history was uploaded for the closing month (previous month)
  const { data: historyStatus, refetch: refetchHistory } = useQuery({
    queryKey: ['rollover-history-check', format(previousMonth, 'yyyy-MM')],
    queryFn: async () => {
      const monthKey = format(previousMonth, 'yyyy-MM-dd');
      const { data, error, count } = await supabase
        .from('sales_history')
        .select('id', { count: 'exact', head: true })
        .eq('year_month', monthKey);
      
      if (error) throw error;
      
      if (count && count > 0) {
        return {
          valid: true,
          message: `${count} records for ${closingMonth}`,
        } as ValidationStatus;
      }
      return {
        valid: false,
        message: `No data for ${closingMonth}`,
      } as ValidationStatus;
    },
    enabled: open,
  });

  // Query: Check if arrivals exist for current month+
  const { data: arrivalsStatus, refetch: refetchArrivals } = useQuery({
    queryKey: ['rollover-arrivals-check', format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      const monthStart = format(currentMonth, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('scheduled_arrivals')
        .select('arrival_date')
        .gte('arrival_date', monthStart)
        .order('arrival_date', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        return {
          valid: true,
          message: 'Uploaded',
          date: data[0].arrival_date,
        } as ValidationStatus;
      }
      return {
        valid: false,
        message: 'Not uploaded',
      } as ValidationStatus;
    },
    enabled: open,
  });

  // Query: Check if forecasts cover the new period, detect missing months
  const { data: forecastStatus, refetch: refetchForecast } = useQuery({
    queryKey: ['rollover-forecast-check', format(currentMonth, 'yyyy-MM'), format(endOfNewPeriod, 'yyyy-MM')],
    queryFn: async () => {
      // Build list of all 12 required months
      const requiredMonths: Date[] = [];
      for (let i = 0; i < 12; i++) {
        requiredMonths.push(addMonths(currentMonth, i));
      }

      const startKey = format(currentMonth, 'yyyy-MM-dd');
      const endKey = format(endOfNewPeriod, 'yyyy-MM-dd');

      // Get distinct months that have forecasts
      const { data, error } = await supabase
        .from('sales_forecasts')
        .select('year_month')
        .gte('year_month', startKey)
        .lte('year_month', endKey);

      if (error) throw error;

      const coveredSet = new Set((data || []).map(r => r.year_month.substring(0, 7)));
      const missing = requiredMonths.filter(m => !coveredSet.has(format(m, 'yyyy-MM')));

      if (missing.length === 0) {
        return {
          valid: true,
          message: `Covers until ${format(endOfNewPeriod, 'MMM/yyyy')}`,
        } as ValidationStatus;
      }

      if (missing.length === requiredMonths.length) {
        return {
          valid: false,
          message: 'No forecasts for new period',
          missingMonths: missing.map(m => format(m, 'MMM/yyyy')),
        } as ValidationStatus;
      }

      // Partial: check if history exists for missing months (1 year prior)
      const historyChecks = await Promise.all(
        missing.map(async (m) => {
          const histMonth = format(subMonths(m, 12), 'yyyy-MM-dd');
          const { count } = await supabase
            .from('sales_history')
            .select('id', { count: 'exact', head: true })
            .eq('year_month', histMonth);
          return (count || 0) > 0;
        })
      );
      const historyAvailable = historyChecks.every(Boolean);
      const missingLabels = missing.map(m => format(m, 'MMM/yyyy'));

      return {
        valid: false,
        partial: true,
        historyAvailable,
        missingMonths: missingLabels,
        message: historyAvailable
          ? `Will auto-fill ${missingLabels.join(', ')} from history`
          : `Missing ${missingLabels.join(', ')} (no history fallback)`,
      } as ValidationStatus;
    },
    enabled: open,
  });

  // Check if all validations pass
  // Forecast is ok if fully valid OR partial with history available
  const forecastOk = forecastStatus?.valid || (forecastStatus?.partial && forecastStatus?.historyAvailable);

  const allValid = dateValid && 
    inventoryStatus?.valid && 
    historyStatus?.valid && 
    arrivalsStatus?.valid && 
    forecastOk;

  const handleRefreshAll = () => {
    refetchInventory();
    refetchHistory();
    refetchArrivals();
    refetchForecast();
  };

  const handleImportSuccess = () => {
    handleRefreshAll();
  };

  const [isRollingOver, setIsRollingOver] = useState(false);

  const handleRollover = async () => {
    // Auto-fill missing forecast months from history if needed
    if (forecastStatus?.partial && forecastStatus?.historyAvailable && forecastStatus?.missingMonths) {
      setIsRollingOver(true);
      try {
        for (let i = 0; i < 12; i++) {
          const month = addMonths(currentMonth, i);
          const monthKey = format(month, 'yyyy-MM-dd');
          
          // Check if this month has forecasts
          const { count } = await supabase
            .from('sales_forecasts')
            .select('id', { count: 'exact', head: true })
            .eq('year_month', monthKey);
          
          if ((count || 0) === 0) {
            // Fetch history from 12 months prior
            const histMonthKey = format(subMonths(month, 12), 'yyyy-MM-dd');
            const { data: historyRows } = await supabase
              .from('sales_history')
              .select('product_id, unit_id, quantity')
              .eq('year_month', histMonthKey);
            
            if (historyRows && historyRows.length > 0) {
              const inserts = historyRows.map(h => ({
                product_id: h.product_id,
                unit_id: h.unit_id,
                year_month: monthKey,
                quantity: h.quantity,
                version: 'auto-history',
              }));
              const { error } = await supabase.from('sales_forecasts').insert(inserts);
              if (error) throw error;
            }
          }
        }
        toast.success('Missing forecast months auto-filled from history');
      } catch (err) {
        console.error('Auto-fill error:', err);
        toast.error('Failed to auto-fill forecasts from history');
        setIsRollingOver(false);
        return;
      }
      setIsRollingOver(false);
    }

    onSuccess();
    onOpenChange(false);
  };

  const renderValidationRow = (
    icon: React.ReactNode,
    label: string,
    status: ValidationStatus | undefined,
    onUpload: () => void
  ) => (
    <div className="flex items-center justify-between py-2 border-b last:border-b-0">
      <div className="flex items-center gap-2">
        {status?.valid ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : (
          <XCircle className="h-5 w-5 text-destructive" />
        )}
        <span className="flex items-center gap-2">
          {icon}
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={status?.valid ? "default" : "destructive"} className="text-xs">
          {status?.message || 'Checking...'}
        </Badge>
        <Button variant="outline" size="sm" onClick={onUpload}>
          <Upload className="h-3.5 w-3.5 mr-1" />
          Upload
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Rollover Month
            </DialogTitle>
            <DialogDescription>
              Advance the 12-month planning window to the current month
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Period Display */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase mb-1">Current Period</p>
                <p className="font-semibold">{currentPeriodStart} → {currentPeriodEnd}</p>
              </div>
              <div className="bg-primary/10 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase mb-1">New Period</p>
                <p className="font-semibold text-primary">{newPeriodStart} → {newPeriodEnd}</p>
              </div>
            </div>

            {/* Date Validation */}
            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
              {dateValid ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              <Calendar className="h-4 w-4" />
              <span>Date Validation:</span>
              <Badge variant={dateValid ? "default" : "destructive"}>
                Today is {format(now, 'dd/MM/yyyy')} {dateValid ? '✓' : '(too early)'}
              </Badge>
            </div>

            {/* Required Uploads */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  Required Uploads
                </h4>
                <Button variant="ghost" size="sm" onClick={handleRefreshAll}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Refresh
                </Button>
              </div>
              <div className="border rounded-lg divide-y">
                {renderValidationRow(
                  <Package className="h-4 w-4" />,
                  'Inventory',
                  inventoryStatus,
                  () => setImportInventoryOpen(true)
                )}
                {renderValidationRow(
                  <FileSpreadsheet className="h-4 w-4" />,
                  `History (${closingMonth})`,
                  historyStatus,
                  () => setImportHistoryOpen(true)
                )}
                {renderValidationRow(
                  <Ship className="h-4 w-4" />,
                  'Arrivals',
                  arrivalsStatus,
                  () => setImportArrivalsOpen(true)
                )}
                {/* Custom forecast row with partial support */}
                <div className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div className="flex items-center gap-2">
                    {forecastStatus?.valid ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : forecastStatus?.partial && forecastStatus?.historyAvailable ? (
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                    <span className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Forecast
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={forecastStatus?.valid ? "default" : forecastStatus?.partial && forecastStatus?.historyAvailable ? "secondary" : "destructive"} 
                      className={`text-xs ${forecastStatus?.partial && forecastStatus?.historyAvailable ? 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400' : ''}`}
                    >
                      {forecastStatus?.message || 'Checking...'}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={() => setImportForecastOpen(true)}>
                      <Upload className="h-3.5 w-3.5 mr-1" />
                      Upload
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Alert */}
            {allValid && (
              <Alert className="bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-700 dark:text-green-400">Ready to Rollover</AlertTitle>
                <AlertDescription className="text-green-600 dark:text-green-500">
                  {forecastStatus?.partial 
                    ? `All data is in place. Missing forecast months (${forecastStatus.missingMonths?.join(', ')}) will be auto-filled from previous year history.`
                    : 'All required data is in place. You can proceed with the rollover.'}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleRollover} disabled={!allValid || isRollingOver}>
              {isRollingOver ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              {isRollingOver ? 'Auto-filling...' : 'Confirm Rollover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Modals */}
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
      <ImportForecastModal
        open={importForecastOpen}
        onOpenChange={setImportForecastOpen}
        onSuccess={handleImportSuccess}
      />
    </>
  );
};
