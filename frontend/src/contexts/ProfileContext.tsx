import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { profilesApi } from '@/api/client';
import type { Profile } from '@/types';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------
interface ProfileContextValue {
  profiles: Profile[];
  loading: boolean;
  refetch: () => Promise<void>;
}

export const ProfileContext = createContext<ProfileContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
interface ProfileProviderProps {
  children: ReactNode;
}

export function ProfileProvider({ children }: ProfileProviderProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await profilesApi.getAll();
      setProfiles(data);
    } catch (err) {
      console.error('Failed to fetch profiles:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return (
    <ProfileContext.Provider value={{ profiles, loading, refetch }}>
      {children}
    </ProfileContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useProfiles(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error('useProfiles must be used within a ProfileProvider');
  }
  return ctx;
}
