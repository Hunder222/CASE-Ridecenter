import type { Rolle, Session } from '@ridecenter/contracts';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { api, ApiFejl } from './api-klient';
import { Indlaeser } from './ui/Indlaeser';

export const SESSION_NOEGLE = ['session'] as const;

/** Aktuel session, eller null hvis brugeren ikke er logget ind. */
export function useSession() {
  return useQuery({
    queryKey: SESSION_NOEGLE,
    queryFn: async (): Promise<Session | null> => {
      try {
        return await api<Session>('/auth/session');
      } catch (fejl) {
        if (fejl instanceof ApiFejl && fejl.status === 401) return null;
        throw fejl;
      }
    },
    staleTime: 60_000,
  });
}

export function harRolle(session: Session | null | undefined, ...roller: Rolle[]): boolean {
  return !!session && session.roller.some((rolle) => roller.includes(rolle));
}

/** Viser børnene, hvis brugeren er logget ind og (evt.) har en af rollerne. */
export function KraevRolle({ roller, children }: { roller?: Rolle[]; children: ReactNode }) {
  const { data: session, isPending } = useSession();
  const placering = useLocation();

  if (isPending) return <Indlaeser />;
  if (!session) return <Navigate to="/admin/login" replace state={{ fra: placering.pathname }} />;
  if (roller && !harRolle(session, ...roller)) {
    return (
      <p role="alert" className="text-red-900">
        Du har ikke adgang til denne side.
      </p>
    );
  }
  return <>{children}</>;
}
