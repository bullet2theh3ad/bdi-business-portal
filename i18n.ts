import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';

// Can be imported from a shared config
export const locales = ['en', 'zh', 'vi', 'es'] as const;
export const defaultLocale = 'en' as const;

export default getRequestConfig(async ({ locale }) => {
  // Validate that the incoming `locale` parameter is valid
  const validLocale = locale || defaultLocale;
  if (!locales.includes(validLocale as any)) notFound();

  return {
    locale: validLocale,
    messages: (await import(`./messages/${validLocale}.json`)).default
  };
});
