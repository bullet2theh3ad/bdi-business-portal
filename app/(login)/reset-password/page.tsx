'use client';

import { useState, useEffect, useActionState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { resetPassword, verifyResetToken } from '@/app/(login)/actions';
import { ActionState } from '@/lib/auth/middleware';
import Link from 'next/link';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams?.get('token') ?? null;

  const [resetState, resetAction, isResetPending] = useActionState<ActionState, FormData>(resetPassword, { error: '' });
  const [verificationState, setVerificationState] = useState<{
    loading: boolean;
    valid: boolean;
    error?: string;
    user?: { email: string; name: string | null };
  }>({ loading: true, valid: false });

  useEffect(() => {
    if (!token) {
      setVerificationState({
        loading: false,
        valid: false,
        error: 'No reset token provided'
      });
      return;
    }

    // Verify the token
    verifyResetToken(token)
      .then((result) => {
        if ('error' in result && result.error) {
          setVerificationState({
            loading: false,
            valid: false,
            error: result.error
          });
        } else if ('valid' in result && result.valid) {
          setVerificationState({
            loading: false,
            valid: true,
            user: undefined
          });
        } else {
          setVerificationState({
            loading: false,
            valid: false,
            error: 'Unexpected response format'
          });
        }
      })
      .catch(() => {
        setVerificationState({
          loading: false,
          valid: false,
          error: 'Failed to verify reset token'
        });
      });
  }, [token]);

  if (verificationState.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Verifying reset token...</p>
        </div>
      </div>
    );
  }

  if (!verificationState.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 flex items-center justify-center text-2xl">
              ❌
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Invalid Reset Link
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              {verificationState.error || 'This password reset link is invalid or has expired.'}
            </p>
          </div>
          
          <div className="flex justify-center space-x-4">
            <Link
              href="/forgot-password"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Request new reset link
            </Link>
            <Link
              href="/sign-in"
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (resetState?.success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 flex items-center justify-center text-2xl">
              ✅
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Password Reset Complete
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              {resetState.success}
            </p>
          </div>
          
          <div className="text-center">
            <Link
              href="/sign-in"
              className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 inline-block"
            >
              Sign in now
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center text-2xl">
            🔑
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Set new password
          </h2>
          {verificationState.user && (
            <p className="mt-2 text-center text-sm text-gray-600">
              Setting new password for{' '}
              <span className="font-medium">{verificationState.user.email}</span>
            </p>
          )}
        </div>

        <form className="mt-8 space-y-6" action={resetAction}>
          <input type="hidden" name="token" value={token || ''} />
          
          <div className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                New Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter new password (min. 8 characters)"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Confirm new password"
              />
            </div>
          </div>

          {resetState?.error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Error
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{resetState.error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isResetPending}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isResetPending ? 'Resetting password...' : 'Reset password'}
            </button>
          </div>

          <div className="flex items-center justify-center">
            <div className="text-sm">
              <Link
                href="/sign-in"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Back to sign in
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}