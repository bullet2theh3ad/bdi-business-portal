'use client';

import { useState } from 'react';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import { useSimpleTranslations, getUserLocale } from '@/lib/i18n/simple-translator';
import { DynamicTranslation } from '@/components/DynamicTranslation';
import useSWR from 'swr';
import { User } from '@/lib/db/schema';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function EDIIntegrationGuidePage() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const userLocale = getUserLocale(user);
  const { tc } = useSimpleTranslations(userLocale);

  return (
    <section className="flex-1 p-3 sm:p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <SemanticBDIIcon semantic="integration" size={32} className="text-blue-600 sm:w-10 sm:h-10" />
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
              {tc('ediIntegrationGuide', 'EDI Integration Guide')}
            </h1>
          </div>
          <p className="text-base sm:text-lg lg:text-xl text-gray-600 px-2">
            <DynamicTranslation userLanguage={userLocale} context="business">
              Electronic Data Interchange (EDI) Integration with BDI Business Portal
            </DynamicTranslation>
          </p>
          <p className="text-xs sm:text-sm text-gray-500 mt-2 px-2">
            Last Updated: {new Date().toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
          <div className="w-16 sm:w-24 h-1 bg-gradient-to-r from-blue-500 to-green-500 mx-auto mt-3 sm:mt-4 rounded-full"></div>
        </div>
        
        <div className="space-y-4 sm:space-y-6 lg:space-y-8">
          
          {/* Coming Soon Notice */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <SemanticBDIIcon semantic="info" size={24} className="text-blue-600" />
              <h2 className="text-xl sm:text-2xl font-semibold text-blue-900">
                Coming Soon - EDI Integration
              </h2>
            </div>
            <p className="text-blue-800 text-sm sm:text-base leading-relaxed">
              <DynamicTranslation userLanguage={userLocale} context="business">
                BDI is actively developing comprehensive EDI integration capabilities to streamline data exchange with partner organizations. This page will be updated with detailed integration guides, technical specifications, and implementation resources as they become available.
              </DynamicTranslation>
            </p>
          </div>

          {/* What is EDI? */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <SemanticBDIIcon semantic="document" size={24} className="text-gray-700" />
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
                What is EDI?
              </h2>
            </div>
            <div className="space-y-3 text-gray-700 text-sm sm:text-base">
              <p>
                <DynamicTranslation userLanguage={userLocale} context="technical">
                  Electronic Data Interchange (EDI) is a standardized method for exchanging business documents between organizations electronically. EDI enables automated processing of transactions such as purchase orders, invoices, shipping notices, and inventory updates without manual intervention.
                </DynamicTranslation>
              </p>
              <p>
                <DynamicTranslation userLanguage={userLocale} context="business">
                  For supply chain partners, EDI integration reduces processing time, eliminates data entry errors, and provides real-time visibility into business transactions across the entire supply chain network.
                </DynamicTranslation>
              </p>
            </div>
          </div>

          {/* Planned EDI Capabilities */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <SemanticBDIIcon semantic="features" size={24} className="text-gray-700" />
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
                Planned EDI Capabilities
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Purchase Orders */}
              <div className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <SemanticBDIIcon semantic="orders" size={20} className="text-blue-600" />
                  <h3 className="font-semibold text-gray-900">Purchase Orders (EDI 850)</h3>
                </div>
                <p className="text-sm text-gray-600">
                  <DynamicTranslation userLanguage={userLocale} context="business">
                    Automated purchase order transmission from customers to BDI, enabling seamless order processing and acknowledgment.
                  </DynamicTranslation>
                </p>
              </div>

              {/* Invoices */}
              <div className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <SemanticBDIIcon semantic="invoice" size={20} className="text-green-600" />
                  <h3 className="font-semibold text-gray-900">Invoices (EDI 810)</h3>
                </div>
                <p className="text-sm text-gray-600">
                  <DynamicTranslation userLanguage={userLocale} context="business">
                    Electronic invoice delivery to customers with detailed line items, pricing, and payment terms for automated accounts payable processing.
                  </DynamicTranslation>
                </p>
              </div>

              {/* Advanced Shipping Notices */}
              <div className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <SemanticBDIIcon semantic="shipping" size={20} className="text-purple-600" />
                  <h3 className="font-semibold text-gray-900">Shipping Notices (EDI 856)</h3>
                </div>
                <p className="text-sm text-gray-600">
                  <DynamicTranslation userLanguage={userLocale} context="business">
                    Advanced shipping notices with tracking information, delivery schedules, and detailed package contents for supply chain visibility.
                  </DynamicTranslation>
                </p>
              </div>

              {/* Inventory Updates */}
              <div className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <SemanticBDIIcon semantic="inventory_analytics" size={20} className="text-orange-600" />
                  <h3 className="font-semibold text-gray-900">Inventory Updates (EDI 846)</h3>
                </div>
                <p className="text-sm text-gray-600">
                  <DynamicTranslation userLanguage={userLocale} context="business">
                    Real-time inventory position updates to partners, including available quantities, lead times, and allocation information.
                  </DynamicTranslation>
                </p>
              </div>

            </div>
          </div>

          {/* Integration Benefits */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <SemanticBDIIcon semantic="analytics" size={24} className="text-gray-700" />
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
                Integration Benefits
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <SemanticBDIIcon semantic="speed" size={24} className="text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Faster Processing</h3>
                <p className="text-sm text-gray-600">
                  <DynamicTranslation userLanguage={userLocale} context="business">
                    Reduce document processing time from hours to minutes with automated data exchange.
                  </DynamicTranslation>
                </p>
              </div>

              <div className="text-center p-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <SemanticBDIIcon semantic="accuracy" size={24} className="text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Higher Accuracy</h3>
                <p className="text-sm text-gray-600">
                  <DynamicTranslation userLanguage={userLocale} context="business">
                    Eliminate manual data entry errors and ensure consistent data quality across systems.
                  </DynamicTranslation>
                </p>
              </div>

              <div className="text-center p-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <SemanticBDIIcon semantic="visibility" size={24} className="text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Real-Time Visibility</h3>
                <p className="text-sm text-gray-600">
                  <DynamicTranslation userLanguage={userLocale} context="business">
                    Gain immediate visibility into transaction status and supply chain events.
                  </DynamicTranslation>
                </p>
              </div>

            </div>
          </div>

          {/* Technical Standards */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <SemanticBDIIcon semantic="settings" size={24} className="text-gray-700" />
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
                Technical Standards & Protocols
              </h2>
            </div>
            <div className="space-y-4">
              
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-semibold text-gray-900 mb-1">ANSI X12 Standards</h3>
                <p className="text-sm text-gray-600">
                  <DynamicTranslation userLanguage={userLocale} context="technical">
                    Support for ANSI X12 EDI transaction sets including 850, 810, 856, and 846 with standard data elements and segments.
                  </DynamicTranslation>
                </p>
              </div>

              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="font-semibold text-gray-900 mb-1">Secure Transmission</h3>
                <p className="text-sm text-gray-600">
                  <DynamicTranslation userLanguage={userLocale} context="technical">
                    AS2, SFTP, and HTTPS protocols for secure, encrypted data transmission with message acknowledgments and error handling.
                  </DynamicTranslation>
                </p>
              </div>

              <div className="border-l-4 border-purple-500 pl-4">
                <h3 className="font-semibold text-gray-900 mb-1">Data Validation</h3>
                <p className="text-sm text-gray-600">
                  <DynamicTranslation userLanguage={userLocale} context="technical">
                    Comprehensive data validation, syntax checking, and business rule enforcement to ensure data integrity and compliance.
                  </DynamicTranslation>
                </p>
              </div>

            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <SemanticBDIIcon semantic="contact" size={24} className="text-green-700" />
              <h2 className="text-xl sm:text-2xl font-semibold text-green-900">
                Get Started with EDI Integration
              </h2>
            </div>
            <div className="space-y-3">
              <p className="text-green-800 text-sm sm:text-base">
                <DynamicTranslation userLanguage={userLocale} context="business">
                  Interested in EDI integration with BDI? Our team is ready to discuss your requirements and develop a customized integration plan.
                </DynamicTranslation>
              </p>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                <div className="flex items-center gap-2">
                  <SemanticBDIIcon semantic="email" size={16} className="text-green-600" />
                  <span className="text-sm font-medium text-green-800">operations@boundlessdevices.com</span>
                </div>
                <div className="flex items-center gap-2">
                  <SemanticBDIIcon semantic="phone" size={16} className="text-green-600" />
                  <span className="text-sm font-medium text-green-800">Contact via Portal Support</span>
                </div>
              </div>
              <p className="text-xs text-green-700">
                <DynamicTranslation userLanguage={userLocale} context="business">
                  Please include your organization details, integration requirements, and expected transaction volumes in your inquiry.
                </DynamicTranslation>
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
