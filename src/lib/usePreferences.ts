export const PAGE_SIZE_OPTIONS = [10, 15, 25, 50, 100];

/**
 * Mock preference hook
 */
export function usePreferences<T>(key: string, defaultValue: T) {
  return [defaultValue, (val: T) => {}] as const;
}
