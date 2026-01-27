-- Add estabelecimento_code column
ALTER TABLE public.units 
ADD COLUMN estabelecimento_code integer;

-- Add unique constraint
ALTER TABLE public.units
ADD CONSTRAINT units_estabelecimento_code_unique UNIQUE (estabelecimento_code);

-- Populate existing units with known codes
UPDATE public.units SET estabelecimento_code = 1 WHERE name = 'Matriz';
UPDATE public.units SET estabelecimento_code = 9 WHERE name = 'Filial Pernambuco';
UPDATE public.units SET estabelecimento_code = 10 WHERE name = 'Filial Rio de Janeiro';