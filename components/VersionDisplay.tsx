'use client';

import React from 'react';
import { VERSION_INFO } from '@/lib/version';

interface VersionDisplayProps {
  className?: string;
  showDetails?: boolean;
}

export default function VersionDisplay({ className = '', showDetails = false }: VersionDisplayProps) {
  const [showTooltip, setShowTooltip] = React.useState(false);

  return (
    <div className={`relative ${className}`}>
      {/* Main version badge */}
      <div 
        className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-full px-3 py-1 cursor-pointer hover:from-blue-100 hover:to-cyan-100 transition-all duration-200"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
      >
        {/* Version icon */}
        <div className="w-2 h-2 bg-gradient-to-r from-green-400 to-green-500 rounded-full animate-pulse"></div>
        
        {/* Version text */}
        <span className="text-xs font-medium text-blue-700">
          {VERSION_INFO.version}
        </span>
        
        {/* Info indicator */}
        <div className="w-3 h-3 flex items-center justify-center">
          <span className="text-blue-500 text-xs">ℹ</span>
        </div>
      </div>

      {/* Detailed tooltip */}
      {(showTooltip || showDetails) && (
        <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-64 z-50">
          <div className="space-y-2">
            <div className="flex items-center space-x-2 border-b border-gray-100 pb-2">
              <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"></div>
              <span className="font-semibold text-gray-800">BDI Business Portal</span>
            </div>
            
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Version:</span>
                <span className="font-mono text-blue-600">{VERSION_INFO.version}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Build Date:</span>
                <span className="font-mono text-gray-800">{VERSION_INFO.buildDate}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Commit:</span>
                <span className="font-mono text-gray-800">{VERSION_INFO.shortHash}</span>
              </div>
            </div>
            
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                📋 Reference this version when reporting issues
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
