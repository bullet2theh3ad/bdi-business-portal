// OpenAI Configuration for BDI Business Portal
// Baby Step 1: Basic setup and configuration

import OpenAI from 'openai';

// Initialize OpenAI client
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// OpenAI configuration for BDI Business Portal
export const OPENAI_CONFIG = {
  // Model configuration
  model: 'gpt-4o-mini', // Cost-effective model for business use
  maxTokens: 1000,
  temperature: 0.7,
  
  // BDI-specific context
  systemPrompt: `You are an AI assistant for the BDI Business Portal, a B2B platform for CPFR (Collaborative Planning, Forecasting, and Replenishment) and supply chain management.

Context:
- Users manage forecasts, invoices, purchase orders, shipments, warehouses, and production files
- The platform supports international users (English, Chinese, Vietnamese, Spanish)
- Users include manufacturers like MTN (Shenzhen MTN Electronics Co., Ltd) and other partners
- Focus on professional B2B terminology and supply chain operations

Your role:
- Help users with CPFR workflow questions
- Provide supply chain insights and recommendations
- Assist with data interpretation and business decisions
- Support international users in their preferred language
- Maintain professional, business-focused tone`,

  // Feature flags for gradual rollout
  features: {
    chatSupport: true,
    dataAnalysis: false, // Enable later
    forecastInsights: false, // Enable later
    documentSummary: false, // Enable later
  }
};

// Utility function to check if OpenAI is properly configured
export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

// Error handling for OpenAI API calls
export class OpenAIError extends Error {
  constructor(message: string, public cause?: any) {
    super(message);
    this.name = 'OpenAIError';
  }
}
