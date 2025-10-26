'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Save, AlertCircle, CheckCircle, MessageSquare, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function WhatsAppSettingsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [config, setConfig] = useState({
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioWhatsappNumber: '',
    isEnabled: false,
    dailyMessageLimit: 1000,
  });

  const [testPhone, setTestPhone] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/whatsapp-config');
      if (response.ok) {
        const data = await response.json();
        if (data.config) {
          setConfig({
            twilioAccountSid: data.config.twilioAccountSid || '',
            twilioAuthToken: data.config.twilioAuthToken || '',
            twilioWhatsappNumber: data.config.twilioWhatsappNumber || '',
            isEnabled: data.config.isEnabled || false,
            dailyMessageLimit: data.config.dailyMessageLimit || 1000,
          });
        }
      }
    } catch (error) {
      console.error('Error loading config:', error);
      setError('Failed to load WhatsApp configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/admin/whatsapp-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save configuration');
      }

      setSuccess('WhatsApp configuration saved successfully!');
      setTimeout(() => setSuccess(null), 5000);
    } catch (error: any) {
      setError(error.message || 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestMessage = async () => {
    if (!testPhone) {
      setError('Please enter a phone number to test');
      return;
    }

    try {
      setIsTesting(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/admin/whatsapp-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: testPhone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send test message');
      }

      setSuccess(`Test message sent successfully! Message SID: ${data.messageSid}`);
      setTestPhone('');
    } catch (error: any) {
      setError(error.message || 'Failed to send test message');
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">WhatsApp Integration Settings</h1>
        <p className="text-muted-foreground">
          Configure Twilio WhatsApp integration for sending notifications via WhatsApp
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 border-green-500 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-600">{success}</AlertDescription>
        </Alert>
      )}

      {/* Setup Instructions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Setup Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            <strong>Step 1:</strong> Create a Twilio account at{' '}
            <a
              href="https://www.twilio.com/try-twilio"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              twilio.com/try-twilio
            </a>
          </div>
          <div>
            <strong>Step 2:</strong> Register your WhatsApp Business Profile through Twilio's dashboard
          </div>
          <div>
            <strong>Step 3:</strong> Get your Account SID and Auth Token from the Twilio Console
          </div>
          <div>
            <strong>Step 4:</strong> Use the Twilio Sandbox for testing, or request a production WhatsApp number
          </div>
          <div>
            <strong>Step 5:</strong> Enter your credentials below and test the integration
          </div>
        </CardContent>
      </Card>

      {/* Configuration Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Twilio Configuration</CardTitle>
          <CardDescription>
            Enter your Twilio credentials. These will be stored securely.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Switch */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enabled">Enable WhatsApp Integration</Label>
              <div className="text-sm text-muted-foreground">
                Turn on/off WhatsApp notifications globally
              </div>
            </div>
            <Switch
              id="enabled"
              checked={config.isEnabled}
              onCheckedChange={(checked) =>
                setConfig({ ...config, isEnabled: checked })
              }
            />
          </div>

          <Separator />

          {/* Twilio Account SID */}
          <div className="space-y-2">
            <Label htmlFor="accountSid">
              Twilio Account SID <span className="text-red-500">*</span>
            </Label>
            <Input
              id="accountSid"
              type="text"
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={config.twilioAccountSid}
              onChange={(e) =>
                setConfig({ ...config, twilioAccountSid: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Found in your Twilio Console dashboard
            </p>
          </div>

          {/* Twilio Auth Token */}
          <div className="space-y-2">
            <Label htmlFor="authToken">
              Twilio Auth Token <span className="text-red-500">*</span>
            </Label>
            <Input
              id="authToken"
              type="password"
              placeholder="••••••••••••••••••••••••••••••••"
              value={config.twilioAuthToken}
              onChange={(e) =>
                setConfig({ ...config, twilioAuthToken: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Found in your Twilio Console dashboard (keep this secret!)
            </p>
          </div>

          {/* WhatsApp Number */}
          <div className="space-y-2">
            <Label htmlFor="whatsappNumber">
              WhatsApp Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="whatsappNumber"
              type="text"
              placeholder="+14155238886"
              value={config.twilioWhatsappNumber}
              onChange={(e) =>
                setConfig({ ...config, twilioWhatsappNumber: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Your Twilio WhatsApp number in E.164 format (e.g., +14155238886 for sandbox)
            </p>
          </div>

          {/* Daily Message Limit */}
          <div className="space-y-2">
            <Label htmlFor="dailyLimit">Daily Message Limit</Label>
            <Input
              id="dailyLimit"
              type="number"
              min="1"
              max="10000"
              value={config.dailyMessageLimit}
              onChange={(e) =>
                setConfig({
                  ...config,
                  dailyMessageLimit: parseInt(e.target.value) || 1000,
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Maximum number of WhatsApp messages to send per day
            </p>
          </div>

          {/* Save Button */}
          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Configuration
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Test Message */}
      <Card>
        <CardHeader>
          <CardTitle>Test Integration</CardTitle>
          <CardDescription>
            Send a test WhatsApp message to verify your configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="testPhone">Test Phone Number</Label>
            <Input
              id="testPhone"
              type="tel"
              placeholder="+1234567890"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Enter a phone number in E.164 format (e.g., +1234567890)
              {config.twilioWhatsappNumber.includes('14155238886') && (
                <span className="block mt-1 text-orange-600">
                  Note: For Twilio Sandbox, you must first join the sandbox by sending "join [your-sandbox-keyword]" to +14155238886 from WhatsApp
                </span>
              )}
            </p>
          </div>

          <Button
            onClick={handleTestMessage}
            disabled={isTesting || !config.isEnabled}
            variant="outline"
            className="w-full"
          >
            {isTesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <MessageSquare className="mr-2 h-4 w-4" />
                Send Test Message
              </>
            )}
          </Button>

          {!config.isEnabled && (
            <p className="text-xs text-orange-600">
              WhatsApp integration is currently disabled. Enable it above to send test messages.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

