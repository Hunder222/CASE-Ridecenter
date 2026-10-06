import { useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { api } from '../faelles/api-klient';
import { naesteMaaned } from '../faelles/maaned';
import { harRolle, SESSION_NOEGLE, useSession } from '../faelles/session';
import { Knap } from '../faelles/ui/Knap';

function linkStil({ isActive }: { isActive: boolean }): string {
  return `rounded px-2 py-1 ${isActive ? 'bg-emerald-100 font-semibold text-emerald-900' : 'text-stone-800 hover:bg-stone-100'}`;
}

export function AdminLayout() {
  const { data: session } = useSession();
  const queryKlient = useQueryClient();
  const navigate = useNavigate();
  const erLedelse = harRolle(session, 'Ledelse');
  const maaned = naesteMaaned();

  async function logUd() {
    await api('/auth/logout', { metode: 'POST' });
    queryKlient.setQueryData(SESSION_NOEGLE, null);
    navigate('/admin/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-300 bg-white">
        <nav aria-label="Hovedmenu" className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-6 py-3">
          <span className="text-lg font-semibold">Bøgegården</span>
          <ul className="flex flex-wrap gap-2">
            <li>
              <NavLink to={`/admin/kabale/${maaned}`} className={linkStil}>
                Kabale
              </NavLink>
            </li>
            <li>
              <NavLink to={`/admin/oensker/${maaned}`} className={linkStil}>
                Ønsker
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/heste" className={linkStil}>
                Heste
              </NavLink>
            </li>
            {erLedelse && (
              <>
                <li>
                  <NavLink to="/admin/ryttere" className={linkStil}>
                    Ryttere
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/admin/notifikationer" className={linkStil}>
                    Notifikationer
                  </NavLink>
                </li>
              </>
            )}
          </ul>
          <div className="ml-auto flex items-center gap-3">
            <span>{session?.navn}</span>
            <Knap variant="sekundaer" onClick={logUd}>
              Log ud
            </Knap>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
