import type { Session } from '@ridecenter/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { api, ApiFejl } from '../faelles/api-klient';
import { SESSION_NOEGLE, useSession } from '../faelles/session';
import { Knap } from '../faelles/ui/Knap';

const feltStil =
  'mt-1 block w-full rounded border border-stone-400 px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-emerald-700';

export function LoginSide() {
  const { data: session } = useSession();
  const queryKlient = useQueryClient();
  const navigate = useNavigate();

  const login = useMutation({
    mutationFn: (data: { email: string; adgangskode: string }) =>
      api<Session>('/auth/web/login', { metode: 'POST', body: data }),
    onSuccess: (nySession) => {
      queryKlient.setQueryData(SESSION_NOEGLE, nySession);
      navigate('/admin', { replace: true });
    },
  });

  if (session) return <Navigate to="/admin" replace />;

  function indsend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const felter = new FormData(event.currentTarget);
    login.mutate({
      email: String(felter.get('email') ?? ''),
      adgangskode: String(felter.get('adgangskode') ?? ''),
    });
  }

  const fejltekst =
    login.error instanceof ApiFejl && login.error.status >= 500
      ? 'Serveren svarer ikke. Prøv igen om lidt.'
      : 'Forkert e-mail eller adgangskode';

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <form
        onSubmit={indsend}
        className="w-full max-w-sm space-y-4 rounded-lg border border-stone-300 bg-white p-6 shadow-sm"
      >
        <h1 className="text-xl font-semibold">Log ind – Bøgegården</h1>
        <label className="block">
          <span className="font-medium">E-mail</span>
          <input name="email" type="email" autoComplete="username" required className={feltStil} />
        </label>
        <label className="block">
          <span className="font-medium">Adgangskode</span>
          <input
            name="adgangskode"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            className={feltStil}
          />
        </label>
        {login.isError && (
          <p role="alert" className="text-red-800">
            {fejltekst}
          </p>
        )}
        <Knap type="submit" disabled={login.isPending} className="w-full">
          {login.isPending ? 'Logger ind…' : 'Log ind'}
        </Knap>
      </form>
    </main>
  );
}
