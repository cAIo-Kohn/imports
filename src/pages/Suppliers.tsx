import { useState } from 'react';
import { Plus, Search, Factory } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Suppliers() {
  const [search, setSearch] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fornecedores</h1>
          <p className="text-muted-foreground">Gerencie seus fornecedores internacionais</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Fornecedor
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar fornecedores..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Fornecedores</CardTitle>
          <CardDescription>Nenhum fornecedor cadastrado ainda</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Factory className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">Nenhum fornecedor encontrado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Comece cadastrando seu primeiro fornecedor
            </p>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar Fornecedor
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
