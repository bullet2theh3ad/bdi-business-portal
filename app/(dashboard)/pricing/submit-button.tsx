'use client';

import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';

export function SubmitButton({ isCurrentPlan = false }: { isCurrentPlan?: boolean }) {
  const { pending } = useFormStatus();

  if (isCurrentPlan) {
    return (
      <Button
        type="button"
        disabled={true}
        variant="outline"
        className="w-full rounded-full bg-green-50 border-green-200 text-green-700"
      >
        Current Plan
      </Button>
    );
  }

  return (
    <Button
      type="submit"
      disabled={pending}
      variant="outline"
      className="w-full rounded-full"
    >
      {pending ? (
        <>
          <Loader2 className="animate-spin mr-2 h-4 w-4" />
          Loading...
        </>
      ) : (
        <>
          Get Started
          <ArrowRight className="ml-2 h-4 w-4" />
        </>
      )}
    </Button>
  );
}
