import { createBrowserRouter, Link, Navigate, RouterProvider } from 'react-router';
import { AdminLayout } from './admin/AdminLayout';
import { HesteSide } from './admin/heste/HesteSide';
import { HoldSide } from './admin/HoldSide';
import { KabaleSide } from './admin/kabale/KabaleSide';
import { LoginSide } from './admin/LoginSide';
import { NotifikationerSide } from './admin/notifikationer/NotifikationerSide';
import { OenskerSide } from './admin/oensker/OenskerSide';
import { RytterDetaljeSide } from './admin/ryttere/RytterDetaljeSide';
import { RyttereSide } from './admin/ryttere/RyttereSide';
import { SikkerhedsprofilSide } from './admin/ryttere/SikkerhedsprofilSide';
import { naesteMaaned } from './faelles/maaned';
import { KraevRolle } from './faelles/session';
import { DashboardSide } from './admin/DashboardSide';
import { VentelisteSide } from './admin/VentelisteSide';
import { RapporterSide } from './admin/RapporterSide';
import { AuditSide } from './admin/AuditSide';
import { VikarKoderSide } from './admin/VikarKoderSide';
import { CheatSheetSide } from './stald/CheatSheetSide';
import { ErstatHestSide } from './stald/ErstatHestSide';
import { HesteOversigtSide } from './stald/HesteOversigtSide';
import { IDagSide } from './stald/IDagSide';
import { LaasSide } from './stald/LaasSide';
import { LektionSide } from './stald/LektionSide';
import { OenskerLektionSide } from './stald/OenskerLektionSide';
import { StaldLayout } from './stald/StaldLayout';
import { VikarSide } from './stald/VikarSide';

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
      { path: 'hold', element: <HoldSide /> },
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
        path: 'dashboard',
        element: (
          <KraevRolle roller={['Ledelse']}>
            <DashboardSide />
          </KraevRolle>
        ),
      },
      {
        path: 'venteliste',
        element: (
          <KraevRolle roller={['Ledelse']}>
            <VentelisteSide />
          </KraevRolle>
        ),
      },
      {
        path: 'rapporter',
        element: (
          <KraevRolle roller={['Ledelse']}>
            <RapporterSide />
          </KraevRolle>
        ),
      },
      {
        path: 'audit',
        element: (
          <KraevRolle roller={['Ledelse']}>
            <AuditSide />
          </KraevRolle>
        ),
      },
      {
        path: 'vikarkoder',
        element: (
          <KraevRolle roller={['Ledelse']}>
            <VikarKoderSide />
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
  { path: '/stald/laas', element: <LaasSide /> },
  { path: '/stald/vikar', element: <VikarSide /> },
  {
    path: '/stald',
    element: <StaldLayout />,
    children: [
      { index: true, element: <Navigate to="/stald/hold" replace /> },
      { path: 'i-dag', element: <IDagSide /> },
      { path: 'hold', element: <IDagSide /> },
      { path: 'heste', element: <HesteOversigtSide /> },
      { path: 'lektion/:id', element: <LektionSide /> },
      { path: 'lektion/:id/cheat-sheet', element: <CheatSheetSide /> },
      { path: 'plads/:id/erstat', element: <ErstatHestSide /> },
      { path: 'oensker', element: <OenskerLektionSide /> },
      { path: 'oensker/:lektionId', element: <OenskerLektionSide /> },
    ],
  },
  { path: '*', element: <IkkeFundet /> },
]);

export function App() {
  return <RouterProvider router={router} />;
}
