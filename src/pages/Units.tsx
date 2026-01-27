import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Building2, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateUnitModal } from '@/components/units/CreateUnitModal';
import { EditUnitModal } from '@/components/units/EditUnitModal';
import { DeleteUnitDialog } from '@/components/units/DeleteUnitDialog';

interface Unit {
  id: string;
  name: string;
  estabelecimento_code: number | null;
  cnpj: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  phone: string | null;
  fax: string | null;
  responsible_name: string | null;
  responsible_email: string | null;
  responsible_phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function Units() {
  const [search, setSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

  const { data: units, isLoading } = useQuery({
    queryKey: ['units', search],
    queryFn: async () => {
      let query = supabase
        .from('units')
        .select('*')
        .order('name');

      if (search) {
        query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%,state.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Unit[];
    },
  });

  const { data: productCounts } = useQuery({
    queryKey: ['unit-product-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_units')
        .select('unit_id');

      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const pu of data || []) {
        counts[pu.unit_id] = (counts[pu.unit_id] || 0) + 1;
      }
      return counts;
    },
  });

  const handleEdit = (unit: Unit) => {
    setSelectedUnit(unit);
    setEditModalOpen(true);
  };

  const handleDelete = (unit: Unit) => {
    setSelectedUnit(unit);
    setDeleteDialogOpen(true);
  };

  const formatLocation = (city: string | null, state: string | null) => {
    if (city && state) return `${city}, ${state}`;
    if (city) return city;
    if (state) return state;
    return '-';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Units</h1>
          <p className="text-muted-foreground">Configure destination units in Brazil</p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Unit
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search units..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Unit List</CardTitle>
          <CardDescription>
            {units?.length
              ? `${units.length} unit${units.length > 1 ? 's' : ''} registered`
              : 'No units registered yet'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : units && units.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Establishment Code</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-center">Products</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell className="font-medium">{unit.name}</TableCell>
                    <TableCell>
                      {unit.estabelecimento_code ? (
                        <Badge variant="outline">{unit.estabelecimento_code}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{formatLocation(unit.city, unit.state)}</TableCell>
                    <TableCell>
                      {unit.responsible_name ? (
                        <div className="text-sm">
                          <p>{unit.responsible_name}</p>
                          {unit.responsible_email && (
                            <p className="text-muted-foreground">{unit.responsible_email}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {productCounts?.[unit.id] || 0}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={unit.is_active ? 'default' : 'secondary'}>
                        {unit.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(unit)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(unit)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">No units found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Register destination units for products
              </p>
              <Button onClick={() => setCreateModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Register Unit
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateUnitModal open={createModalOpen} onOpenChange={setCreateModalOpen} />
      <EditUnitModal open={editModalOpen} onOpenChange={setEditModalOpen} unit={selectedUnit} />
      <DeleteUnitDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} unit={selectedUnit} />
    </div>
  );
}
