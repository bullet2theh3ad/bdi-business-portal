'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

export default function HomePage() {
  const [showConfidentiality, setShowConfidentiality] = useState(false);
  const [hasAccepted, setHasAccepted] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Professional Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-center">
            {/* BDI Logo Placeholder - Replace with actual logo */}
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">BDI</span>
              </div>
              <div className="text-left">
                <h1 className="text-2xl font-bold text-gray-900">Boundless Devices Inc.</h1>
                <p className="text-sm text-gray-600">Business Portal</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto">
          
          {/* Intro Paragraph */}
          <div className="text-center mb-12">
            <div className="bg-white rounded-xl shadow-lg p-8 border border-blue-100">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Welcome to the BDI Business Portal</h2>
              <p className="text-lg text-gray-700 leading-relaxed max-w-3xl mx-auto">
                This portal provides <strong>authorized partners, employees, and affiliates</strong> with access to proprietary tools, data, and resources. By continuing beyond this page, you acknowledge that your access is limited to <strong>legitimate business purposes</strong> in support of Boundless Devices Inc. operations.
              </p>
            </div>
          </div>

          {/* Confidentiality Notice */}
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-8 mb-8">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">!</span>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-amber-800 mb-4">Confidentiality & Use Statement</h3>
                
                <div className="space-y-4 text-amber-900">
                  <div>
                    <h4 className="font-bold text-lg mb-2">Confidentiality Notice</h4>
                    <p className="text-sm leading-relaxed">
                      All information contained within this site is the property of <strong>Boundless Devices Inc. ("BDI")</strong> and is considered <strong>proprietary and confidential</strong>. Access to this portal is restricted to <strong>authorized users only</strong>. Unauthorized use, disclosure, distribution, or reproduction of any material, data, or content is <strong>strictly prohibited</strong> and may result in disciplinary action, termination of access, and/or legal proceedings.
                    </p>
                  </div>
                  
                  <div className="border-t border-amber-300 pt-4">
                    <p className="text-sm leading-relaxed">
                      By using this portal, you agree to comply with <strong>BDI's confidentiality policies</strong> and all applicable contractual and legal obligations. Continued use constitutes your <strong>acknowledgment and acceptance</strong> of these terms.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Access Controls */}
          <div className="text-center space-y-6">
            {!hasAccepted ? (
              <div className="bg-white rounded-xl shadow-lg p-8 border border-red-200">
                <h3 className="text-xl font-semibold text-red-800 mb-4">Authorization Required</h3>
                <p className="text-gray-700 mb-6">
                  You must acknowledge the confidentiality terms above before accessing the BDI Business Portal.
                </p>
                <Button 
                  onClick={() => setHasAccepted(true)}
                  className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-lg"
                >
                  I Accept and Acknowledge Terms
                </Button>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-8 border border-green-200">
                <h3 className="text-xl font-semibold text-green-800 mb-4">✅ Terms Acknowledged</h3>
                <p className="text-gray-700 mb-6">
                  You may now proceed to sign in to the BDI Business Portal.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/sign-in">
                    <Button size="lg" className="bg-blue-600 hover:bg-blue-700 px-8 py-3 text-lg">
                      🔐 Sign In to Portal
                    </Button>
                  </Link>
                  <Button 
                    variant="outline" 
                    onClick={() => setHasAccepted(false)}
                    className="px-6 py-3"
                  >
                    Review Terms
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center mt-16 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              © 2025 Boundless Devices Inc. All rights reserved. | 
              <span className="ml-2">CPFR Supply Chain Automation Platform</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );  
} 