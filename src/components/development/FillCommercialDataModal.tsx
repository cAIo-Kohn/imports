import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { sendTaskNotification } from '@/hooks/useCardTasks';
import type { CardTask } from '@/hooks/useCardTasks';
import { Upload, X, FileText, Image as ImageIcon, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { TimelineUploadButton, UploadedAttachment, ALLOWED_FORMATS_HINT } from './TimelineUploadButton';
import { useFileUpload } from '@/hooks/useFileUpload';
import { parseBrazilianNumber, formatBrazilianNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface FillCommercialDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: CardTask;
  cardTitle: string;
}

const CONTAINER_TYPES = [
  { value: '20ft', label: '20ft Container' },
  { value: '40ft', label: '40ft Container' },
  { value: '40hq', label: '40ft High Cube' },
];

const FIELD_LABELS: Record<string, string> = {
  fob_price_usd: 'FOB Price',
  moq: 'MOQ',
  qty_per_container: 'Qty/Container',
  container_type: 'Container Type',
  packing_type: 'Packing Type',
  qty_per_master_inner: 'Qty per Master/Inner',
};

export function FillCommercialDataModal({
  open,
  onOpenChange,
  task,
  cardTitle,
}: FillCommercialDataModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const packingFileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFiles, isUploading } = useFileUpload();
  
  const [fobPrice, setFobPrice] = useState('');
  const [moq, setMoq] = useState('');
  const [qtyPerContainer, setQtyPerContainer] = useState('');
  const [containerType, setContainerType] = useState('');
  const [packingType, setPackingType] = useState('');
  const [packingTypeFile, setPackingTypeFile] = useState<UploadedAttachment | null>(null);
  const [qtyPerMasterInner, setQtyPerMasterInner] = useState('');
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);

  // Get revision info from task metadata
  const taskMetadata = task.metadata || {};
  const fieldsToRevise = (taskMetadata.fields_to_revise || []) as string[];
  const preservedData = taskMetadata.preserved_data as Record<string, any> | undefined;
  const isRevision = taskMetadata.needs_revision === true;
  const rejectionReason = taskMetadata.rejection_reason as string | undefined;

  // Pre-populate preserved data on mount/open
  useEffect(() => {
    if (open && preservedData) {
      // Only pre-fill fields that are NOT flagged for revision
      if (!fieldsToRevise.includes('fob_price_usd') && preservedData.fob_price_usd != null) {
        setFobPrice(formatBrazilianNumber(preservedData.fob_price_usd, 2));
      }
      if (!fieldsToRevise.includes('moq') && preservedData.moq != null) {
        setMoq(formatBrazilianNumber(preservedData.moq, 0));
      }
      if (!fieldsToRevise.includes('qty_per_container') && preservedData.qty_per_container != null) {
        setQtyPerContainer(formatBrazilianNumber(preservedData.qty_per_container, 0));
      }
      if (!fieldsToRevise.includes('container_type') && preservedData.container_type) {
        setContainerType(preservedData.container_type);
      }
      if (!fieldsToRevise.includes('packing_type') && preservedData.packing_type) {
        setPackingType(preservedData.packing_type);
      }
      if (!fieldsToRevise.includes('packing_type') && preservedData.packing_type_file) {
        setPackingTypeFile(preservedData.packing_type_file);
      }
      if (!fieldsToRevise.includes('qty_per_master_inner') && preservedData.qty_per_master_inner) {
        setQtyPerMasterInner(preservedData.qty_per_master_inner);
      }
    }
  }, [open, preservedData, fieldsToRevise]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setFobPrice('');
      setMoq('');
      setQtyPerContainer('');
      setContainerType('');
      setPackingType('');
      setPackingTypeFile(null);
      setQtyPerMasterInner('');
      setAttachments([]);
    }
  }, [open]);

  // Format FOB price with comma as decimal separator (e.g., 1,50 for $1.50)
  const handleFobPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value;
    // Allow only digits and comma
    input = input.replace(/[^\d,]/g, '');
    // Ensure only one comma
    const parts = input.split(',');
    if (parts.length > 2) input = parts[0] + ',' + parts.slice(1).join('');
    // Limit decimal places to 2
    if (parts[1]?.length > 2) input = parts[0] + ',' + parts[1].slice(0, 2);
    // Format integer part with thousand separators
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const formatted = parts.length > 1 ? `${integerPart},${parts[1]}` : integerPart;
    setFobPrice(formatted);
  };

  // Format integer fields with dot as thousand separator (e.g., 10.000 for 10000)
  const handleIntegerChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    setter(formatted);
  };

  const hasManualData = fobPrice && moq && qtyPerContainer && containerType && 
                        packingType && packingTypeFile && qtyPerMasterInner;
  const hasFileUpload = attachments.length > 0;
  const isValid = hasManualData || hasFileUpload;

  const handlePackingFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: 'Invalid file type', description: 'Please upload an image or PDF', variant: 'destructive' });
      return;
    }

    const results = await uploadFiles([file]);
    if (results.length > 0) {
      setPackingTypeFile({
        id: results[0].id,
        name: results[0].name,
        url: results[0].url,
        type: results[0].type,
      });
    }
    // Reset input
    if (packingFileInputRef.current) {
      packingFileInputRef.current.value = '';
    }
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      const commercialData = {
        fob_price_usd: parseBrazilianNumber(fobPrice),
        moq: parseBrazilianNumber(moq),
        qty_per_container: parseBrazilianNumber(qtyPerContainer),
        container_type: containerType,
        packing_type: packingType || null,
        packing_type_file_url: packingTypeFile?.url || null,
        qty_per_master_inner: qtyPerMasterInner || null,
      };

      // Update the card with commercial data AND update workflow status to buyer
      const { error: cardError } = await supabase
        .from('development_items')
        .update({
          ...commercialData,
          workflow_status: 'commercial_filled',
          current_assignee_role: 'buyer',
        })
        .eq('id', task.card_id);

      if (cardError) throw cardError;
      
      // Log handoff to timeline
      await supabase.from('development_card_activity').insert({
        card_id: task.card_id,
        user_id: user.id,
        activity_type: 'handoff',
        content: 'Commercial data submitted - awaiting review',
        metadata: { 
          from_role: 'trader', 
          to_role: 'buyer', 
          workflow_status: 'commercial_filled' 
        },
      });

      // Get revision number from task metadata
      const taskMetadata = task.metadata || {};
      const revisionNumber = (taskMetadata.revision_number as number) || 1;
      const previousSubmissions = (taskMetadata.previous_submissions as Array<unknown>) || [];

      // Create a new commercial_review task for the requester to approve
      const { error: reviewTaskError } = await (supabase
        .from('development_card_tasks') as any)
        .insert({
          card_id: task.card_id,
          task_type: 'commercial_review',
          status: 'pending',
          assigned_to_users: [task.created_by], // Assign to original requester
          assigned_to_role: null,
          created_by: task.created_by, // Keep original requester as creator
          metadata: {
            ...commercialData,
            filled_by: user.id,
            filled_at: new Date().toISOString(),
            revision_number: revisionNumber,
            previous_submissions: previousSubmissions,
            attachments: attachments,
            packing_type_file: packingTypeFile,
            submission_type: hasManualData ? 'manual' : 'file_only',
          },
        });

      if (reviewTaskError) throw reviewTaskError;

      // Mark the original commercial_request task as completed
      const { error: taskError } = await supabase
        .from('development_card_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user.id,
          metadata: {
            ...taskMetadata,
            ...commercialData,
            filled_by: user.id,
            filled_at: new Date().toISOString(),
          },
        })
        .eq('id', task.id);

      if (taskError) throw taskError;

      // Log to timeline
      const timelineContent = hasManualData
        ? `💰 Commercial data submitted: $${fobPrice} FOB, MOQ ${moq}, ${qtyPerContainer}/${containerType}, Packing: ${packingType}${revisionNumber > 1 ? ` (Revision #${revisionNumber})` : ''}`
        : `📎 Commercial data submitted via file upload (${attachments.length} file${attachments.length > 1 ? 's' : ''})${revisionNumber > 1 ? ` (Revision #${revisionNumber})` : ''}`;

      await (supabase.from('development_card_activity') as any).insert({
        card_id: task.card_id,
        user_id: user.id,
        activity_type: 'message',
        content: timelineContent,
        metadata: { task_id: task.id, task_type: 'commercial_data_filled', ...commercialData, revision_number: revisionNumber, attachments },
      });

      // Notify the requester
      await sendTaskNotification({
        recipientUserIds: [task.created_by],
        triggeredBy: user.id,
        cardId: task.card_id,
        taskId: task.id,
        type: 'commercial_filled',
        title: '{name} submitted commercial data',
        content: `Commercial data for "${cardTitle}" is ready for your approval`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card-tasks', task.card_id] });
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', task.card_id] });
      toast({ title: 'Commercial data submitted' });
      onOpenChange(false);
      // Reset form
      setFobPrice('');
      setMoq('');
      setQtyPerContainer('');
      setContainerType('');
      setPackingType('');
      setPackingTypeFile(null);
      setQtyPerMasterInner('');
      setAttachments([]);
    },
    onError: (error: Error & { details?: string }) => {
      console.error('Failed to fill commercial data:', error);
      const errorMessage = error.message || 'Failed to submit commercial data';
      const details = error.details ? `: ${error.details}` : '';
      toast({
        title: 'Error',
        description: `${errorMessage}${details}`,
        variant: 'destructive',
      });
    },
  });

  const requesterName = task.created_by_profile?.full_name || 'the requester';
  const productNames = (task.metadata?.product_names as string[]) || [];
  const isAllProducts = task.metadata?.is_all_products as boolean;

  // Build product description
  const productDescription = productNames.length > 0
    ? isAllProducts
      ? 'for all items in this group'
      : `for: ${productNames.join(', ')}`
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fill Commercial Data</DialogTitle>
          <DialogDescription>
            {productDescription && (
              <span className="block text-xs font-medium mb-1">📦 {productDescription}</span>
            )}
            Fill all 6 fields OR upload a document. {requesterName} will be notified to review.
          </DialogDescription>
        </DialogHeader>

        {/* Revision alert */}
        {isRevision && rejectionReason && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg mb-4">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200">Revision requested</p>
              <p className="text-amber-700 dark:text-amber-300 mt-1">{rejectionReason}</p>
              {fieldsToRevise.length > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  Fields to update: {fieldsToRevise.map(f => FIELD_LABELS[f] || f).join(', ')}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="fob-price" className={cn(fieldsToRevise.includes('fob_price_usd') && "text-amber-600 dark:text-amber-400")}>
              FOB Price (USD) * {fieldsToRevise.includes('fob_price_usd') && '⚠️'}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="fob-price"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={fobPrice}
                onChange={handleFobPriceChange}
                className={cn("pl-7", fieldsToRevise.includes('fob_price_usd') && "border-amber-400 focus-visible:ring-amber-400")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="moq" className={cn(fieldsToRevise.includes('moq') && "text-amber-600 dark:text-amber-400")}>
              MOQ * {fieldsToRevise.includes('moq') && '⚠️'}
            </Label>
            <Input
              id="moq"
              type="text"
              inputMode="numeric"
              placeholder="1.000"
              value={moq}
              onChange={handleIntegerChange(setMoq)}
              className={cn(fieldsToRevise.includes('moq') && "border-amber-400 focus-visible:ring-amber-400")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="qty-container" className={cn(fieldsToRevise.includes('qty_per_container') && "text-amber-600 dark:text-amber-400")}>
              Qty / Container * {fieldsToRevise.includes('qty_per_container') && '⚠️'}
            </Label>
            <Input
              id="qty-container"
              type="text"
              inputMode="numeric"
              placeholder="50.000"
              value={qtyPerContainer}
              onChange={handleIntegerChange(setQtyPerContainer)}
              className={cn(fieldsToRevise.includes('qty_per_container') && "border-amber-400 focus-visible:ring-amber-400")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="container-type" className={cn(fieldsToRevise.includes('container_type') && "text-amber-600 dark:text-amber-400")}>
              Container Type * {fieldsToRevise.includes('container_type') && '⚠️'}
            </Label>
            <Select value={containerType} onValueChange={setContainerType}>
              <SelectTrigger id="container-type" className={cn(fieldsToRevise.includes('container_type') && "border-amber-400 focus-visible:ring-amber-400")}>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {CONTAINER_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qty-master-inner" className={cn(fieldsToRevise.includes('qty_per_master_inner') && "text-amber-600 dark:text-amber-400")}>
              Qty per Master/Inner * {fieldsToRevise.includes('qty_per_master_inner') && '⚠️'}
            </Label>
            <Input
              id="qty-master-inner"
              type="text"
              placeholder="e.g. 12/6"
              value={qtyPerMasterInner}
              onChange={(e) => setQtyPerMasterInner(e.target.value)}
              className={cn(fieldsToRevise.includes('qty_per_master_inner') && "border-amber-400 focus-visible:ring-amber-400")}
            />
          </div>

          <div className="space-y-2 col-span-2">
            <Label htmlFor="packing-type" className={cn(fieldsToRevise.includes('packing_type') && "text-amber-600 dark:text-amber-400")}>
              Packing Type * {fieldsToRevise.includes('packing_type') && '⚠️'}
            </Label>
            <div className="flex gap-2">
              <Input
                id="packing-type"
                type="text"
                placeholder="e.g. Carton box, Blister pack"
                value={packingType}
                onChange={(e) => setPackingType(e.target.value)}
                className={cn("flex-1", fieldsToRevise.includes('packing_type') && "border-amber-400 focus-visible:ring-amber-400")}
              />
              <input
                ref={packingFileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handlePackingFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => packingFileInputRef.current?.click()}
                disabled={isUploading}
                title="Upload packing image/PDF"
              >
                <Upload className="h-4 w-4" />
              </Button>
            </div>
            {packingTypeFile && (
              <div className="flex items-center gap-2 mt-1 p-2 bg-muted rounded text-xs">
                {packingTypeFile.type?.startsWith('image/') ? (
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <FileText className="h-4 w-4 text-muted-foreground" />
                )}
                <a 
                  href={packingTypeFile.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="truncate hover:underline flex-1"
                >
                  {packingTypeFile.name}
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => setPackingTypeFile(null)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            {!packingTypeFile && (
              <p className="text-[10px] text-muted-foreground">Upload an image or PDF showing the packing</p>
            )}
          </div>
        </div>

        {/* File Upload Alternative */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or upload a document</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          
          <div className="flex items-center gap-2">
            <TimelineUploadButton
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              variant="button"
            />
            <span className="text-xs text-muted-foreground">({ALLOWED_FORMATS_HINT})</span>
          </div>
          
          {hasFileUpload && !hasManualData && (
            <p className="text-xs text-muted-foreground">
              File uploaded — you can submit without filling the fields above.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => submitMutation.mutate()} 
            disabled={!isValid || submitMutation.isPending || isUploading}
          >
            {submitMutation.isPending ? 'Submitting...' : 'Confirm & Notify Requester'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
