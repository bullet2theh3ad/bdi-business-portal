'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Brain, FileSearch, Database, Zap, Clock, Trash2 } from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AskBDIPage() {
  const { data: user } = useSWR('/api/user', fetcher);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [progress, setProgress] = useState<string>('');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [queryScope, setQueryScope] = useState<'database' | 'rag' | 'all'>('all'); // Default to all sources
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const clearChat = () => {
    setChatHistory([]);
  };

  // Access control check
  if (!user || user.role !== 'super_admin') {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              <Brain className="w-12 h-12 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p>Only Super Admins can access Ask BDI.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setIsLoading(true);
    setStartTime(Date.now());
    setProgress('🧠 Initializing AI analysis...');
    
    // Add user question to chat history immediately
    const userMessage = {
      type: 'user',
      content: question,
      timestamp: new Date().toISOString()
    };
    setChatHistory(prev => [...prev, userMessage]);
    const currentQuestion = question;
    setQuestion(''); // Clear input immediately

    try {
      // Progress updates for user feedback
      const progressUpdates = [
        { delay: 500, message: '📊 Gathering business context...' },
        { delay: 2000, message: '📁 Scanning document storage...' },
        { delay: 5000, message: '🔍 Analyzing file contents...' },
        { delay: 10000, message: '🧠 Processing with AI intelligence...' },
        { delay: 20000, message: '⚡ Generating comprehensive response...' }
      ];

      // Start progress simulation
      progressUpdates.forEach(({ delay, message }) => {
        setTimeout(() => {
          if (isLoading) {
            const elapsed = Date.now() - (startTime || Date.now());
            setProgress(`${message} (${Math.round(elapsed / 1000)}s)`);
          }
        }, delay);
      });

      const res = await fetch('/api/admin/ask-bdi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQuestion,
          queryScope: queryScope, // Pass optimization scope to backend
          context: { currentPage: 'ask-bdi', timestamp: new Date().toISOString() },
          chatHistory
        })
      });

      const data = await res.json();
      
      if (data.error) {
        const errorMessage = {
          type: 'assistant',
          content: `Error: ${data.error}`,
          timestamp: new Date().toISOString(),
          isError: true
        };
        setChatHistory(prev => [...prev, errorMessage]);
      } else {
        const assistantMessage = {
          type: 'assistant',
          content: data.answer,
          timestamp: new Date().toISOString()
        };
        setChatHistory(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      const errorMessage = {
        type: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        isError: true
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setProgress('');
      setStartTime(null);
    }
  };

  const getElapsedTime = () => {
    if (!startTime) return '';
    return Math.round((Date.now() - startTime) / 1000);
  };

  return (
    <div className="container mx-auto py-4 px-4 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Brain className="h-6 w-6 md:h-8 md:w-8 text-blue-600" />
          <h1 className="text-xl md:text-3xl font-bold">Ask BDI</h1>
        </div>
        <p className="text-sm md:text-base text-muted-foreground">
          AI assistant with database + document intelligence
        </p>
      </div>

      <div className="space-y-4">
        {/* Chat History Stream */}
        {chatHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-green-600" />
                  BDI Intelligence Chat Stream ({chatHistory.length} messages)
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={clearChat}
                  className="flex items-center gap-1"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                {chatHistory.map((message, index) => (
                  <div
                    key={index}
                    className={`p-3 md:p-4 rounded-lg ${
                      message.type === 'user'
                        ? 'bg-blue-50 border-l-4 border-blue-500'
                        : message.isError
                        ? 'bg-red-50 border-l-4 border-red-500'
                        : 'bg-gray-50 border-l-4 border-green-500'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {message.type === 'user' ? (
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 md:w-6 md:h-6 bg-blue-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs font-bold">
                              {user?.name?.charAt(0) || 'U'}
                            </span>
                          </div>
                          <span className="text-sm md:text-base font-semibold text-blue-700">You</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Brain className={`w-4 h-4 md:w-5 md:h-5 ${message.isError ? 'text-red-600' : 'text-green-600'}`} />
                          <span className={`text-sm md:text-base font-semibold ${message.isError ? 'text-red-700' : 'text-green-700'}`}>
                            BDI AI
                          </span>
                        </div>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="prose max-w-none">
                      <pre className="whitespace-pre-wrap text-xs md:text-sm break-words">
                        {message.content}
                      </pre>
                    </div>
                  </div>
                ))}
                
                {/* Integrated processing indicator in chat stream */}
                {isLoading && (
                  <div className="p-3 md:p-4 rounded-lg bg-yellow-50 border-l-4 border-yellow-500">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 md:w-5 md:h-5 text-yellow-600 animate-spin" />
                      <span className="text-sm md:text-base font-semibold text-yellow-700">BDI AI</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {startTime && `${getElapsedTime()}s`}
                      </span>
                    </div>
                    <p className="text-xs md:text-sm text-yellow-700">
                      {progress || 'Processing your request...'}
                    </p>
                  </div>
                )}
                
                {/* Auto-scroll anchor */}
                <div ref={chatEndRef} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Query Input - Always at bottom for mobile UX */}
        <Card>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about files, financials, CPFR data..."
                disabled={isLoading}
                className="text-sm md:text-base p-3 md:p-4"
              />
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex flex-wrap gap-2">
                  {/* Query Optimization Buttons */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setQueryScope('database');
                      // Keep existing question but optimize for DB only
                    }}
                    disabled={isLoading}
                    className={`text-xs md:text-sm transition-all ${
                      queryScope === 'database' 
                        ? 'bg-blue-100 border-blue-300 text-blue-800 shadow-md' 
                        : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                    }`}
                    title="Search database only (Invoices, POs, SKUs, Shipments) - Fast response"
                  >
                    <Database className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                    📊 DB
                    <span className="ml-1 text-xs opacity-75">(Fast)</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setQueryScope('rag');
                      // Keep existing question but optimize for RAG only
                    }}
                    disabled={isLoading}
                    className={`text-xs md:text-sm transition-all ${
                      queryScope === 'rag' 
                        ? 'bg-orange-100 border-orange-300 text-orange-800 shadow-md' 
                        : 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100'
                    }`}
                    title="Search RAG documents only - May take time for comprehensive document analysis"
                  >
                    <FileSearch className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                    📁 RAG
                    <span className="ml-1 text-xs opacity-75">(May take time...)</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setQueryScope('all');
                      // Keep existing question but use all sources
                    }}
                    disabled={isLoading}
                    className={`text-xs md:text-sm transition-all ${
                      queryScope === 'all' 
                        ? 'bg-green-100 border-green-300 text-green-800 shadow-md' 
                        : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                    }`}
                    title="Search all sources (Database + RAG documents) - Comprehensive but may take time"
                  >
                    <Database className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                    🔄 ALL
                    <span className="ml-1 text-xs opacity-75">(Comprehensive, may take time...)</span>
                  </Button>
                </div>
                <Button 
                  type="submit" 
                  disabled={isLoading || !question.trim()}
                  className="w-full sm:w-auto"
                >
                  {isLoading ? 'Processing...' : 'Ask BDI'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}