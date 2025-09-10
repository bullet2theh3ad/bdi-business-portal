// Language Switcher Component
// Mobile-optimized language selector with country flags
// Positioned next to version bubble in page headers

'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Language {
  code: string;
  name: string;
  flag: string;
  nativeName: string;
}

const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', flag: '🇺🇸', nativeName: 'English' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳', nativeName: '中文' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳', nativeName: 'Tiếng Việt' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸', nativeName: 'Español' },
];

interface LanguageSwitcherProps {
  currentLanguage: string;
  onLanguageChange: (languageCode: string) => void;
  className?: string;
  compact?: boolean; // For mobile/compact layouts
}

export function LanguageSwitcher({ 
  currentLanguage, 
  onLanguageChange, 
  className = '',
  compact = false 
}: LanguageSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLang = LANGUAGES.find(lang => lang.code === currentLanguage) || LANGUAGES[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageSelect = async (languageCode: string) => {
    try {
      // Update user's preferred language in the database
      const response = await fetch('/api/user/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredLanguage: languageCode }),
      });

      if (response.ok) {
        onLanguageChange(languageCode);
        setIsOpen(false);
        
        // Refresh the page to apply new language
        window.location.reload();
      } else {
        console.error('Failed to update language preference');
      }
    } catch (error) {
      console.error('Error updating language:', error);
    }
  };

  if (compact) {
    // Mobile/compact version - just the flag
    return (
      <div className={`relative ${className}`} ref={dropdownRef}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="h-8 w-8 p-0 hover:bg-gray-100"
          title={`Current language: ${currentLang.nativeName}`}
        >
          <span className="text-lg">{currentLang.flag}</span>
        </Button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[140px]">
            <div className="py-1">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageSelect(lang.code)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2 ${
                    lang.code === currentLanguage ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                  }`}
                >
                  <span className="text-base">{lang.flag}</span>
                  <span className="font-medium">{lang.nativeName}</span>
                  {lang.code === currentLanguage && (
                    <span className="ml-auto text-blue-600">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop version - flag + language name
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <Badge 
        variant="outline" 
        className="cursor-pointer hover:bg-gray-50 px-2 py-1 h-auto"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-sm mr-1">{currentLang.flag}</span>
        <span className="text-xs font-medium hidden sm:inline">{currentLang.nativeName}</span>
      </Badge>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[160px]">
          <div className="py-1">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageSelect(lang.code)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-3 ${
                  lang.code === currentLanguage ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                <span className="text-base">{lang.flag}</span>
                <div className="flex-1">
                  <div className="font-medium">{lang.nativeName}</div>
                  <div className="text-xs text-gray-500">{lang.name}</div>
                </div>
                {lang.code === currentLanguage && (
                  <span className="text-blue-600">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Hook to get current user language for the switcher
export function useCurrentLanguage() {
  // This would typically come from user context or SWR
  // For now, return a default that can be overridden
  return 'en';
}
