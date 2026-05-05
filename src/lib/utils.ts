import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility to merge tailwind classes with clsx and tailwind-merge
 * Fallback to simple join if dependencies are missing (though they should be installed)
 */
export function cn(...inputs: ClassValue[]) {
  try {
    return twMerge(clsx(inputs));
  } catch (e) {
    return inputs.filter(Boolean).join(" ");
  }
}
