'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CircleIcon, Loader2 } from 'lucide-react';
import { signIn, signUp } from './actions';
import { ActionState } from '@/lib/auth/middleware';

export function Login({ mode = 'signin' }: { mode?: 'signin' | 'signup' }) {
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');
  const priceId = searchParams.get('priceId');
  const token = searchParams.get('token');
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    mode === 'signin' ? signIn : signUp,
    { error: '' }
  );

  // Check if this is an invitation signup
  const isInvitationSignup = mode === 'signup' && token;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gray-50">
      {/* Header with BDI Portal logo */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <Link href="/">
              <img 
                src="/logos/SVG/Full Lockup Color.svg" 
                alt="BDI Business Portal" 
                className="h-8"
              />
            </Link>
          </div>
        </div>
      </header>
      
      {/* Login form */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <img 
              src="/logos/SVG/Full Lockup Color.svg" 
              alt="BDI Business Portal" 
              className="h-16"
            />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {mode === 'signin'
              ? 'Sign in to your account'
              : isInvitationSignup
              ? 'Join Your Team on BDI Business Portal'
              : 'Create your account'}
          </h2>
          {isInvitationSignup && (
            <p className="mt-2 text-center text-sm text-gray-600">
              🎉 You've been invited to join a team! Just create your account below and you'll be automatically added.
            </p>
          )}
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <form className="space-y-6" action={formAction}>
            <input type="hidden" name="redirect" value={redirect || ''} />
            <input type="hidden" name="priceId" value={priceId || ''} />
            <input type="hidden" name="token" value={token || ''} />
            <div>
              <Label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email
              </Label>
              <div className="mt-1">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={50}
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-full focus:outline-none focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <Label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Password
              </Label>
              <div className="mt-1">
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={
                    mode === 'signin' ? 'current-password' : 'new-password'
                  }
                  required
                  minLength={8}
                  maxLength={100}
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-full focus:outline-none focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            {mode === 'signup' && (
              <>
                <div>
                  <Label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Name
                  </Label>
                  <div className="mt-1">
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      required
                      maxLength={50}
                      className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-full focus:outline-none focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm"
                      placeholder="Enter your name"
                    />
                  </div>
                </div>
                
                {isInvitationSignup ? (
                  <div>
                    <Label
                      htmlFor="organizationName"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Organization
                    </Label>
                    <div className="mt-1">
                      <Input
                        id="organizationName"
                        name="organizationName"
                        type="text"
                        value="Boundless Devices Inc"
                        disabled
                        className="appearance-none relative block w-full px-3 py-2 border border-gray-300 bg-gray-100 text-gray-700 rounded-full focus:outline-none sm:text-sm"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      You've been invited to join this organization
                    </p>
                  </div>
                ) : (
                  <div>
                    <Label
                      htmlFor="organizationName"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Organization Name
                    </Label>
                    <div className="mt-1">
                      <Input
                        id="organizationName"
                        name="organizationName"
                        type="text"
                        required
                        maxLength={100}
                        className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-full focus:outline-none focus:ring-bdi-green-1 focus:border-bdi-green-1 focus:z-10 sm:text-sm"
                        placeholder="Enter your organization name"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <div>
              <Button
                type="submit"
                disabled={pending}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-full text-white bg-bdi-green-1 hover:bg-bdi-green-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bdi-green-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'signin' 
                  ? 'Sign In' 
                  : isInvitationSignup 
                  ? 'Join Team' 
                  : 'Sign Up'}
              </Button>
            </div>

            {mode === 'signin' && (
              <div className="text-center">
                <Link
                  href="/forgot-password"
                  className="text-sm text-bdi-green-1 hover:text-bdi-green-2 font-medium"
                >
                  Forgot your password?
                </Link>
              </div>
            )}

            {state?.error && (
              <div className="text-red-600 text-sm mt-2">
                <span className="font-medium">Error:</span> {state.error}
              </div>
            )}
          </form>

          <div className="mt-6">
            <Link
              href={`${mode === 'signin' ? '/sign-up' : '/sign-in'}${
                redirect ? `?redirect=${redirect}` : ''
              }${priceId ? `&priceId=${priceId}` : ''}`}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-full shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bdi-green-1"
            >
              {mode === 'signin'
                ? 'Create an account'
                : 'Sign in to existing account'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
