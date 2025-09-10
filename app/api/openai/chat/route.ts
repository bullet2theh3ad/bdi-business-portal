// OpenAI Chat API Endpoint - Baby Step 1
// Simple chat endpoint for BDI Business Portal

import { NextRequest, NextResponse } from 'next/server';
import { openai, OPENAI_CONFIG, isOpenAIConfigured, OpenAIError } from '@/lib/openai/config';

export async function POST(request: NextRequest) {
  try {
    // Check if OpenAI is configured
    if (!isOpenAIConfigured()) {
      return NextResponse.json(
        { error: 'OpenAI is not configured. Please add OPENAI_API_KEY to environment variables.' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { message, userLanguage = 'en' } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Create language-aware system prompt
    const languagePrompt = userLanguage !== 'en' 
      ? `\n\nIMPORTANT: The user's preferred language is ${userLanguage}. Please respond in their language:
      - zh: Respond in Chinese (Simplified)
      - vi: Respond in Vietnamese  
      - es: Respond in Spanish
      
      Maintain professional business terminology appropriate for B2B supply chain management.`
      : '';

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: OPENAI_CONFIG.model,
      max_tokens: OPENAI_CONFIG.maxTokens,
      temperature: OPENAI_CONFIG.temperature,
      messages: [
        {
          role: 'system',
          content: OPENAI_CONFIG.systemPrompt + languagePrompt
        },
        {
          role: 'user',
          content: message
        }
      ]
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      throw new OpenAIError('No response from OpenAI');
    }

    return NextResponse.json({
      success: true,
      response: response,
      model: OPENAI_CONFIG.model,
      userLanguage: userLanguage
    });

  } catch (error: any) {
    console.error('OpenAI API Error:', error);
    
    // Handle specific OpenAI errors
    if (error.status === 401) {
      return NextResponse.json(
        { error: 'Invalid OpenAI API key' },
        { status: 401 }
      );
    }
    
    if (error.status === 429) {
      return NextResponse.json(
        { error: 'OpenAI rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process request', details: error.message },
      { status: 500 }
    );
  }
}
