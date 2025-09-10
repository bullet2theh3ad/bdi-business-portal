// Documentation Translation Component
// Smart wrapper for translating large blocks of documentation content
// Optimized for User Guide and help pages with bulk content

'use client';

import { DynamicTranslation } from './DynamicTranslation';

interface DocumentationTranslationProps {
  userLanguage: string;
  context?: 'business' | 'technical' | 'cpfr' | 'manufacturing' | 'general';
  children: React.ReactNode;
  className?: string;
}

// Smart wrapper that handles entire documentation sections
export function DocumentationTranslation({ 
  userLanguage, 
  context = 'business', 
  children, 
  className 
}: DocumentationTranslationProps) {
  return (
    <div className={className}>
      <DynamicTranslation userLanguage={userLanguage} context={context}>
        {children}
      </DynamicTranslation>
    </div>
  );
}

// Specialized component for capability items (icon + description)
export function CapabilityItem({ 
  icon, 
  title, 
  description, 
  userLanguage, 
  context = 'business' 
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  userLanguage: string;
  context?: 'business' | 'technical' | 'cpfr' | 'manufacturing' | 'general';
}) {
  return (
    <div className="flex items-start gap-2 sm:gap-3">
      {icon}
      <div className="text-xs sm:text-sm">
        <DynamicTranslation userLanguage={userLanguage} context={context}>
          <strong>{title}:</strong> {description}
        </DynamicTranslation>
      </div>
    </div>
  );
}

// Specialized component for navigation items
export function NavigationItem({ 
  icon, 
  title, 
  description, 
  userLanguage,
  context = 'business' 
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  userLanguage: string;
  context?: 'business' | 'technical' | 'cpfr' | 'manufacturing' | 'general';
}) {
  return (
    <div className="flex items-start gap-3">
      {icon}
      <div>
        <h4 className="font-semibold text-sm text-gray-800 mb-1">
          <DynamicTranslation userLanguage={userLanguage} context="general">
            {title}
          </DynamicTranslation>
        </h4>
        <DynamicTranslation userLanguage={userLanguage} context={context}>
          {description}
        </DynamicTranslation>
      </div>
    </div>
  );
}

// Wrapper for entire card content sections
export function DocumentationCard({ 
  title, 
  children, 
  userLanguage, 
  context = 'business',
  titleStatic = false 
}: {
  title: string;
  children: React.ReactNode;
  userLanguage: string;
  context?: 'business' | 'technical' | 'cpfr' | 'manufacturing' | 'general';
  titleStatic?: boolean; // If true, title won't be translated
}) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {titleStatic ? (
        <h3 className="font-bold text-base sm:text-lg text-gray-800">{title}</h3>
      ) : (
        <h3 className="font-bold text-base sm:text-lg text-gray-800">
          <DynamicTranslation userLanguage={userLanguage} context="general">
            {title}
          </DynamicTranslation>
        </h3>
      )}
      <DocumentationTranslation userLanguage={userLanguage} context={context}>
        {children}
      </DocumentationTranslation>
    </div>
  );
}
