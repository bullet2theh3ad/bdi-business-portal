'use client';

import Link from 'next/link';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import { DynamicTranslation } from '@/components/DynamicTranslation';
import { DocumentationTranslation, DocumentationCard } from '@/components/DocumentationTranslation';

interface CPFRScenarioAnalysisGuideProps {
  userLanguage: string;
}

export function CPFRScenarioAnalysisGuide({ userLanguage }: CPFRScenarioAnalysisGuideProps) {
  return (
    <div className="bg-purple-50 p-5 rounded-lg border border-purple-200">
      <h3 className="font-bold text-lg text-purple-800 mb-3">
        <DynamicTranslation userLanguage={userLanguage} context="cpfr">
          🔬 <Link href="/cpfr/forecasts" className="hover:underline text-purple-600">Scenario Analysis</Link>
        </DynamicTranslation>
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="font-semibold text-purple-700">
            <DynamicTranslation userLanguage={userLanguage} context="cpfr">
              Work-Backwards Timeline Analysis:
            </DynamicTranslation>
          </h4>
          <ul className="space-y-1 text-sm">
            <li className="flex items-start gap-2">
              <SemanticBDIIcon semantic="analytics" size={12} className="text-purple-500 flex-shrink-0 mt-0.5" />
              <DocumentationTranslation userLanguage={userLanguage} context="cpfr">
                <strong>Reality Check:</strong> Transform optimistic sales forecasts into realistic CPFR timelines
              </DocumentationTranslation>
            </li>
            <li className="flex items-start gap-2">
              <SemanticBDIIcon semantic="calendar" size={12} className="text-purple-500 flex-shrink-0 mt-0.5" />
              <DocumentationTranslation userLanguage={userLanguage} context="cpfr">
                <strong>Sales Delivery as Stake:</strong> Work backwards from customer commitment date
              </DocumentationTranslation>
            </li>
            <li className="flex items-start gap-2">
              <SemanticBDIIcon semantic="settings" size={12} className="text-purple-500 flex-shrink-0 mt-0.5" />
              <DocumentationTranslation userLanguage={userLanguage} context="cpfr">
                <strong>Custom Parameters:</strong> Realistic shipping methods, lead times, and safety buffers
              </DocumentationTranslation>
            </li>
            <li className="flex items-start gap-2">
              <SemanticBDIIcon semantic="warning" size={12} className="text-purple-500 flex-shrink-0 mt-0.5" />
              <DocumentationTranslation userLanguage={userLanguage} context="cpfr">
                <strong>Risk Assessment:</strong> HIGH/MEDIUM/LOW feasibility with overdue alerts
              </DocumentationTranslation>
            </li>
          </ul>
        </div>
        
        <div className="space-y-2">
          <h4 className="font-semibold text-purple-700">
            <DynamicTranslation userLanguage={userLanguage} context="cpfr">
              Timeline Milestones & Actions:
            </DynamicTranslation>
          </h4>
          <ul className="space-y-1 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold text-xs mt-0.5">🎯</span>
              <DocumentationTranslation userLanguage={userLanguage} context="cpfr">
                <strong>Sales Delivery Date:</strong> Customer commitment (stake in ground)
              </DocumentationTranslation>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold text-xs mt-0.5">🏪</span>
              <DocumentationTranslation userLanguage={userLanguage} context="cpfr">
                <strong>Warehouse Arrival:</strong> Safety buffer before delivery
              </DocumentationTranslation>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600 font-bold text-xs mt-0.5">🚢</span>
              <DocumentationTranslation userLanguage={userLanguage} context="cpfr">
                <strong>Shipping Start:</strong> Transit time (Sea: 21-45 days, Air: 7-14 days)
              </DocumentationTranslation>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-600 font-bold text-xs mt-0.5">🏭</span>
              <DocumentationTranslation userLanguage={userLanguage} context="cpfr">
                <strong>Production Start:</strong> Manufacturing lead time
              </DocumentationTranslation>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-600 font-bold text-xs mt-0.5">📡</span>
              <DocumentationTranslation userLanguage={userLanguage} context="cpfr">
                <strong>Factory Signal Required:</strong> Critical action date for production planning
              </DocumentationTranslation>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-4 p-4 bg-white rounded-lg border border-purple-300">
        <h4 className="font-semibold text-purple-800 mb-2">
          <DynamicTranslation userLanguage={userLanguage} context="cpfr">
            📧 Stakeholder Communication:
          </DynamicTranslation>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <DocumentationTranslation userLanguage={userLanguage} context="cpfr">
              <strong>Email Action Items:</strong> Send comprehensive timeline analysis to stakeholders
            </DocumentationTranslation>
            <ul className="space-y-1 text-xs text-purple-700 ml-4">
              <li>• Pre-populated recipients (Dariush & Steve)</li>
              <li>• Add sales team, factory contacts, additional stakeholders</li>
              <li>• Professional HTML email with work-backwards timeline</li>
              <li>• Risk assessment and specific action items</li>
            </ul>
          </div>
          <div className="space-y-1">
            <DocumentationTranslation userLanguage={userLanguage} context="cpfr">
              <strong>Email Content:</strong> Professional CPFR communication with BDI branding
            </DocumentationTranslation>
            <ul className="space-y-1 text-xs text-purple-700 ml-4">
              <li>• CPFR analysis summary with key metrics</li>
              <li>• Complete work-backwards timeline with dates</li>
              <li>• URGENT alerts for overdue factory signals</li>
              <li>• Specific action items with deadlines</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-4 bg-gradient-to-r from-purple-100 to-blue-100 p-3 rounded-lg border border-purple-200">
        <div className="flex items-start gap-2">
          <SemanticBDIIcon semantic="lightbulb" size={16} className="text-purple-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <DocumentationTranslation userLanguage={userLanguage} context="cpfr">
              <strong>Best Practice:</strong> Use Scenario Analysis to convert unrealistic "zero lag" sales forecasts 
              into actionable CPFR timelines. The analysis helps CPFR leaders communicate realistic factory signal 
              timing to stakeholders, ensuring proper production planning and delivery commitments.
            </DocumentationTranslation>
          </div>
        </div>
      </div>
    </div>
  );
}
