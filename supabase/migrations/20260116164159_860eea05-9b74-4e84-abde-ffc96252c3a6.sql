-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'buyer', 'viewer');

-- Create enum for unit of measure
CREATE TYPE public.unit_of_measure AS ENUM ('pcs', 'kg', 'g', 'l', 'ml', 'm', 'cm', 'box', 'set', 'pair');

-- Create user_roles table for secure role management
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT,
    email TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create units table (destination units in Brazil)
CREATE TABLE public.units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    cnpj TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    responsible_name TEXT,
    responsible_phone TEXT,
    responsible_email TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- Create categories table
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Create subcategories table
CREATE TABLE public.subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (category_id, name)
);

ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

-- Create suppliers table
CREATE TABLE public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    trade_name TEXT,
    tax_id TEXT,
    country TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state_province TEXT,
    postal_code TEXT,
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    website TEXT,
    payment_terms TEXT,
    avg_response_time_days INTEGER,
    certifications TEXT[],
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Create products table
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    ncm TEXT,
    technical_description TEXT NOT NULL,
    brand TEXT,
    category_id UUID REFERENCES public.categories(id),
    subcategory_id UUID REFERENCES public.subcategories(id),
    supplier_id UUID REFERENCES public.suppliers(id),
    unit_of_measure unit_of_measure NOT NULL DEFAULT 'pcs',
    qty_master_box INTEGER,
    qty_inner INTEGER,
    weight_per_unit DECIMAL(10,3),
    master_box_length DECIMAL(10,2),
    master_box_width DECIMAL(10,2),
    master_box_height DECIMAL(10,2),
    fob_price_usd DECIMAL(12,4),
    moq INTEGER,
    lead_time_days INTEGER,
    customs_value DECIMAL(12,2),
    tax_ii DECIMAL(5,2),
    tax_ipi DECIMAL(5,2),
    tax_pis DECIMAL(5,4),
    tax_cofins DECIMAL(5,4),
    tax_icms DECIMAL(5,2),
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_units_updated_at
    BEFORE UPDATE ON public.units
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at
    BEFORE UPDATE ON public.suppliers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name, email)
    VALUES (new.id, new.raw_user_meta_data ->> 'full_name', new.email);
    
    -- Assign default 'viewer' role to new users
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'viewer');
    
    RETURN new;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- User roles policies
CREATE POLICY "Users can view their own roles"
    ON public.user_roles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
    ON public.user_roles FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- Profiles policies
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- Units policies (all authenticated users can view, admins can manage)
CREATE POLICY "Authenticated users can view units"
    ON public.units FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage units"
    ON public.units FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- Categories policies
CREATE POLICY "Authenticated users can view categories"
    ON public.categories FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins and buyers can manage categories"
    ON public.categories FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'buyer'));

-- Subcategories policies
CREATE POLICY "Authenticated users can view subcategories"
    ON public.subcategories FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins and buyers can manage subcategories"
    ON public.subcategories FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'buyer'));

-- Suppliers policies
CREATE POLICY "Authenticated users can view suppliers"
    ON public.suppliers FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins and buyers can manage suppliers"
    ON public.suppliers FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'buyer'));

-- Products policies
CREATE POLICY "Authenticated users can view products"
    ON public.products FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins and buyers can manage products"
    ON public.products FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'buyer'));