import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, AlertTriangle, Truck, Package, CheckCircle } from 'lucide-react';
import { SampleTrackerCard, SampleWithCard } from './SampleTrackerCard';
import { cn } from '@/lib/utils';
import { isPast, parseISO } from 'date-fns';

interface SampleTrackerViewProps {
  onOpenCard: (cardId: string) => void;
}

type StatusFilter = 'all' | 'requested' | 'inTransit' | 'delivered' | 'reviewed';
type CourierFilter = 'all' | 'DHL' | 'FedEx' | 'TNT' | 'UPS' | 'SF Express' | 'other';
type DecisionFilter = 'all' | 'approved' | 'rejected' | 'pending';
type ReportFilter = 'all' | 'yes' | 'no';

export function SampleTrackerView({ onOpenCard }: SampleTrackerViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [courierFilter, setCourierFilter] = useState<CourierFilter>('all');
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>('all');
  const [reportFilter, setReportFilter] = useState<ReportFilter>('all');

  // Fetch all samples with their parent card info
  const { data: samples = [], isLoading } = useQuery({
    queryKey: ['all-samples'],
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('development_item_samples')
        .select(`
          *,
          card:development_items!item_id (
            id, title, current_owner, is_solved, deleted_at, image_url
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Filter out samples from deleted cards
      return (data as SampleWithCard[]).filter(s => s.card && !s.card.deleted_at);
    },
  });

  // Apply filters
  const filteredSamples = useMemo(() => {
    return samples.filter(sample => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesTitle = sample.card?.title.toLowerCase().includes(search);
        const matchesTracking = sample.tracking_number?.toLowerCase().includes(search);
        const matchesCourier = sample.courier_name?.toLowerCase().includes(search);
        if (!matchesTitle && !matchesTracking && !matchesCourier) return false;
      }

      // Courier filter
      if (courierFilter !== 'all') {
        if (courierFilter === 'other') {
          const knownCouriers = ['DHL', 'FedEx', 'TNT', 'UPS', 'SF Express'];
          if (sample.courier_name && knownCouriers.includes(sample.courier_name)) return false;
        } else {
          if (sample.courier_name !== courierFilter) return false;
        }
      }

      // Decision filter
      if (decisionFilter !== 'all') {
        if (decisionFilter === 'pending' && sample.decision) return false;
        if (decisionFilter !== 'pending' && sample.decision !== decisionFilter) return false;
      }

      // Report filter
      if (reportFilter !== 'all') {
        const hasReport = !!sample.report_url;
        if (reportFilter === 'yes' && !hasReport) return false;
        if (reportFilter === 'no' && hasReport) return false;
      }

      return true;
    });
  }, [samples, searchTerm, courierFilter, decisionFilter, reportFilter]);

  // Group samples by category
  const grouped = useMemo(() => {
    const result = {
      requested: [] as SampleWithCard[],
      inTransit: [] as SampleWithCard[],
      delivered: [] as SampleWithCard[],
      reviewed: [] as SampleWithCard[],
    };

    filteredSamples.forEach(sample => {
      if (sample.decision) {
        result.reviewed.push(sample);
      } else if (sample.status === 'delivered' || sample.actual_arrival) {
        result.delivered.push(sample);
      } else if (sample.status === 'in_transit' || sample.tracking_number) {
        result.inTransit.push(sample);
      } else {
        result.requested.push(sample);
      }
    });

    return result;
  }, [filteredSamples]);

  // Apply status filter to show only specific column
  const visibleColumns = useMemo(() => {
    if (statusFilter === 'all') {
      return ['requested', 'inTransit', 'delivered', 'reviewed'] as const;
    }
    return [statusFilter] as const;
  }, [statusFilter]);

  // Count overdue samples
  const overdueCount = useMemo(() => {
    return [...grouped.requested, ...grouped.inTransit].filter(s => 
      s.estimated_arrival && 
      s.status !== 'delivered' && 
      !s.actual_arrival &&
      isPast(parseISO(s.estimated_arrival))
    ).length;
  }, [grouped]);

  if (isLoading) {
    return (
      <div className="flex gap-4 h-full p-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex-1 min-w-[250px]">
            <Skeleton className="h-10 w-full mb-4" />
            <Skeleton className="h-32 w-full mb-2" />
            <Skeleton className="h-32 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="flex-shrink-0 flex flex-wrap gap-3 p-4 border-b bg-background">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by card, tracking, courier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="requested">Requested</SelectItem>
            <SelectItem value="inTransit">In Transit</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={courierFilter} onValueChange={(v) => setCourierFilter(v as CourierFilter)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Courier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Couriers</SelectItem>
            <SelectItem value="DHL">DHL</SelectItem>
            <SelectItem value="FedEx">FedEx</SelectItem>
            <SelectItem value="TNT">TNT</SelectItem>
            <SelectItem value="UPS">UPS</SelectItem>
            <SelectItem value="SF Express">SF Express</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>

        <Select value={decisionFilter} onValueChange={(v) => setDecisionFilter(v as DecisionFilter)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Decision" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Decisions</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>

        <Select value={reportFilter} onValueChange={(v) => setReportFilter(v as ReportFilter)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Report" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Reports</SelectItem>
            <SelectItem value="yes">Has Report</SelectItem>
            <SelectItem value="no">No Report</SelectItem>
          </SelectContent>
        </Select>

        {overdueCount > 0 && (
          <div className="flex items-center gap-1 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>{overdueCount} overdue</span>
          </div>
        )}
      </div>

      {/* Kanban Columns */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 h-full min-w-max">
          {visibleColumns.includes('requested') && (
            <SampleColumn
              title="Requested"
              icon={<AlertTriangle className="h-4 w-4" />}
              samples={grouped.requested}
              category="requested"
              colorClass="border-amber-300 bg-amber-50/30"
              onOpenCard={onOpenCard}
            />
          )}
          {visibleColumns.includes('inTransit') && (
            <SampleColumn
              title="In Transit"
              icon={<Truck className="h-4 w-4" />}
              samples={grouped.inTransit}
              category="inTransit"
              colorClass="border-blue-300 bg-blue-50/30"
              onOpenCard={onOpenCard}
            />
          )}
          {visibleColumns.includes('delivered') && (
            <SampleColumn
              title="Delivered"
              icon={<Package className="h-4 w-4" />}
              samples={grouped.delivered}
              category="delivered"
              colorClass="border-purple-300 bg-purple-50/30"
              onOpenCard={onOpenCard}
            />
          )}
          {visibleColumns.includes('reviewed') && (
            <SampleColumn
              title="Reviewed"
              icon={<CheckCircle className="h-4 w-4" />}
              samples={grouped.reviewed}
              category="reviewed"
              colorClass="border-green-300 bg-green-50/30"
              onOpenCard={onOpenCard}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface SampleColumnProps {
  title: string;
  icon: React.ReactNode;
  samples: SampleWithCard[];
  category: 'requested' | 'inTransit' | 'delivered' | 'reviewed';
  colorClass: string;
  onOpenCard: (cardId: string) => void;
}

function SampleColumn({ title, icon, samples, category, colorClass, onOpenCard }: SampleColumnProps) {
  return (
    <div className={cn(
      "flex flex-col w-[280px] min-w-[280px] rounded-lg border-2",
      colorClass
    )}>
      {/* Column Header */}
      <div className="flex items-center gap-2 p-3 border-b">
        {icon}
        <h3 className="font-semibold text-sm">{title}</h3>
        <span className="ml-auto text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full">
          {samples.length}
        </span>
      </div>

      {/* Column Content */}
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2">
          {samples.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              No samples
            </div>
          ) : (
            samples.map(sample => (
              <SampleTrackerCard
                key={sample.id}
                sample={sample}
                category={category}
                onOpenCard={onOpenCard}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
