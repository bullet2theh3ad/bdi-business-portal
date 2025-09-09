import { useTranslations } from 'next-intl';

// Safe translation wrapper that always returns a string (no crashes)
export function useSafeTranslations(namespace?: string) {
  try {
    const t = useTranslations(namespace);
    
    // Return a safe translation function
    return (key: string, fallback?: string) => {
      try {
        const translated = t(key);
        return translated || fallback || key;
      } catch (error) {
        console.warn(`Translation missing for key: ${namespace ? namespace + '.' : ''}${key}`);
        return fallback || key;
      }
    };
  } catch (error) {
    console.warn(`Translation namespace not available: ${namespace}`);
    // Return a fallback function that just returns the fallback or key
    return (key: string, fallback?: string) => fallback || key;
  }
}

// Hook for navigation translations
export function useNavigationTranslations() {
  return useSafeTranslations('navigation');
}

// Hook for common translations (buttons, actions)
export function useCommonTranslations() {
  return useSafeTranslations('common');
}

// Hook for CPFR-specific translations
export function useCPFRTranslations() {
  return useSafeTranslations('cpfr');
}
