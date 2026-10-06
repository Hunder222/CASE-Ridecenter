import { createBrowserRouter, Link, Navigate, RouterProvider } from 'react-router';
import { AdminLayout } from './admin/AdminLayout';
import { LoginSide } from './admin/LoginSide';
import { naesteMaaned } from './faelles/maaned';
import { KraevRolle } from './faelles/session';

// Midlertidig side for ruter, som 1.6 bygger.
function Pladsholder({ titel }: { titel: string }) {
  return (
    <section>
      <h1 className="text-2xl font-semibold">{titel}</h1>
      <p className="mt-2 text-stone-700">Siden bygges i Fase 1, sektion 1.6.</p>
    </section>
  );
}

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
      { path: 'kabale/:maaned', element: <Pladsholder titel="Kabalen" /> },
      { path: 'oensker/:maaned', element: <Pladsholder titel="Ønsker" /> },
      { path: 'heste', element: <Pladsholder titel="Heste" /> },
      {
        path: 'ryttere',
        element: (
          <KraevRolle roller={['Ledelse']}>
            <Pladsholder titel="Ryttere" />
          </KraevRolle>
        ),
      },
      {
        path: 'ryttere/:id',
        element: (
          <KraevRolle roller={['Ledelse']}>
            <Pladsholder titel="Rytter" />
          </KraevRolle>
        ),
      },
      {
        path: 'ryttere/:id/sikkerhed',
        element: (
          <KraevRolle roller={['Ledelse']}>
            <Pladsholder titel="Sikkerhedsprofil" />
          </KraevRolle>
        ),
      },
      {
        path: 'notifikationer',
        element: (
          <KraevRolle roller={['Ledelse']}>
            <Pladsholder titel="Notifikationer" />
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
