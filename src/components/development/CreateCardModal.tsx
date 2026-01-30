import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole, AppRole } from '@/hooks/useUserRole';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { DevelopmentItemPriority, DevelopmentCardType, DevelopmentProductCategory } from '@/pages/Development';
import { Package, ListTodo, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ImageUpload } from './ImageUpload';
import { ThreadAssignmentSelect } from './ThreadAssignmentSelect';

interface AssignedUser {
  id: string;
  name: string;
  email: string;
}

interface CreateCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface GroupProduct {
  productCode: string;
  productName: string;
  notes: string;
}

export function CreateCardModal({ open, onOpenChange }: CreateCardModalProps) {
  const { user } = useAuth();
  const { isBuyer, isTrader } = useUserRole();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<'item' | 'task'>('item');
  
  // Item form state
  const [itemMode, setItemMode] = useState<'individual' | 'group'>('individual');
  const [productCategory, setProductCategory] = useState<DevelopmentProductCategory | ''>('');
  const [title, setTitle] = useState('');
  const [desiredOutcome, setDesiredOutcome] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [priority, setPriority] = useState<DevelopmentItemPriority>('medium');
  const [productCode, setProductCode] = useState('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [dueDate, setDueDate] = useState('');
  
  // Group products state
  const [groupProducts, setGroupProducts] = useState<GroupProduct[]>([]);
  const [newProductCode, setNewProductCode] = useState('');
  const [newProductName, setNewProductName] = useState('');
  
  // Assignment state - required for every card
  const [assignedUsers, setAssignedUsers] = useState<AssignedUser[]>([]);
  const [assignedRole, setAssignedRole] = useState<AppRole | null>(null);

  // Determine user's role for cross-team notification
  const createdByRole = isTrader ? 'trader' : 'buyer';

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, company_name')
        .eq('is_active', true)
        .order('company_name');
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const cardType: DevelopmentCardType = activeTab === 'task' 
        ? 'task' 
        : itemMode === 'group' 
          ? 'item_group' 
          : 'item';

      // Create the main card with assignment columns
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: card, error } = await (supabase
        .from('development_items') as any)
        .insert({
          title,
          description: desiredOutcome || null,
          image_url: imageUrl,
          priority,
          item_type: 'new_item',
          card_type: cardType,
          product_category: activeTab === 'item' ? productCategory || null : null,
          product_code: itemMode === 'individual' ? productCode || null : null,
          supplier_id: activeTab === 'item' ? (supplierId || null) : null,
          due_date: dueDate || null,
          created_by: user?.id,
          created_by_role: createdByRole,
          is_new_for_other_team: true,
          current_owner: 'arc', // Legacy - kept for compatibility
          status: 'backlog',
          is_solved: false,
          // New assignment columns
          assigned_to_users: assignedUsers.map(u => u.id),
          assigned_to_role: assignedRole,
        })
        .select()
        .single();

      if (error) throw error;

      // If it's a group, add the child products
      if (cardType === 'item_group' && groupProducts.length > 0) {
        const productsToInsert = groupProducts.map(p => ({
          card_id: card.id,
          product_code: p.productCode,
          product_name: p.productName || null,
          notes: p.notes || null,
          created_by: user?.id,
        }));

        const { error: productsError } = await supabase
          .from('development_card_products')
          .insert(productsToInsert);

        if (productsError) throw productsError;
      }

      // Create the "original thread" activity - this auto-creates the main thread for the card
      const { data: activityData, error: activityError } = await supabase.from('development_card_activity').insert({
        card_id: card.id,
        user_id: user?.id,
        activity_type: 'card_created',
        content: desiredOutcome || `Created: ${title}`,
        thread_title: title,
        metadata: { 
          card_type: cardType,
          assigned_user_names: assignedUsers.map(u => u.name),
          assigned_role: assignedRole,
        },
        // Thread assignment - matches card assignment
        assigned_to_users: assignedUsers.map(u => u.id),
        assigned_to_role: assignedRole,
        thread_creator_id: user?.id,
        thread_status: 'open',
      }).select('id').single();

      if (activityError) throw activityError;

      // Set thread_id and thread_root_id to itself (new thread root)
      if (activityData?.id) {
        await supabase.from('development_card_activity')
          .update({ thread_id: activityData.id, thread_root_id: activityData.id })
          .eq('id', activityData.id);
      }

      return card;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      toast({
        title: 'Success',
        description: 'Card created successfully',
      });
      resetForm();
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create card',
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setActiveTab('item');
    setItemMode('individual');
    setProductCategory('');
    setTitle('');
    setDesiredOutcome('');
    setImageUrl(null);
    setPriority('medium');
    setProductCode('');
    setSupplierId('');
    setDueDate('');
    setGroupProducts([]);
    setNewProductCode('');
    setNewProductName('');
    setAssignedUsers([]);
    setAssignedRole(null);
  };

  const handleAddProduct = () => {
    if (!newProductCode.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Product code is required',
        variant: 'destructive',
      });
      return;
    }

    setGroupProducts([
      ...groupProducts,
      {
        productCode: newProductCode.trim(),
        productName: newProductName.trim(),
        notes: '',
      },
    ]);
    setNewProductCode('');
    setNewProductName('');
  };

  const handleRemoveProduct = (index: number) => {
    setGroupProducts(groupProducts.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Title is required',
        variant: 'destructive',
      });
      return;
    }

    // Desired outcome is required for items (not tasks)
    if (activeTab === 'item' && !desiredOutcome.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Desired Outcome is required',
        variant: 'destructive',
      });
      return;
    }

    // Product category is mandatory for items (not tasks)
    if (activeTab === 'item' && !productCategory) {
      toast({
        title: 'Validation Error',
        description: 'Please select whether this is a Final Product or Raw Material',
        variant: 'destructive',
      });
      return;
    }

    if (activeTab === 'item' && itemMode === 'group' && groupProducts.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Add at least one product to the group',
        variant: 'destructive',
      });
      return;
    }

    // Assignment is required
    if (assignedUsers.length === 0 && !assignedRole) {
      toast({
        title: 'Validation Error',
        description: 'Please assign this card to a user or department',
        variant: 'destructive',
      });
      return;
    }

    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Card</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'item' | 'task')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="item" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              New Item(s)
            </TabsTrigger>
            <TabsTrigger value="task" className="flex items-center gap-2">
              <ListTodo className="h-4 w-4" />
              New Task
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {/* Item Tab */}
            <TabsContent value="item" className="space-y-4 mt-0">
              {/* Product Category Selection - MANDATORY */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Product Category <span className="text-destructive">*</span>
                </Label>
                <RadioGroup
                  value={productCategory}
                  onValueChange={(v) => setProductCategory(v as DevelopmentProductCategory)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="final_product" id="final_product" />
                    <Label htmlFor="final_product" className="cursor-pointer">
                      Final Product
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="raw_material" id="raw_material" />
                    <Label htmlFor="raw_material" className="cursor-pointer">
                      Raw Material
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Individual vs Group Selection */}
              <div className="space-y-2">
                <Label>Item Type</Label>
                <RadioGroup
                  value={itemMode}
                  onValueChange={(v) => setItemMode(v as 'individual' | 'group')}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="individual" id="individual" />
                    <Label htmlFor="individual" className="cursor-pointer">
                      Individual Item
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="group" id="group" />
                    <Label htmlFor="group" className="cursor-pointer">
                      Group of Items
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">
                  {itemMode === 'group' ? 'Group Name *' : 'Title *'}
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={itemMode === 'group' ? 'e.g., Pet Products Line 2024' : 'Enter item title'}
                />
              </div>

              {/* Individual: Product Code */}
              {itemMode === 'individual' && (
                <div className="space-y-2">
                  <Label htmlFor="productCode">Product Code</Label>
                  <Input
                    id="productCode"
                    value={productCode}
                    onChange={(e) => setProductCode(e.target.value)}
                    placeholder="e.g., 12345"
                  />
                </div>
              )}

              {/* Group: Add Products */}
              {itemMode === 'group' && (
                <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                  <Label>Products in this Group</Label>
                  
                  {/* List of added products */}
                  {groupProducts.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {groupProducts.map((p, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="flex items-center gap-1 py-1"
                        >
                          <span className="font-mono">{p.productCode}</span>
                          {p.productName && (
                            <span className="text-muted-foreground">- {p.productName}</span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveProduct(idx)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Add product form */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Product Code"
                      value={newProductCode}
                      onChange={(e) => setNewProductCode(e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Name (optional)"
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleAddProduct}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Picture Upload */}
              <div className="space-y-2">
                <Label>Picture</Label>
                <ImageUpload
                  value={imageUrl}
                  onChange={setImageUrl}
                  folder="cards"
                />
              </div>

              {/* Desired Outcome - Required for items */}
              <div className="space-y-2">
                <Label htmlFor="desiredOutcome">
                  Desired Outcome <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="desiredOutcome"
                  value={desiredOutcome}
                  onChange={(e) => setDesiredOutcome(e.target.value)}
                  placeholder="What is the expected outcome? e.g., Develop a new supplier in China for this item"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Supplier</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Assignment - Required */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Assign to <span className="text-destructive">*</span>
                </Label>
                <ThreadAssignmentSelect
                  assignedUsers={assignedUsers}
                  assignedRole={assignedRole}
                  onAssignedUsersChange={setAssignedUsers}
                  onAssignedRoleChange={setAssignedRole}
                  required
                />
              </div>
            </TabsContent>

            {/* Task Tab */}
            <TabsContent value="task" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label htmlFor="taskTitle">Task Title *</Label>
                <Input
                  id="taskTitle"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What needs to be done?"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taskDescription">Description</Label>
                <Textarea
                  id="taskDescription"
                  value={desiredOutcome}
                  onChange={(e) => setDesiredOutcome(e.target.value)}
                  placeholder="Enter description"
                  rows={3}
                />
              </div>
              
              {/* Assignment - Required for tasks too */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Assign to <span className="text-destructive">*</span>
                </Label>
                <ThreadAssignmentSelect
                  assignedUsers={assignedUsers}
                  assignedRole={assignedRole}
                  onAssignedUsersChange={setAssignedUsers}
                  onAssignedRoleChange={setAssignedRole}
                  required
                />
              </div>
            </TabsContent>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as DevelopmentItemPriority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Card'}
              </Button>
            </div>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
