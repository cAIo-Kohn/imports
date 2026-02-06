import { useState } from 'react';
import { Package, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { APPROVAL_CONFIG, type NewProductApproval, type ApprovalType } from '@/hooks/useNewProductFlow';
import { ResearchApprovalDrawer } from './ResearchApprovalDrawer';

interface Step1Item {
  id: string;
  title: string;
  image_url: string | null;
  product_code: string | null;
}

interface Step1ResearchSectionProps {
  items: Step1Item[];
  approvals: NewProductApproval[];
  onOpenCard: (cardId: string) => void;
}

const APPROVAL_TYPES: ApprovalType[] = ['market_research', 'trademark_patent', 'customs_research'];

function ApprovalStatusBadge({ status }: { status: string }) {
  if (status === 'approved') {
    return (
      <Badge variant="secondary" className="text-[10px] border-green-300 bg-green-100/50 dark:bg-green-900/30">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Approved
      </Badge>
    );
  }
  if (status === 'rejected') {
    return (
      <Badge variant="destructive" className="text-[10px]">
        <XCircle className="h-3 w-3 mr-1" />
        Rejected
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px]">
      <Clock className="h-3 w-3 mr-1" />
      Pending
    </Badge>
  );
}

function ProductMiniCard({ 
  item, 
  approval,
  approvalType,
  onClick 
}: { 
  item: Step1Item; 
  approval: NewProductApproval | undefined;
  approvalType: ApprovalType;
  onClick: () => void;
}) {
  return (
    <Card 
      className="cursor-pointer hover:shadow-sm transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <Package className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{item.title}</p>
            <ApprovalStatusBadge status={approval?.status || 'pending'} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function Step1ResearchSection({ items, approvals, onOpenCard }: Step1ResearchSectionProps) {
  const [drawerState, setDrawerState] = useState<{
    open: boolean;
    cardId: string;
    cardTitle: string;
    cardImageUrl: string | null;
    approvalType: ApprovalType;
    approval: NewProductApproval | undefined;
  } | null>(null);

  if (items.length === 0) return null;

  // Group approvals by type
  const getApprovalsForType = (type: ApprovalType) => {
    return approvals.filter(a => a.approval_type === type);
  };

  const handleOpenResearchDrawer = (item: Step1Item, type: ApprovalType, approval: NewProductApproval | undefined) => {
    setDrawerState({
      open: true,
      cardId: item.id,
      cardTitle: item.title,
      cardImageUrl: item.image_url,
      approvalType: type,
      approval,
    });
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Step 1: Research & Compliance</h3>
          <Badge variant="outline" className="text-xs">
            {items.length} product{items.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        
        <p className="text-xs text-muted-foreground">
          Three departments review in parallel. All must approve before proceeding.
        </p>

        {/* 3-column layout for parallel approvals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {APPROVAL_TYPES.map(type => {
            const config = APPROVAL_CONFIG[type];
            const typeApprovals = getApprovalsForType(type);
            
            return (
              <div
                key={type}
                className={cn(
                  "rounded-lg border p-3",
                  type === 'market_research' && "border-purple-200 bg-purple-50/30 dark:bg-purple-950/20",
                  type === 'trademark_patent' && "border-green-200 bg-green-50/30 dark:bg-green-950/20",
                  type === 'customs_research' && "border-blue-200 bg-blue-50/30 dark:bg-blue-950/20"
                )}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{config.icon}</span>
                  <div>
                    <p className="text-xs font-semibold">{config.labelPt}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {config.role}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {items.map(item => {
                    const approval = typeApprovals.find(a => a.card_id === item.id);
                    return (
                      <ProductMiniCard
                        key={item.id}
                        item={item}
                        approval={approval}
                        approvalType={type}
                        onClick={() => handleOpenResearchDrawer(item, type, approval)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Research Approval Drawer */}
      {drawerState && (
        <ResearchApprovalDrawer
          open={drawerState.open}
          onOpenChange={(open) => {
            if (!open) setDrawerState(null);
          }}
          cardId={drawerState.cardId}
          cardTitle={drawerState.cardTitle}
          cardImageUrl={drawerState.cardImageUrl}
          approvalType={drawerState.approvalType}
          approval={drawerState.approval}
          onOpenOriginalCard={() => {
            setDrawerState(null);
            onOpenCard(drawerState.cardId);
          }}
        />
      )}
    </>
  );
}
