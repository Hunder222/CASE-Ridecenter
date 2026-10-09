import type {
  DashboardNotifikation,
  Hestetildeling,
  KandidatHest,
  PubliceringSvar,
  SaertildelSvar,
  Tildelingskoersel,
} from '@ridecenter/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../faelles/api-klient';

// Hooks til Kabalen og notifikationer (T090). ApiFejl videregives uændret, så UI'et kan vise besked og detaljer.

export const kabaleNoegler = {
  koersler: (maaned: string) => ['koersler', maaned] as const,
  koersel: (id: string) => ['koersel', id] as const,
  kandidater: (koerselId: string, tildelingId: string) => ['kandidater', koerselId, tildelingId] as const,
  notifikationer: ['notifikationer'] as const,
};

export function useKoersler(maaned: string) {
  return useQuery({
    queryKey: kabaleNoegler.koersler(maaned),
    queryFn: () => api<Tildelingskoersel[]>(`/tildeling/koersler?maaned=${maaned}`),
  });
}

export function useKoersel(id: string | null) {
  return useQuery({
    queryKey: kabaleNoegler.koersel(id ?? ''),
    queryFn: () => api<Tildelingskoersel>(`/tildeling/koersler/${id}`),
    enabled: id !== null,
  });
}

export function useKoerTildeling() {
  const queryKlient = useQueryClient();
  return useMutation({
    mutationFn: (param: string | { maaned: string; reserverBegynderHeste?: boolean; reserverSpringHeste?: boolean }) => {
      const body = typeof param === 'string'
        ? { maaned: param }
        : {
            maaned: param.maaned,
            reserver_begynder_heste: param.reserverBegynderHeste,
            reserver_spring_heste: param.reserverSpringHeste,
          };
      return api<Tildelingskoersel>('/tildeling/koersler', { metode: 'POST', body });
    },
    onSuccess: (koersel) => {
      queryKlient.setQueryData(kabaleNoegler.koersel(koersel.id), koersel);
      void queryKlient.invalidateQueries({ queryKey: kabaleNoegler.koersler(koersel.maaned) });
      void queryKlient.invalidateQueries({ queryKey: kabaleNoegler.notifikationer });
    },
  });
}

export function useSaertildelAlle(koerselId: string) {
  const queryKlient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<SaertildelSvar>(`/tildeling/koersler/${koerselId}/saertildel-alle`, {
        metode: 'POST',
      }),
    onSuccess: (svar) => {
      queryKlient.setQueryData(kabaleNoegler.koersel(koerselId), svar.koersel);
      void queryKlient.invalidateQueries({ queryKey: kabaleNoegler.koersler(svar.koersel.maaned) });
    },
  });
}

export function useKandidater(koerselId: string, tildelingId: string) {
  return useQuery({
    queryKey: kabaleNoegler.kandidater(koerselId, tildelingId),
    queryFn: () =>
      api<KandidatHest[]>(`/tildeling/koersler/${koerselId}/tildelinger/${tildelingId}/kandidater`),
    staleTime: 0,
  });
}

export function useJusterTildeling(koerselId: string) {
  const queryKlient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tildelingId,
      hestId,
      tilladNiveauDispensation,
    }: {
      tildelingId: string;
      hestId: string;
      tilladNiveauDispensation?: boolean;
    }) =>
      api<Hestetildeling>(`/tildeling/koersler/${koerselId}/tildelinger/${tildelingId}`, {
        metode: 'PATCH',
        body: tilladNiveauDispensation
          ? { hest_id: hestId, tillad_niveau_dispensation: true }
          : { hest_id: hestId },
      }),
    onSuccess: () => {
      void queryKlient.invalidateQueries({ queryKey: kabaleNoegler.koersel(koerselId) });
      void queryKlient.invalidateQueries({ queryKey: ['kandidater', koerselId] });
      void queryKlient.invalidateQueries({ queryKey: kabaleNoegler.notifikationer });
    },
  });
}

function useStatusskift<T>(handling: 'godkend' | 'publicer') {
  const queryKlient = useQueryClient();
  return useMutation({
    mutationFn: (koerselId: string) =>
      api<T>(`/tildeling/koersler/${koerselId}/${handling}`, { metode: 'POST' }),
    onSuccess: (_svar, koerselId) => {
      void queryKlient.invalidateQueries({ queryKey: kabaleNoegler.koersel(koerselId) });
      void queryKlient.invalidateQueries({ queryKey: ['koersler'] });
    },
  });
}

export function useGodkend() {
  const queryKlient = useQueryClient();
  return useMutation({
    mutationFn: (param: string | { id: string; tilladNiveauDispensation?: boolean }) => {
      const id = typeof param === 'string' ? param : param.id;
      const body = typeof param === 'object' && param.tilladNiveauDispensation
        ? { tillad_niveau_dispensation: true }
        : {};
      return api<Tildelingskoersel>(`/tildeling/koersler/${id}/godkend`, {
        metode: 'POST',
        body,
      });
    },
    onSuccess: (_svar, param) => {
      const id = typeof param === 'string' ? param : param.id;
      void queryKlient.invalidateQueries({ queryKey: kabaleNoegler.koersel(id) });
      void queryKlient.invalidateQueries({ queryKey: ['koersler'] });
    },
  });
}

export const usePublicer = () => useStatusskift<PubliceringSvar>('publicer');

export function useNotifikationer(aktiv = true) {
  return useQuery({
    queryKey: kabaleNoegler.notifikationer,
    queryFn: () => api<DashboardNotifikation[]>('/notifikationer'),
    enabled: aktiv,
  });
}

export function useKvitter() {
  const queryKlient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/notifikationer/${id}/kvitter`, { metode: 'POST' }),
    onSuccess: () => queryKlient.invalidateQueries({ queryKey: kabaleNoegler.notifikationer }),
  });
}
