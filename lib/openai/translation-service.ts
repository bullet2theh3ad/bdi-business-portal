// OpenAI Real-time Translation Service for BDI Business Portal
// Enhances our existing translation system with AI-powered improvements

import { openai, isOpenAIConfigured } from './config';

export interface TranslationRequest {
  text: string;
  fromLanguage: 'en' | 'zh' | 'vi' | 'es';
  toLanguage: 'en' | 'zh' | 'vi' | 'es';
  context?: 'business' | 'technical' | 'cpfr' | 'manufacturing' | 'general';
}

export interface TranslationResponse {
  originalText: string;
  translatedText: string;
  fromLanguage: string;
  toLanguage: string;
  confidence: number;
  context: string;
}

// Language mappings for OpenAI prompts
const LANGUAGE_NAMES = {
  'en': 'English',
  'zh': 'Chinese (Simplified)',
  'vi': 'Vietnamese', 
  'es': 'Spanish'
};

// Context-specific prompts for better translations
const CONTEXT_PROMPTS = {
  business: 'This is business terminology for a B2B supply chain management platform. Use professional, formal language.',
  technical: 'This is technical terminology for manufacturing and logistics. Use precise, industry-standard terms.',
  cpfr: 'This is CPFR (Collaborative Planning, Forecasting, and Replenishment) terminology. Use established supply chain terms.',
  manufacturing: 'This is manufacturing and production terminology. Use standard industrial vocabulary.',
  general: 'This is general user interface text. Use clear, user-friendly language.'
};

export async function translateWithOpenAI(request: TranslationRequest): Promise<TranslationResponse> {
  if (!isOpenAIConfigured()) {
    throw new Error('OpenAI is not configured');
  }

  const { text, fromLanguage, toLanguage, context = 'general' } = request;
  
  if (fromLanguage === toLanguage) {
    return {
      originalText: text,
      translatedText: text,
      fromLanguage,
      toLanguage,
      confidence: 1.0,
      context
    };
  }

  const prompt = `You are a professional translator specializing in business and supply chain terminology.

Task: Translate the following text from ${LANGUAGE_NAMES[fromLanguage]} to ${LANGUAGE_NAMES[toLanguage]}.

Context: ${CONTEXT_PROMPTS[context]}

Requirements:
- Maintain professional business tone
- Use industry-standard terminology
- Keep the same meaning and intent
- For technical terms, use established translations
- For button text, keep it concise and actionable

Text to translate: "${text}"

Respond with ONLY the translated text, no explanations or additional content.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 200,
      temperature: 0.3, // Lower temperature for consistent translations
      messages: [
        {
          role: 'system',
          content: 'You are a professional translator. Respond with only the translated text, no explanations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const translatedText = completion.choices[0]?.message?.content?.trim();
    
    if (!translatedText) {
      throw new Error('No translation received from OpenAI');
    }

    return {
      originalText: text,
      translatedText,
      fromLanguage,
      toLanguage,
      confidence: 0.95, // High confidence for OpenAI translations
      context
    };

  } catch (error: any) {
    console.error('OpenAI Translation Error:', error);
    throw new Error(`Translation failed: ${error.message}`);
  }
}

// Batch translation for multiple texts
export async function batchTranslateWithOpenAI(
  texts: string[], 
  fromLanguage: TranslationRequest['fromLanguage'], 
  toLanguage: TranslationRequest['toLanguage'],
  context: TranslationRequest['context'] = 'general'
): Promise<TranslationResponse[]> {
  
  const results: TranslationResponse[] = [];
  
  // Process in batches to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchPromises = batch.map(text => 
      translateWithOpenAI({ text, fromLanguage, toLanguage, context })
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Small delay to respect rate limits
    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}
