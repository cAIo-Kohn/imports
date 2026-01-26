import { useState } from 'react';
import { Plus, Search, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Units() {
  const [search, setSearch] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Units</h1>
          <p className="text-muted-foreground">Configure destination units in Brazil</p>
        </div>
        <Button>
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
          <CardDescription>No units registered yet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">No units found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Register destination units for products
            </p>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Register Unit
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
