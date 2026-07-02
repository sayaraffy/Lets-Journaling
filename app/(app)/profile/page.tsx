'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';

export default function ProfileRedirectPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (profile?.username) {
      router.replace(`/profile/${profile.username}`);
    } else {
      router.replace('/profile/edit');
    }
  }, [profile, loading, router]);

  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-pulse-soft rounded-full bg-primary/20" />
    </div>
  );
}
