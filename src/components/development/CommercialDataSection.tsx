import { DollarSign, Package, FileText, Image as ImageIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CommercialHistoryTimeline } from './CommercialHistoryTimeline';

interface CommercialDataSectionProps {
  cardId: string;
  cardTitle: string;
  fobPriceUsd: number | null;
  moq: number | null;
  qtyPerContainer: number | null;
  containerType: string | null;
  packingType?: string | null;
  packingTypeFileUrl?: string | null;
  qtyPerMasterInner?: string | null;
  currentOwner: 'mor' | 'arc';
  canEdit: boolean;
  onRequestCommercialData?: () => void;
}

const CONTAINER_LABELS: Record<string, string> = {
  '20ft': '20ft Container',
  '40ft': '40ft Container',
  '40hq': '40ft High Cube',
};

export function CommercialDataSection({
  cardId,
  cardTitle,
  fobPriceUsd,
  moq,
  qtyPerContainer,
  containerType,
  packingType,
  packingTypeFileUrl,
  qtyPerMasterInner,
  currentOwner,
  canEdit,
  onRequestCommercialData,
}: CommercialDataSectionProps) {
  const hasData = fobPriceUsd || moq || qtyPerContainer || containerType || packingType || qtyPerMasterInner;
  const isComplete = fobPriceUsd && moq && qtyPerContainer && containerType && packingType && packingTypeFileUrl && qtyPerMasterInner;

  // Determine if the file is an image based on extension
  const isPackingFileImage = packingTypeFileUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(packingTypeFileUrl);

  return (
    <div className="space-y-3">
      {/* Current Data Display */}
      {hasData ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">FOB Price (USD)</p>
              <p className="text-sm font-medium">
                {fobPriceUsd ? `$${fobPriceUsd.toFixed(2)}` : '—'}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Package className="h-3 w-3" />
                MOQ
              </p>
              <p className="text-sm font-medium">
                {moq ? moq.toLocaleString() : '—'}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Qty / Container</p>
              <p className="text-sm font-medium">
                {qtyPerContainer ? qtyPerContainer.toLocaleString() : '—'}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Container Type</p>
              <p className="text-sm font-medium">
                {containerType ? CONTAINER_LABELS[containerType] || containerType : '—'}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Qty per Master/Inner</p>
              <p className="text-sm font-medium">
                {qtyPerMasterInner || '—'}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Packing Type</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">
                  {packingType || '—'}
                </p>
                {packingTypeFileUrl && (
                  <a
                    href={packingTypeFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                    title="View packing file"
                  >
                    {isPackingFileImage ? (
                      <ImageIcon className="h-3 w-3" />
                    ) : (
                      <FileText className="h-3 w-3" />
                    )}
                    <span>View</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Show request button if data is incomplete */}
          {!isComplete && onRequestCommercialData && (
            <div className="pt-2 border-t">
              <Button variant="outline" size="sm" onClick={onRequestCommercialData} className="w-full">
                Request Missing Data
              </Button>
            </div>
          )}

          {/* Completion badge */}
          {isComplete && (
            <div className="pt-2 border-t">
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                ✓ Commercial data complete
              </Badge>
            </div>
          )}
        </>
      ) : (
        /* No data yet - show request button */
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <DollarSign className="h-8 w-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground mb-3">
            No commercial data available
          </p>
          {onRequestCommercialData && (
            <Button variant="outline" size="sm" onClick={onRequestCommercialData}>
              Request Commercial Data
            </Button>
          )}
        </div>
      )}

      {/* Negotiation History Timeline */}
      <CommercialHistoryTimeline cardId={cardId} />
    </div>
  );
}
