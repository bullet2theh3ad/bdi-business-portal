'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import { useSimpleTranslations, getUserLocale } from '@/lib/i18n/simple-translator';
import { DynamicTranslation } from '@/components/DynamicTranslation';
import useSWR from 'swr';
import { User } from '@/lib/db/schema';

interface UserWithOrganization extends User {
  organization?: {
    id: string;
    name: string;
    code: string;
    type: string;
  };
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AskBDIPage() {
  const { data: user } = useSWR<UserWithOrganization>('/api/user', fetcher);
  
  // 🌍 Translation hooks
  const userLocale = getUserLocale(user);
  const { tc } = useSimpleTranslations(userLocale);
  
  const [askBdiQuery, setAskBdiQuery] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{id: string, type: 'user' | 'assistant', content: string, timestamp: Date}>>([]);
  const [isThinking, setIsThinking] = useState(false);

  // Handle Ask BDI question submission
  const handleAskBDI = async () => {
    if (!askBdiQuery.trim() || isThinking) return;
    
    const currentQuestion = askBdiQuery;
    const userMessage = {
      id: Date.now().toString(),
      type: 'user' as const,
      content: currentQuestion,
      timestamp: new Date()
    };
    
    setAskBdiQuery('');
    setChatHistory(prev => [...prev, userMessage]);
    setIsThinking(true);
    
    try {
      const businessContext = {
        currentPage: 'ask-bdi',
        timestamp: new Date().toISOString()
      };
      
      const response = await fetch('/api/admin/ask-bdi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQuestion,
          context: businessContext,
          chatHistory: chatHistory.slice(-10)
        })
      });
      
      const result = await response.json();
      
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant' as const,
        content: result.answer || 'I apologize, but I encountered an error processing your question.',
        timestamp: new Date()
      };
      
      setChatHistory(prev => [...prev, assistantMessage]);
      
    } catch (error) {
      console.error('Ask BDI error:', error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant' as const,
        content: 'I apologize, but I encountered a technical error. Please try again.',
        timestamp: new Date()
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsThinking(false);
    }
  };

  // Only allow super admins
  if (user && user.role !== 'super_admin') {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Restricted</h1>
        <p className="text-gray-600">Ask BDI is currently available to Super Admins only.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center">
          <SemanticBDIIcon semantic="query" size={32} className="mr-3 text-blue-600" />
          🤖 Ask BDI - Business Intelligence Assistant
        </h1>
        <p className="text-gray-600">
          AI-powered analysis of your CPFR data, supply chain metrics, and business insights
        </p>
      </div>

      {/* Chat Interface */}
      <Card className="h-[70vh] flex flex-col">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center justify-between">
            <span>Business Intelligence Chat</span>
            <Badge variant="outline" className="bg-green-50 text-green-700">
              Super Admin Access
            </Badge>
          </CardTitle>
          <CardDescription>
            Ask questions about your business data and get expert analysis
          </CardDescription>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col p-0">
          {/* Chat History */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
            {chatHistory.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <SemanticBDIIcon semantic="query" size={64} className="mx-auto mb-4 text-gray-300" />
                <p className="text-xl font-medium mb-2">Welcome to Ask BDI!</p>
                <p className="text-sm mb-6">Ask me anything about your business data, supply chain, or analytics.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left max-w-2xl mx-auto">
                  <div className="bg-white p-4 rounded-lg border">
                    <p className="font-medium text-gray-700 mb-2">📊 Business Questions</p>
                    <p className="text-xs text-gray-600">"What are our top performing SKUs?"</p>
                    <p className="text-xs text-gray-600">"How many SKUs are from MTN?"</p>
                    <p className="text-xs text-gray-600">"Show me invoice trends by organization"</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border">
                    <p className="font-medium text-gray-700 mb-2">🚢 Supply Chain Questions</p>
                    <p className="text-xs text-gray-600">"How are our shipments performing?"</p>
                    <p className="text-xs text-gray-600">"What's our forecast accuracy?"</p>
                    <p className="text-xs text-gray-600">"Which suppliers are most reliable?"</p>
                  </div>
                </div>
              </div>
            ) : (
              chatHistory.map((message) => (
                <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg p-4 ${
                    message.type === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white border border-gray-200 text-gray-900 shadow-sm'
                  }`}>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</div>
                    <div className={`text-xs mt-2 ${
                      message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}
            
            {/* Thinking indicator */}
            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="flex items-center space-x-3">
                    <SemanticBDIIcon semantic="loading" size={20} className="animate-spin text-blue-600" />
                    <span className="text-sm text-gray-600">BDI is analyzing your data...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Input Area */}
          <div className="border-t bg-white p-6">
            <div className="flex space-x-3">
              <div className="flex-1">
                <Input
                  placeholder="Ask a question about your business data..."
                  value={askBdiQuery}
                  onChange={(e) => setAskBdiQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && !isThinking && handleAskBDI()}
                  className="bg-white text-base"
                  disabled={isThinking}
                />
              </div>
              <Button 
                onClick={handleAskBDI} 
                disabled={!askBdiQuery.trim() || isThinking}
                className="bg-blue-600 hover:bg-blue-700 px-6"
              >
                {isThinking ? (
                  <SemanticBDIIcon semantic="loading" size={16} className="animate-spin" />
                ) : (
                  <>
                    <SemanticBDIIcon semantic="query" size={16} className="mr-2" />
                    Ask BDI
                  </>
                )}
              </Button>
            </div>
            
            <div className="mt-3 text-xs text-gray-500 flex items-center justify-between">
              <span>💡 Try asking about SKUs, forecasts, shipments, or financial data</span>
              <span>🔒 Super Admin Only</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
