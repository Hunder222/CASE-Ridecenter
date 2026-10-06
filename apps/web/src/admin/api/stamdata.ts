import type {
  Elevoenske,
  Hest,
  HestInput,
  HestOpdatering,
  Hold,
  OenskerPut,
  Rytter,
  RytterOpdatering,
  Sikkerhedsprofil,
  SikkerhedsprofilInput,
} from '@ridecenter/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../faelles/api-klient';

// TanStack Query-hooks til stamdata og ønsker (T089). Mutationer invaliderer de berørte queries.

export const stamdataNoegler = {
  heste: ['heste'] as const,
  hold: ['hold'] as const,
  ryttere: ['ryttere'] as const,
  sikkerhedsprofil: (rytterId: string) => ['sikkerhedsprofil', rytterId] as const,
  oensker: (maaned: string) => ['oensker', maaned] as const,
};

export function useHeste() {
  return useQuery({ queryKey: stamdataNoegler.heste, queryFn: () => api<Hest[]>('/heste') });
}

export function useOpretHest() {
  const queryKlient = useQueryClient();
  return useMutation({
    mutationFn: (input: HestInput) => api<Hest>('/heste', { metode: 'POST', body: input }),
    onSuccess: () => queryKlient.invalidateQueries({ queryKey: stamdataNoegler.heste }),
  });
}

export function useOpdaterHest() {
  const queryKlient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, aendring }: { id: string; aendring: HestOpdatering }) =>
      api<Hest>(`/heste/${id}`, { metode: 'PATCH', body: aendring }),
    onSuccess: () => queryKlient.invalidateQueries({ queryKey: stamdataNoegler.heste }),
  });
}

export function useHold() {
  return useQuery({ queryKey: stamdataNoegler.hold, queryFn: () => api<Hold[]>('/hold') });
}

export function useRyttere() {
  return useQuery({ queryKey: stamdataNoegler.ryttere, queryFn: () => api<Rytter[]>('/ryttere') });
}

/** Der findes ingen GET /ryttere/{id}, så rytteren slås op i listen (samme cache). */
export function useRytter(id: string | undefined) {
  return useQuery({
    queryKey: stamdataNoegler.ryttere,
    queryFn: () => api<Rytter[]>('/ryttere'),
    select: (ryttere) => ryttere.find((r) => r.id === id),
  });
}

export function useOpdaterRytter() {
  const queryKlient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, aendring }: { id: string; aendring: RytterOpdatering }) =>
      api<Rytter>(`/ryttere/${id}`, { metode: 'PATCH', body: aendring }),
    onSuccess: () => queryKlient.invalidateQueries({ queryKey: stamdataNoegler.ryttere }),
  });
}

/** Art. 9-data: hver læsning auditlogges, så profilen hentes én gang og forlader cachen med siden. */
export function useSikkerhedsprofil(rytterId: string) {
  return useQuery({
    queryKey: stamdataNoegler.sikkerhedsprofil(rytterId),
    queryFn: () => api<Sikkerhedsprofil>(`/ryttere/${rytterId}/sikkerhedsprofil`),
    staleTime: Infinity,
    gcTime: 0,
  });
}

export function useGemSikkerhedsprofil(rytterId: string) {
  const queryKlient = useQueryClient();
  return useMutation({
    mutationFn: (profil: SikkerhedsprofilInput) =>
      api<Sikkerhedsprofil>(`/ryttere/${rytterId}/sikkerhedsprofil`, { metode: 'PUT', body: profil }),
    onSuccess: (profil) => queryKlient.setQueryData(stamdataNoegler.sikkerhedsprofil(rytterId), profil),
  });
}

export function useOensker(maaned: string) {
  return useQuery({
    queryKey: stamdataNoegler.oensker(maaned),
    queryFn: () => api<Elevoenske[]>(`/oensker/${maaned}`),
  });
}

export function useGemOensker(maaned: string) {
  const queryKlient = useQueryClient();
  return useMutation({
    mutationFn: (oensker: OenskerPut) => api<void>(`/oensker/${maaned}`, { metode: 'PUT', body: oensker }),
    onSuccess: () => queryKlient.invalidateQueries({ queryKey: stamdataNoegler.oensker(maaned) }),
  });
}
