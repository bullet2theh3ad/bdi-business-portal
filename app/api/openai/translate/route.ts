// OpenAI Real-time Translation API Endpoint
// Provides AI-powered translation for our existing translation system

import { NextRequest, NextResponse } from 'next/server';
import { translateWithOpenAI, batchTranslateWithOpenAI, TranslationRequest } from '@/lib/openai/translation-service';
import { isOpenAIConfigured } from '@/lib/openai/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { texts, text, fromLanguage, toLanguage, context, batch = false } = body;

    // Validate required fields
    if (!fromLanguage || !toLanguage) {
      return NextResponse.json(
        { error: 'fromLanguage and toLanguage are required' },
        { status: 400 }
      );
    }

    // Validate language codes
    const validLanguages = ['en', 'zh', 'vi', 'es'];
    if (!validLanguages.includes(fromLanguage) || !validLanguages.includes(toLanguage)) {
      return NextResponse.json(
        { error: 'Invalid language code. Supported: en, zh, vi, es' },
        { status: 400 }
      );
    }

    // Handle batch translation
    if (batch && texts && Array.isArray(texts)) {
      if (texts.length === 0) {
        return NextResponse.json(
          { error: 'texts array cannot be empty for batch translation' },
          { status: 400 }
        );
      }

      const results = await batchTranslateWithOpenAI(texts, fromLanguage, toLanguage, context);
      
      return NextResponse.json({
        success: true,
        batch: true,
        results,
        count: results.length
      });
    }

    // Handle single translation
    if (!text) {
      return NextResponse.json(
        { error: 'text is required for single translation' },
        { status: 400 }
      );
    }

    const result = await translateWithOpenAI({
      text,
      fromLanguage,
      toLanguage,
      context
    });

    return NextResponse.json({
      success: true,
      batch: false,
      result
    });

  } catch (error: any) {
    console.error('Translation API Error:', error);
    
    // Handle specific errors
    if (error.message.includes('not configured')) {
      return NextResponse.json(
        { error: 'Translation service not configured' },
        { status: 503 }
      );
    }

    if (error.message.includes('rate limit')) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'Translation failed', details: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint for translation status/health check
export async function GET() {
  return NextResponse.json({
    status: 'active',
    service: 'OpenAI Translation Service',
    supportedLanguages: ['en', 'zh', 'vi', 'es'],
    contexts: ['business', 'technical', 'cpfr', 'manufacturing', 'general'],
    features: ['single', 'batch'],
    configured: isOpenAIConfigured()
  });
}
