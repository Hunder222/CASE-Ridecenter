import { useQueryClient } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { api } from '../faelles/api-klient';
import { naesteMaaned } from '../faelles/maaned';
import { harRolle, SESSION_NOEGLE, useSession } from '../faelles/session';
import { Knap } from '../faelles/ui/Knap';
import { useNotifikationer } from './api/kabale';

function dropdownItemStil({ isActive }: { isActive: boolean }): string {
  return `flex items-center px-3 py-2 text-sm rounded-lg transition ${
    isActive
      ? 'bg-emerald-50 text-emerald-900 font-semibold'
      : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
  }`;
}

export function AdminLayout() {
  const { data: session } = useSession();
  const queryKlient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const erLedelse = harRolle(session, 'Ledelse');
  const maaned = naesteMaaned();
  const notifikationer = useNotifikationer(erLedelse);
  const ukvitterede = notifikationer.data?.filter((n) => !n.kvitteret).length ?? 0;

  async function logUd() {
    await api('/auth/logout', { metode: 'POST' });
    queryKlient.setQueryData(SESSION_NOEGLE, null);
    navigate('/admin/login', { replace: true });
  }

  const erKabaleAktiv =
    location.pathname.includes('/admin/kabale') ||
    location.pathname.includes('/admin/oensker') ||
    location.pathname.includes('/admin/venteliste');

  const erDriftAktiv =
    location.pathname.includes('/admin/heste') ||
    location.pathname.includes('/admin/hold') ||
    location.pathname.includes('/admin/ryttere');

  const erRapporterKontrolAktiv =
    location.pathname.includes('/admin/rapporter') ||
    location.pathname.includes('/admin/audit') ||
    location.pathname.includes('/admin/vikarkoder');

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur-xs shadow-xs">
        <nav aria-label="Hovedmenu" className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-2.5">
          {/* Logo & Hovedgrupper */}
          <div className="flex items-center gap-6">
            <Link
              to="/admin"
              className="flex items-center gap-2 font-bold text-lg text-emerald-900 hover:text-emerald-700 transition"
              title="Gå til Ledelsesoverblik / Forside"
            >
              <span className="text-xl">🐴</span>
              <span className="tracking-tight">Bøgegården</span>
            </Link>

            <ul className="flex items-center gap-1">
              {/* Ledelsesoverblik direkte knap hvis ledelse */}
              {erLedelse && (
                <li>
                  <NavLink
                    to="/admin/dashboard"
                    className={({ isActive }) =>
                      `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                        isActive
                          ? 'bg-emerald-100 text-emerald-900 font-semibold'
                          : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                      }`
                    }
                  >
                    <span>Overblik</span>
                  </NavLink>
                </li>
              )}

              {/* Drift & Stald Dropdown */}
              <li className="relative group">
                <button
                  type="button"
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition cursor-pointer ${
                    erDriftAktiv
                      ? 'bg-emerald-50 text-emerald-900 font-semibold ring-1 ring-emerald-200'
                      : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  <span>Drift & Stald</span>
                  <span className="text-[10px] text-stone-400 group-hover:rotate-180 transition-transform">▼</span>
                </button>
                <div className="invisible group-hover:visible group-focus-within:visible opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-150 absolute left-0 top-full pt-1.5 z-50 w-48">
                  <div className="rounded-xl border border-stone-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 space-y-0.5">
                    <NavLink to="/admin/heste" className={dropdownItemStil}>
                      🐴 Heste
                    </NavLink>
                    <NavLink to="/admin/hold" className={dropdownItemStil}>
                      👥 Hold
                    </NavLink>
                    {erLedelse && (
                      <NavLink to="/admin/ryttere" className={dropdownItemStil}>
                        🏇 Ryttere
                      </NavLink>
                    )}
                  </div>
                </div>
              </li>

              {/* Kabale & Tildeling Dropdown */}
              <li className="relative group">
                <button
                  type="button"
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition cursor-pointer ${
                    erKabaleAktiv
                      ? 'bg-emerald-50 text-emerald-900 font-semibold ring-1 ring-emerald-200'
                      : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  <span>Kabale & Tildeling</span>
                  <span className="text-[10px] text-stone-400 group-hover:rotate-180 transition-transform">▼</span>
                </button>
                <div className="invisible group-hover:visible group-focus-within:visible opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-150 absolute left-0 top-full pt-1.5 z-50 w-52">
                  <div className="rounded-xl border border-stone-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 space-y-0.5">
                    <NavLink to={`/admin/kabale/${maaned}`} className={dropdownItemStil}>
                      🧩 Månedskabale
                    </NavLink>
                    <NavLink to={`/admin/oensker/${maaned}`} className={dropdownItemStil}>
                      ⭐ Elevønsker
                    </NavLink>
                    {erLedelse && (
                      <NavLink to="/admin/venteliste" className={dropdownItemStil}>
                        📋 Venteliste
                      </NavLink>
                    )}
                  </div>
                </div>
              </li>

              {/* Ledelse & Rapporter Dropdown (kun ledelse) */}
              {erLedelse && (
                <li className="relative group">
                  <button
                    type="button"
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition cursor-pointer ${
                      erRapporterKontrolAktiv
                        ? 'bg-emerald-50 text-emerald-900 font-semibold ring-1 ring-emerald-200'
                        : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                    }`}
                  >
                    <span>Rapporter & Kontrol</span>
                    <span className="text-[10px] text-stone-400 group-hover:rotate-180 transition-transform">▼</span>
                  </button>
                  <div className="invisible group-hover:visible group-focus-within:visible opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-150 absolute left-0 top-full pt-1.5 z-50 w-48">
                    <div className="rounded-xl border border-stone-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 space-y-0.5">
                      <NavLink to="/admin/rapporter" className={dropdownItemStil}>
                        📊 Rapporter & KPI
                      </NavLink>
                      <NavLink to="/admin/vikarkoder" className={dropdownItemStil}>
                        🔑 Vikarkoder
                      </NavLink>
                      <NavLink to="/admin/audit" className={dropdownItemStil}>
                        🛡️ Auditlog
                      </NavLink>
                    </div>
                  </div>
                </li>
              )}
            </ul>
          </div>

          {/* Højre side: Hurtiglink til stald, notifikationsklokke og bruger */}
          <div className="flex items-center gap-3">
            <Link
              to="/stald"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 hover:text-stone-900 transition"
              title="Åbn Stald Tablet i en ny fane"
            >
              <span>📱</span>
              <span>Staldtablet</span>
              <span className="text-[10px] text-stone-400">↗</span>
            </Link>

            {/* Notifikationer klokke-symbol i hjørnet */}
            {erLedelse && (
              <NavLink
                to="/admin/notifikationer"
                className={({ isActive }) =>
                  `relative flex items-center justify-center rounded-lg p-2 transition ${
                    isActive
                      ? 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300'
                      : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                  }`
                }
                title="Notifikationer"
                aria-label={`Notifikationer (${ukvitterede} ukvitterede)`}
              >
                <span className="text-lg">🔔</span>
                {ukvitterede > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                    {ukvitterede}
                  </span>
                )}
              </NavLink>
            )}

            <div className="flex items-center gap-3 border-l border-stone-200 pl-3">
              <div className="hidden md:block text-right">
                <span className="block text-xs font-semibold text-stone-800">{session?.navn}</span>
                <span className="block text-[10px] text-stone-500 font-medium">{session?.roller?.join(', ')}</span>
              </div>
              <Knap variant="sekundaer" onClick={logUd} className="text-xs px-2.5 py-1">
                Log ud
              </Knap>
            </div>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
