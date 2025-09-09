// Simple translation function that works without full next-intl routing
// Safe fallback approach for gradual i18n implementation

import enMessages from '@/messages/en.json';
import zhMessages from '@/messages/zh.json';
import viMessages from '@/messages/vi.json';
import esMessages from '@/messages/es.json';

const messages = {
  en: enMessages,
  zh: zhMessages,
  vi: viMessages,
  es: esMessages
};

type Locale = keyof typeof messages;
type MessageKey = string;

// Get nested value from object using dot notation (e.g., 'navigation.dashboard')
function getNestedValue(obj: any, path: string): string | undefined {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Simple translation function
export function translate(locale: Locale = 'en', key: MessageKey, fallback?: string): string {
  try {
    const message = getNestedValue(messages[locale], key);
    if (message && typeof message === 'string') {
      return message;
    }
    
    // Fallback to English if translation not found
    if (locale !== 'en') {
      const englishMessage = getNestedValue(messages.en, key);
      if (englishMessage && typeof englishMessage === 'string') {
        return englishMessage;
      }
    }
    
    // Final fallback
    return fallback || key;
  } catch (error) {
    console.warn(`Translation error for ${locale}.${key}:`, error);
    return fallback || key;
  }
}

// Hook-like function for components (will replace with real hook later)
export function useSimpleTranslations(locale: Locale = 'en') {
  return {
    // Navigation translations
    tn: (key: string, fallback?: string) => translate(locale, `navigation.${key}`, fallback),
    // Common translations  
    tc: (key: string, fallback?: string) => translate(locale, `common.${key}`, fallback),
    // CPFR translations
    tcpfr: (key: string, fallback?: string) => translate(locale, `cpfr.${key}`, fallback),
    // Direct translation
    t: (key: string, fallback?: string) => translate(locale, key, fallback)
  };
}

// Get user's preferred locale (will implement user preferences later)
export function getUserLocale(): Locale {
  // TODO: Get from user preferences in database
  // For now, return English as default
  return 'en';
}
