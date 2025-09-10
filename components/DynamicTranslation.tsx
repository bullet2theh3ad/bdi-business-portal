// Dynamic Translation Component
// Automatically translates untranslated HTML content using OpenAI
// Production-ready with caching, error handling, and performance optimizations

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { translateWithAI } from '@/lib/i18n/simple-translator';

// Simple in-memory cache for translations
const translationCache = new Map<string, string>();

interface DynamicTranslationProps {
  children: React.ReactNode;
  userLanguage: string;
  context?: 'business' | 'technical' | 'cpfr' | 'manufacturing' | 'general';
  fallback?: React.ReactNode;
}

export function DynamicTranslation({ 
  children, 
  userLanguage, 
  context = 'business',
  fallback 
}: DynamicTranslationProps) {
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract text content from children
  const extractTextContent = (node: React.ReactNode): string => {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return node.toString();
    if (Array.isArray(node)) return node.map(extractTextContent).join(' ');
    if (node && typeof node === 'object' && 'props' in node) {
      return extractTextContent((node as any).props.children);
    }
    return '';
  };

  // Memoize the original text extraction
  const originalText = useMemo(() => {
    return extractTextContent(children);
  }, [children]);

  // Create cache key
  const cacheKey = useMemo(() => {
    return `${originalText.trim()}-${userLanguage}-${context}`;
  }, [originalText, userLanguage, context]);

  // Translation function with caching
  const translateContent = useCallback(async () => {
    // Only translate if user language is not English
    if (userLanguage === 'en' || !userLanguage) {
      return;
    }

    // Skip if no text content or already very short
    if (!originalText.trim() || originalText.trim().length < 3) {
      return;
    }

    // Skip if text looks like it might already be translated (contains non-ASCII)
    if (!/^[\x00-\x7F]*$/.test(originalText)) {
      return;
    }

    // Check cache first
    const cached = translationCache.get(cacheKey);
    if (cached) {
      setTranslatedContent(cached);
      return;
    }

    setIsTranslating(true);
    setError(null);

    try {
      const translated = await translateWithAI(
        originalText.trim(), 
        userLanguage as any, 
        context
      );
      
      if (translated && translated !== originalText.trim()) {
        // Cache the translation
        translationCache.set(cacheKey, translated);
        setTranslatedContent(translated);
      }
    } catch (err: any) {
      console.error('Dynamic translation error:', err);
      setError(err.message);
    } finally {
      setIsTranslating(false);
    }
  }, [originalText, userLanguage, context, cacheKey]);

  useEffect(() => {
    // Debounce translation requests
    const timeoutId = setTimeout(translateContent, 300);
    return () => clearTimeout(timeoutId);
  }, [translateContent]);

  // Show loading state while translating
  if (isTranslating) {
    return (
      <span className="opacity-75 animate-pulse">
        {fallback || children}
      </span>
    );
  }

  // Show error state if translation failed
  if (error) {
    return <span title={`Translation error: ${error}`}>{children}</span>;
  }

  // Show translated content if available
  if (translatedContent) {
    return <span title={`Original: ${extractTextContent(children)}`}>{translatedContent}</span>;
  }

  // Default: show original content
  return <>{children}</>;
}

// Hook for dynamic translation of text strings
export function useDynamicTranslation(userLanguage: string, context: string = 'business') {
  const translateText = async (text: string): Promise<string> => {
    if (userLanguage === 'en' || !userLanguage || !text.trim()) {
      return text;
    }

    try {
      return await translateWithAI(text, userLanguage as any, context);
    } catch (error) {
      console.error('Translation hook error:', error);
      return text;
    }
  };

  return { translateText };
}

// Utility component for quick text translation
export function TranslateText({ 
  text, 
  userLanguage, 
  context = 'business' 
}: { 
  text: string; 
  userLanguage: string; 
  context?: 'business' | 'technical' | 'cpfr' | 'manufacturing' | 'general';
}) {
  return (
    <DynamicTranslation userLanguage={userLanguage} context={context}>
      {text}
    </DynamicTranslation>
  );
}
