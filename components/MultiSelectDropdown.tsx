'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Option {
  value: string;
  label: string;
}

interface MultiSelectDropdownProps {
  options: Option[];
  selectedValues: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  label?: string;
  maxHeight?: string;
}

export function MultiSelectDropdown({
  options,
  selectedValues,
  onChange,
  placeholder = 'Select items...',
  label,
  maxHeight = 'max-h-96',
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Filter options based on search
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    option.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Check if all visible options are selected
  const allFilteredSelected = filteredOptions.length > 0 && 
    filteredOptions.every(option => selectedValues.includes(option.value));

  // Handle "Select All" toggle
  const handleSelectAll = () => {
    if (allFilteredSelected) {
      // Deselect all filtered options
      const newSelected = selectedValues.filter(
        value => !filteredOptions.some(option => option.value === value)
      );
      onChange(newSelected);
    } else {
      // Select all filtered options
      const newSelected = [
        ...selectedValues,
        ...filteredOptions
          .filter(option => !selectedValues.includes(option.value))
          .map(option => option.value)
      ];
      onChange(newSelected);
    }
  };

  // Handle individual checkbox toggle
  const handleToggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  // Display text
  const getDisplayText = () => {
    if (selectedValues.length === 0) {
      return placeholder;
    } else if (selectedValues.length === options.length) {
      return `All ${options.length} items selected`;
    } else if (selectedValues.length === 1) {
      const selected = options.find(opt => opt.value === selectedValues[0]);
      return selected ? selected.label : '1 item selected';
    } else {
      return `${selectedValues.length} items selected`;
    }
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
      >
        <span className={selectedValues.length === 0 ? 'text-gray-500' : 'text-gray-900'}>
          {getDisplayText()}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Select All Checkbox */}
          <div className="border-b border-gray-200">
            <label
              className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
            >
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={handleSelectAll}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>
              <div className="ml-2 text-sm">
                <span className="font-medium text-gray-900">
                  {allFilteredSelected ? 'Deselect All' : 'Select All'}
                </span>
                {searchTerm && (
                  <span className="ml-1 text-gray-500">
                    ({filteredOptions.length} filtered)
                  </span>
                )}
              </div>
            </label>
          </div>

          {/* Options List */}
          <div className={`overflow-y-auto ${maxHeight}`}>
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-6 text-sm text-center text-gray-500">
                No items found
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="flex items-center h-5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggle(option.value)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </div>
                    <div className="ml-2 text-sm">
                      <span className={isSelected ? 'font-medium text-gray-900' : 'text-gray-700'}>
                        {option.label}
                      </span>
                    </div>
                    {isSelected && (
                      <Check className="ml-auto w-4 h-4 text-blue-600" />
                    )}
                  </label>
                );
              })
            )}
          </div>

          {/* Footer with selected count */}
          {selectedValues.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>{selectedValues.length} of {options.length} selected</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange([]);
                  }}
                  className="h-6 px-2 text-xs"
                >
                  Clear All
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

