-- Phase 1: Add 'trader' role to the enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'trader';