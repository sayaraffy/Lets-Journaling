'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">Something went wrong</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {error.message || 'An unexpected error occurred. Please try again.'}
            </p>
          </div>
          <Button onClick={reset} className="gap-2">Try again</Button>
        </CardContent>
      </Card>
    </div>
  );
}
