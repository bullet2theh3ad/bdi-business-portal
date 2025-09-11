'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Brain, FileSearch, Database, Zap, Clock } from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AskBDIPage() {
  const { data: user } = useSWR('/api/user', fetcher);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [progress, setProgress] = useState<string>('');
  const [startTime, setStartTime] = useState<number | null>(null);

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
    setResponse('');

    try {
      // Simulate progress updates
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
          question,
          context: { currentPage: 'ask-bdi', timestamp: new Date().toISOString() },
          chatHistory
        })
      });

      const data = await res.json();
      
      if (data.error) {
        setResponse(`Error: ${data.error}`);
      } else {
        setResponse(data.answer);
        setChatHistory(prev => [...prev, 
          { type: 'user', content: question, timestamp: new Date().toISOString() },
          { type: 'assistant', content: data.answer, timestamp: new Date().toISOString() }
        ]);
      }
    } catch (error) {
      setResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
      setProgress('');
      setStartTime(null);
      setQuestion('');
    }
  };

  const getElapsedTime = () => {
    if (!startTime) return '';
    return Math.round((Date.now() - startTime) / 1000);
  };

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Brain className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Ask BDI - AI Business Intelligence</h1>
        </div>
        <p className="text-muted-foreground">
          Advanced AI assistant with complete access to database + document intelligence
        </p>
      </div>

      <div className="grid gap-6">
        {/* Query Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Ask Your Question
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g., How many files do we have? What's in the MTN invoices? Show me financial models..."
                disabled={isLoading}
                className="text-lg p-4"
              />
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setQuestion('List all files available to us')}
                    disabled={isLoading}
                  >
                    <FileSearch className="h-4 w-4 mr-1" />
                    List Files
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setQuestion('What financial models do we have?')}
                    disabled={isLoading}
                  >
                    <Database className="h-4 w-4 mr-1" />
                    Financial Models
                  </Button>
                </div>
                <Button type="submit" disabled={isLoading || !question.trim()}>
                  {isLoading ? 'Processing...' : 'Ask BDI'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Progress Indicator */}
        {isLoading && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <Clock className="h-5 w-5 animate-spin" />
                  <span className="font-medium">Processing Your Request</span>
                  {startTime && (
                    <span className="text-muted-foreground">({getElapsedTime()}s)</span>
                  )}
                </div>
                {progress && (
                  <p className="text-sm text-blue-600">{progress}</p>
                )}
                <div className="w-full bg-gray-200 rounded-full h-2 max-w-md mx-auto">
                  <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{
                    width: startTime ? `${Math.min((Date.now() - startTime) / 1200, 100)}%` : '0%'
                  }}></div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Analyzing {user?.name ? `for ${user.name}` : 'business data'} • Advanced AI processing
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Response */}
        {response && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-green-600" />
                BDI Intelligence Response
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded border">
                  {response}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle>🎯 System Capabilities</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-semibold">📊 Database Access:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Complete CPFR system data</li>
                  <li>Financial records and forecasts</li>
                  <li>Inventory and warehouse data</li>
                  <li>Organization and user management</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold">📄 Document Intelligence:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>RAG uploaded documents with tagging</li>
                  <li>Invoice and purchase order analysis</li>
                  <li>Production files and specifications</li>
                  <li>Shipment reports and logistics data</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}