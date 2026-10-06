import { createBrowserRouter, Link, Navigate, RouterProvider } from 'react-router';
import { AdminLayout } from './admin/AdminLayout';
import { HesteSide } from './admin/heste/HesteSide';
import { KabaleSide } from './admin/kabale/KabaleSide';
import { LoginSide } from './admin/LoginSide';
import { NotifikationerSide } from './admin/notifikationer/NotifikationerSide';
import { OenskerSide } from './admin/oensker/OenskerSide';
import { RytterDetaljeSide } from './admin/ryttere/RytterDetaljeSide';
import { RyttereSide } from './admin/ryttere/RyttereSide';
import { SikkerhedsprofilSide } from './admin/ryttere/SikkerhedsprofilSide';
import { naesteMaaned } from './faelles/maaned';
import { KraevRolle } from './faelles/session';

function IkkeFundet() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Siden findes ikke</h1>
      <Link to="/admin" className="mt-4 inline-block text-emerald-800 underline">
        Til forsiden
      </Link>
    </main>
  );
}

const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/admin" replace /> },
  { path: '/admin/login', element: <LoginSide /> },
  {
    path: '/admin',
    element: (
      <KraevRolle roller={['Ledelse', 'Ridelaerer']}>
        <AdminLayout />
      </KraevRolle>
    ),
    children: [
      { index: true, element: <Navigate to={`/admin/kabale/${naesteMaaned()}`} replace /> },
      { path: 'kabale/:maaned', element: <KabaleSide /> },
      { path: 'oensker/:maaned', element: <OenskerSide /> },
      { path: 'heste', element: <HesteSide /> },
      {
        path: 'ryttere',
        element: (
          <KraevRolle roller={['Ledelse']}>
            <RyttereSide />
          </KraevRolle>
        ),
      },
      {
        path: 'ryttere/:id',
        element: (
          <KraevRolle roller={['Ledelse']}>
            <RytterDetaljeSide />
          </KraevRolle>
        ),
      },
      {
        path: 'ryttere/:id/sikkerhed',
        element: (
          <KraevRolle roller={['Ledelse']}>
            <SikkerhedsprofilSide />
          </KraevRolle>
        ),
      },
      {
        path: 'notifikationer',
        element: (
          <KraevRolle roller={['Ledelse']}>
            <NotifikationerSide />
          </KraevRolle>
        ),
      },
    ],
  },
  {
    path: '/stald/*',
    element: (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold">Staldfladen kommer i Fase 2</h1>
      </main>
    ),
  },
  { path: '*', element: <IkkeFundet /> },
]);

export function App() {
  return <RouterProvider router={router} />;
}
