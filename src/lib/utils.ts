import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function extractContainerInfo(notes: string | null): string {
  if (!notes) return '-';
  const match = notes.match(/Container:\s*([^|]+)/);
  return match ? match[1].trim() : '-';
}
