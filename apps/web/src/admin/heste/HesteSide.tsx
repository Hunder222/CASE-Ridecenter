import type { Hest, HestInput, Sundhedsstatus } from '@ridecenter/contracts';
import { useMemo, useState, type FormEvent } from 'react';
import { harRolle, useSession } from '../../faelles/session';
import { Dialog } from '../../faelles/ui/Dialog';
import { FejlBesked } from '../../faelles/ui/FejlBesked';
import { Afkrydsning, Felt, Input, Tekstomraade, Valg } from '../../faelles/ui/Felt';
import { Indlaeser } from '../../faelles/ui/Indlaeser';
import { Knap } from '../../faelles/ui/Knap';
import { Tabel, Td, Th } from '../../faelles/ui/Tabel';
import { useHeste, useOpdaterHest, useOpretHest } from '../api/stamdata';

export const UGEDAGE = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];

const SUNDHED: Record<Sundhedsstatus, string> = {
  Aktiv: '🟢 Aktiv / Rask',
  Sygemeldt: '🔴 Sygemeldt',
  Skadet: '🟠 Skadet',
  Karantaene: '🟣 Karantæne',
};

const jaNej = (vaerdi: boolean) => (vaerdi ? 'Ja' : 'Nej');

interface HestFormState extends HestInput {
  sundhedsstatus: Sundhedsstatus;
}

const NY_HEST: HestFormState = {
  navn: '',
  stangmaal_cm: 140,
  max_rytter_vaegt_kg: 60,
  max_rytter_hoejde_cm: null,
  temperament: 'Normal',
  godkendt_til_begyndere: false,
  egnet_oevet: true,
  skaane: false,
  springforbud: false,
  hviledag: 1,
  staldnoter: '',
  sundhedsstatus: 'Aktiv',
};

function tilInput(h: Hest): HestFormState {
  return {
    navn: h.navn,
    stangmaal_cm: h.stangmaal_cm,
    max_rytter_vaegt_kg: h.max_rytter_vaegt_kg,
    max_rytter_hoejde_cm: h.max_rytter_hoejde_cm,
    temperament: h.temperament,
    godkendt_til_begyndere: h.godkendt_til_begyndere,
    egnet_oevet: h.egnet_oevet,
    skaane: h.skaane,
    springforbud: h.springforbud,
    hviledag: h.hviledag,
    staldnoter: h.staldnoter,
    sundhedsstatus: h.sundhedsstatus,
  };
}

function HestDialog({ id, start, onLuk }: { id: string | null; start: HestFormState; onLuk: () => void }) {
  const [data, setData] = useState(start);
  const opret = useOpretHest();
  const opdater = useOpdaterHest();
  const saet = <K extends keyof HestFormState>(felt: K, vaerdi: HestFormState[K]) =>
    setData((d) => ({ ...d, [felt]: vaerdi }));

  async function gem(event: FormEvent) {
    event.preventDefault();
    try {
      if (id) {
        await opdater.mutateAsync({ id, aendring: data });
      } else {
        const { sundhedsstatus: _ignored, ...opretInput } = data;
        await opret.mutateAsync(opretInput);
      }
      onLuk();
    } catch {
      // Fejlen vises af FejlBesked.
    }
  }

  return (
    <Dialog aaben titel={id ? `Redigér ${start.navn}` : 'Opret hest'} onLuk={onLuk}>
      <form onSubmit={gem} className="grid grid-cols-2 gap-4">
        <Felt label="Navn">
          <Input value={data.navn} onChange={(e) => saet('navn', e.target.value)} required />
        </Felt>
        <Felt label="Sundhedsstatus">
          <Valg
            value={data.sundhedsstatus}
            onChange={(e) => saet('sundhedsstatus', e.target.value as Sundhedsstatus)}
          >
            <option value="Aktiv">🟢 Aktiv / Rask</option>
            <option value="Sygemeldt">🔴 Sygemeldt</option>
            <option value="Skadet">🟠 Skadet</option>
            <option value="Karantaene">🟣 Karantæne</option>
          </Valg>
        </Felt>
        <Felt label="Stangmål (cm)">
          <Input
            type="number"
            min={80}
            max={190}
            value={data.stangmaal_cm}
            onChange={(e) => saet('stangmaal_cm', Number(e.target.value))}
            required
          />
        </Felt>
        <Felt label="Max ryttervægt (kg)">
          <Input
            type="number"
            min={1}
            value={data.max_rytter_vaegt_kg}
            onChange={(e) => saet('max_rytter_vaegt_kg', Number(e.target.value))}
            required
          />
        </Felt>
        <Felt label="Max rytterhøjde (cm, tom = ingen grænse)">
          <Input
            type="number"
            min={1}
            value={data.max_rytter_hoejde_cm ?? ''}
            onChange={(e) =>
              saet('max_rytter_hoejde_cm', e.target.value === '' ? null : Number(e.target.value))
            }
          />
        </Felt>
        <Felt label="Temperament">
          <Valg
            value={data.temperament}
            onChange={(e) => saet('temperament', e.target.value as HestInput['temperament'])}
          >
            <option>Rolig</option>
            <option>Normal</option>
            <option>Frisk</option>
          </Valg>
        </Felt>
        <Felt label="Hviledag">
          <Valg value={data.hviledag} onChange={(e) => saet('hviledag', Number(e.target.value))}>
            {UGEDAGE.map((navn, i) => (
              <option key={navn} value={i + 1}>
                {navn}
              </option>
            ))}
          </Valg>
        </Felt>
        <div className="col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <Afkrydsning
            label="Godkendt til begyndere"
            checked={data.godkendt_til_begyndere}
            onChange={(e) => saet('godkendt_til_begyndere', e.target.checked)}
          />
          <Afkrydsning
            label="Egnet til øvet"
            checked={data.egnet_oevet}
            onChange={(e) => saet('egnet_oevet', e.target.checked)}
          />
          <Afkrydsning
            label="Skånehest"
            checked={data.skaane}
            onChange={(e) => saet('skaane', e.target.checked)}
          />
          <Afkrydsning
            label="Springforbud"
            checked={data.springforbud}
            onChange={(e) => saet('springforbud', e.target.checked)}
          />
        </div>
        <div className="col-span-2">
          <Felt label="Staldnoter (instrukser til staldelever og undervisere)">
            <Tekstomraade
              maxLength={500}
              placeholder="F.eks. Skal have boots på før fold, fodres før opsadling..."
              value={data.staldnoter}
              onChange={(e) => saet('staldnoter', e.target.value)}
            />
          </Felt>
        </div>
        <p className="col-span-2 text-sm text-stone-600">
          Afledt af serveren: højst {data.skaane ? 2 : 3} hold om dagen og {data.springforbud ? 0 : 1}{' '}
          springhold om ugen.
        </p>
        <div className="col-span-2">
          <FejlBesked fejl={opret.error ?? opdater.error} />
        </div>
        <div className="col-span-2 flex justify-end gap-2">
          <Knap variant="sekundaer" onClick={onLuk}>
            Annullér
          </Knap>
          <Knap type="submit" disabled={opret.isPending || opdater.isPending}>
            Gem hest
          </Knap>
        </div>
      </form>
    </Dialog>
  );
}

/** Heste (FR-001, F1.3, T091). Ledelse kan oprette og redigere, ridelærere kan se. */
export function HesteSide() {
  const { data: session } = useSession();
  const kanRedigere = harRolle(session, 'Ledelse') || harRolle(session, 'Ridelaerer');
  const heste = useHeste();
  const opdaterHest = useOpdaterHest();

  const [redigerer, setRedigerer] = useState<{ id: string | null; data: HestFormState } | null>(null);
  const [filter, setFilter] = useState<'alle' | 'Aktiv' | 'Sygemeldt' | 'Skadet' | 'Karantaene'>('alle');
  const [kapacitetFilter, setKapacitetFilter] = useState<{
    gruppe: 'Egenskaber & kapacitet' | 'Temperamentsoversigt';
    felt: 'begynder' | 'skaane' | 'spring' | 'Rolig' | 'Normal' | 'Frisk';
    label: string;
  } | null>(null);
  const [soegning, setSoegning] = useState('');
  const [sorteringsFelt, setSorteringsFelt] = useState<string>('navn');
  const [sorteringsRetning, setSorteringsRetning] = useState<'asc' | 'desc'>('asc');

  const liste = heste.data ?? [];

  const tællere = useMemo(() => {
    return {
      alle: liste.length,
      aktiv: liste.filter((h) => h.sundhedsstatus === 'Aktiv').length,
      syg: liste.filter((h) => h.sundhedsstatus === 'Sygemeldt').length,
      skadet: liste.filter((h) => h.sundhedsstatus === 'Skadet').length,
      karantaene: liste.filter((h) => h.sundhedsstatus === 'Karantaene').length,
      begynder: liste.filter((h) => h.godkendt_til_begyndere).length,
      skaane: liste.filter((h) => h.skaane).length,
      spring: liste.filter((h) => !h.springforbud).length,
      temperament: {
        Rolig: liste.filter((h) => h.temperament === 'Rolig').length,
        Normal: liste.filter((h) => h.temperament === 'Normal').length,
        Frisk: liste.filter((h) => h.temperament === 'Frisk').length,
      },
    };
  }, [liste]);

  const filtreredeHeste = useMemo(() => {
    const filtreret = liste.filter((h) => {
      const matcherSoeg = h.navn.toLowerCase().includes(soegning.trim().toLowerCase());
      if (!matcherSoeg) return false;
      if (filter !== 'alle' && h.sundhedsstatus !== filter) return false;

      if (kapacitetFilter) {
        if (kapacitetFilter.felt === 'begynder') return Boolean(h.godkendt_til_begyndere);
        if (kapacitetFilter.felt === 'skaane') return Boolean(h.skaane);
        if (kapacitetFilter.felt === 'spring') return !h.springforbud;
        if (kapacitetFilter.felt === 'Rolig') return h.temperament === 'Rolig';
        if (kapacitetFilter.felt === 'Normal') return h.temperament === 'Normal';
        if (kapacitetFilter.felt === 'Frisk') return h.temperament === 'Frisk';
      }

      return true;
    });

    return [...filtreret].sort((a, b) => {
      let vaerdiA: any;
      let vaerdiB: any;

      switch (sorteringsFelt) {
        case 'navn':
          vaerdiA = a.navn;
          vaerdiB = b.navn;
          break;
        case 'sundhedsstatus':
          vaerdiA = a.sundhedsstatus;
          vaerdiB = b.sundhedsstatus;
          break;
        case 'stangmaal_cm':
          vaerdiA = a.stangmaal_cm;
          vaerdiB = b.stangmaal_cm;
          break;
        case 'max_rytter_vaegt_kg':
          vaerdiA = a.max_rytter_vaegt_kg;
          vaerdiB = b.max_rytter_vaegt_kg;
          break;
        case 'temperament':
          vaerdiA = a.temperament;
          vaerdiB = b.temperament;
          break;
        case 'godkendt_til_begyndere':
          vaerdiA = a.godkendt_til_begyndere ? 1 : 0;
          vaerdiB = b.godkendt_til_begyndere ? 1 : 0;
          break;
        case 'skaane':
          vaerdiA = a.skaane ? 1 : 0;
          vaerdiB = b.skaane ? 1 : 0;
          break;
        case 'spring':
          vaerdiA = a.springforbud ? 0 : 1;
          vaerdiB = b.springforbud ? 0 : 1;
          break;
        case 'hviledag':
          vaerdiA = a.hviledag;
          vaerdiB = b.hviledag;
          break;
        default:
          vaerdiA = a.navn;
          vaerdiB = b.navn;
      }

      if (typeof vaerdiA === 'string') {
        const cmp = vaerdiA.localeCompare(vaerdiB, 'da');
        return sorteringsRetning === 'asc' ? cmp : -cmp;
      }

      const cmp = vaerdiA < vaerdiB ? -1 : vaerdiA > vaerdiB ? 1 : 0;
      return sorteringsRetning === 'asc' ? cmp : -cmp;
    });
  }, [liste, filter, kapacitetFilter, soegning, sorteringsFelt, sorteringsRetning]);

  const skiftSortering = (felt: string) => {
    if (sorteringsFelt === felt) {
      setSorteringsRetning((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSorteringsFelt(felt);
      setSorteringsRetning('asc');
    }
  };

  const sorteringsIkon = (felt: string) => {
    if (sorteringsFelt !== felt) return ' ↕';
    return sorteringsRetning === 'asc' ? ' ↑' : ' ↓';
  };

  const haandterHurtigStatusSkift = async (hestId: string, nyStatus: Sundhedsstatus) => {
    try {
      await opdaterHest.mutateAsync({
        id: hestId,
        aendring: { sundhedsstatus: nyStatus },
      });
    } catch {
      alert('Kunne ikke opdatere hestens sundhedsstatus');
    }
  };

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Heste & Sundhedsoverblik</h1>
          <p className="text-sm text-stone-600 mt-1">
            Administrér hesteparken, kapacitet, sundhedsstatus og staldnoter.
          </p>
        </div>
        {kanRedigere && (
          <Knap onClick={() => setRedigerer({ id: null, data: NY_HEST })}>
            + Opret hest
          </Knap>
        )}
      </div>

      <FejlBesked fejl={heste.error} />

      {/* KPI-kort / hurtigfilter for sundhedsstatus */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setFilter('alle')}
          className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
            filter === 'alle'
              ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
              : 'bg-white text-stone-800 border-stone-200 hover:bg-stone-50'
          }`}
        >
          <div className="text-xs uppercase tracking-wider font-semibold opacity-80">Alle heste</div>
          <div className="text-2xl font-bold mt-0.5">{tællere.alle}</div>
        </button>

        <button
          type="button"
          onClick={() => setFilter('Aktiv')}
          className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
            filter === 'Aktiv'
              ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
              : 'bg-white text-stone-800 border-stone-200 hover:bg-emerald-50/50'
          }`}
        >
          <div className="text-xs uppercase tracking-wider font-semibold text-emerald-600">🟢 Raske & Aktive</div>
          <div className="text-2xl font-bold mt-0.5">{tællere.aktiv}</div>
        </button>

        <button
          type="button"
          onClick={() => setFilter('Sygemeldt')}
          className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
            filter === 'Sygemeldt'
              ? 'bg-rose-700 text-white border-rose-700 shadow-sm'
              : 'bg-white text-stone-800 border-stone-200 hover:bg-rose-50/50'
          }`}
        >
          <div className="text-xs uppercase tracking-wider font-semibold text-rose-600">🔴 Sygemeldte</div>
          <div className="text-2xl font-bold mt-0.5">{tællere.syg}</div>
        </button>

        <button
          type="button"
          onClick={() => setFilter('Skadet')}
          className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
            filter === 'Skadet'
              ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
              : 'bg-white text-stone-800 border-stone-200 hover:bg-amber-50/50'
          }`}
        >
          <div className="text-xs uppercase tracking-wider font-semibold text-amber-600">🟠 Skadede / Obs</div>
          <div className="text-2xl font-bold mt-0.5">{tællere.skadet}</div>
        </button>

        <button
          type="button"
          onClick={() => setFilter('Karantaene')}
          className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
            filter === 'Karantaene'
              ? 'bg-purple-700 text-white border-purple-700 shadow-sm'
              : 'bg-white text-stone-800 border-stone-200 hover:bg-purple-50/50'
          }`}
        >
          <div className="text-xs uppercase tracking-wider font-semibold text-purple-600">🟣 Karantæne</div>
          <div className="text-2xl font-bold mt-0.5">{tællere.karantaene}</div>
        </button>
      </div>

      {/* Ekstra kapacitets- og temperamentsoversigt (interaktive filtre) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Nøgletal for anvendelighed */}
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm flex flex-col justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
            Egenskaber & kapacitet
          </div>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() =>
                setKapacitetFilter((prev) =>
                  prev?.felt === 'begynder'
                    ? null
                    : { gruppe: 'Egenskaber & kapacitet', felt: 'begynder', label: 'Begyndervenlig' },
                )
              }
              className={`rounded-lg p-3 border text-left transition cursor-pointer ${
                kapacitetFilter?.felt === 'begynder'
                  ? 'bg-emerald-100 border-emerald-500 ring-2 ring-emerald-500 shadow-sm'
                  : 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100/70'
              }`}
            >
              <div className="text-xs font-semibold text-emerald-800">Begyndervenlig</div>
              <div className="text-2xl font-extrabold text-emerald-700 mt-0.5">
                {tællere.begynder} <span className="text-xs font-normal text-stone-500">heste</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setKapacitetFilter((prev) =>
                  prev?.felt === 'skaane'
                    ? null
                    : { gruppe: 'Egenskaber & kapacitet', felt: 'skaane', label: 'Er skånehest' },
                )
              }
              className={`rounded-lg p-3 border text-left transition cursor-pointer ${
                kapacitetFilter?.felt === 'skaane'
                  ? 'bg-sky-100 border-sky-500 ring-2 ring-sky-500 shadow-sm'
                  : 'bg-sky-50 border-sky-100 hover:bg-sky-100/70'
              }`}
            >
              <div className="text-xs font-semibold text-sky-800">Er skånehest</div>
              <div className="text-2xl font-extrabold text-sky-700 mt-0.5">
                {tællere.skaane} <span className="text-xs font-normal text-stone-500">heste</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setKapacitetFilter((prev) =>
                  prev?.felt === 'spring'
                    ? null
                    : { gruppe: 'Egenskaber & kapacitet', felt: 'spring', label: 'Må springe' },
                )
              }
              className={`rounded-lg p-3 border text-left transition cursor-pointer ${
                kapacitetFilter?.felt === 'spring'
                  ? 'bg-indigo-100 border-indigo-500 ring-2 ring-indigo-500 shadow-sm'
                  : 'bg-indigo-50 border-indigo-100 hover:bg-indigo-100/70'
              }`}
            >
              <div className="text-xs font-semibold text-indigo-800">Må springe</div>
              <div className="text-2xl font-extrabold text-indigo-700 mt-0.5">
                {tællere.spring} <span className="text-xs font-normal text-stone-500">heste</span>
              </div>
            </button>
          </div>
        </div>

        {/* Oversigt over temperament */}
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm flex flex-col justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
            Temperamentsoversigt
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() =>
                setKapacitetFilter((prev) =>
                  prev?.felt === 'Rolig'
                    ? null
                    : { gruppe: 'Temperamentsoversigt', felt: 'Rolig', label: 'Rolig' },
                )
              }
              className={`rounded-lg p-2.5 border text-center transition cursor-pointer ${
                kapacitetFilter?.felt === 'Rolig'
                  ? 'bg-stone-200 border-stone-500 ring-2 ring-stone-500 shadow-sm'
                  : 'bg-stone-50 border-stone-200/80 hover:bg-stone-100'
              }`}
            >
              <div className="text-xs font-medium text-stone-600">Rolig</div>
              <div className="text-xl font-bold text-stone-800 mt-0.5">{tællere.temperament.Rolig}</div>
            </button>

            <button
              type="button"
              onClick={() =>
                setKapacitetFilter((prev) =>
                  prev?.felt === 'Normal'
                    ? null
                    : { gruppe: 'Temperamentsoversigt', felt: 'Normal', label: 'Normal' },
                )
              }
              className={`rounded-lg p-2.5 border text-center transition cursor-pointer ${
                kapacitetFilter?.felt === 'Normal'
                  ? 'bg-stone-200 border-stone-500 ring-2 ring-stone-500 shadow-sm'
                  : 'bg-stone-50 border-stone-200/80 hover:bg-stone-100'
              }`}
            >
              <div className="text-xs font-medium text-stone-600">Normal</div>
              <div className="text-xl font-bold text-stone-800 mt-0.5">{tællere.temperament.Normal}</div>
            </button>

            <button
              type="button"
              onClick={() =>
                setKapacitetFilter((prev) =>
                  prev?.felt === 'Frisk'
                    ? null
                    : { gruppe: 'Temperamentsoversigt', felt: 'Frisk', label: 'Frisk' },
                )
              }
              className={`rounded-lg p-2.5 border text-center transition cursor-pointer ${
                kapacitetFilter?.felt === 'Frisk'
                  ? 'bg-amber-100 border-amber-500 ring-2 ring-amber-500 shadow-sm'
                  : 'bg-amber-50 border-amber-200 hover:bg-amber-100/70'
              }`}
            >
              <div className="text-xs font-medium text-amber-800">Frisk</div>
              <div className="text-xl font-bold text-amber-700 mt-0.5">{tællere.temperament.Frisk}</div>
            </button>
          </div>
        </div>
      </div>

      {/* Aktivt kapacitetsfilter banner */}
      {kapacitetFilter && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 border border-amber-300 px-4 py-3 text-sm text-amber-950 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-base">🔎</span>
            <span>
              Viser <strong>{kapacitetFilter.gruppe}: {kapacitetFilter.label}</strong> ({filtreredeHeste.length} heste fundet)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setKapacitetFilter(null)}
            className="rounded-lg bg-white border border-amber-400 px-3 py-1 font-bold text-xs text-amber-900 hover:bg-amber-100 transition cursor-pointer shadow-xs"
          >
            Reset
          </button>
        </div>
      )}

      {/* Søgefelt */}
      <div className="max-w-xs">
        <Input
          type="search"
          placeholder="Søg hest efter navn..."
          value={soegning}
          onChange={(e) => setSoegning(e.target.value)}
        />
      </div>

      {heste.isPending && <Indlaeser />}

      {heste.data && (
        <Tabel>
          <thead>
            <tr>
              <Th className="cursor-pointer select-none hover:text-stone-900 whitespace-nowrap px-2.5 py-2 text-xs" onClick={() => skiftSortering('navn')}>
                Navn{sorteringsIkon('navn')}
              </Th>
              <Th className="cursor-pointer select-none hover:text-stone-900 whitespace-nowrap px-2.5 py-2 text-xs" onClick={() => skiftSortering('sundhedsstatus')}>
                Sundhedsstatus{sorteringsIkon('sundhedsstatus')}
              </Th>
              <Th className="whitespace-nowrap px-2.5 py-2 text-xs">Staldnoter</Th>
              <Th className="cursor-pointer select-none hover:text-stone-900 whitespace-nowrap px-2.5 py-2 text-xs" onClick={() => skiftSortering('stangmaal_cm')}>
                Stangmål{sorteringsIkon('stangmaal_cm')}
              </Th>
              <Th className="cursor-pointer select-none hover:text-stone-900 whitespace-nowrap px-2.5 py-2 text-xs" onClick={() => skiftSortering('max_rytter_vaegt_kg')}>
                Max vægt{sorteringsIkon('max_rytter_vaegt_kg')}
              </Th>
              <Th className="cursor-pointer select-none hover:text-stone-900 whitespace-nowrap px-2.5 py-2 text-xs" onClick={() => skiftSortering('temperament')}>
                Temperament{sorteringsIkon('temperament')}
              </Th>
              <Th className="cursor-pointer select-none hover:text-stone-900 whitespace-nowrap px-2.5 py-2 text-xs" onClick={() => skiftSortering('godkendt_til_begyndere')}>
                Begyndere{sorteringsIkon('godkendt_til_begyndere')}
              </Th>
              <Th className="cursor-pointer select-none hover:text-stone-900 whitespace-nowrap px-2.5 py-2 text-xs" onClick={() => skiftSortering('skaane')}>
                Skåne{sorteringsIkon('skaane')}
              </Th>
              <Th className="cursor-pointer select-none hover:text-stone-900 whitespace-nowrap px-2.5 py-2 text-xs" onClick={() => skiftSortering('spring')}>
                Spring{sorteringsIkon('spring')}
              </Th>
              <Th className="cursor-pointer select-none hover:text-stone-900 whitespace-nowrap px-2.5 py-2 text-xs" onClick={() => skiftSortering('hviledag')}>
                Hviledag{sorteringsIkon('hviledag')}
              </Th>
              {kanRedigere && (
                <Th className="text-right w-10 px-2 py-2 text-xs">
                  <span className="sr-only">Redigér</span>
                </Th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtreredeHeste.length === 0 ? (
              <tr>
                <Td colSpan={11} className="text-center py-8 text-stone-500">
                  Ingen heste matcher det valgte filter eller søgning.
                </Td>
              </tr>
            ) : (
              filtreredeHeste.map((h) => (
                <tr key={h.id} className="hover:bg-stone-50 transition">
                  <Td className="font-semibold text-stone-900 whitespace-nowrap px-2.5 py-2 text-xs">{h.navn}</Td>
                  <Td className="whitespace-nowrap px-2.5 py-2 text-xs">
                    {kanRedigere ? (
                      <select
                        value={h.sundhedsstatus}
                        onChange={(e) =>
                          haandterHurtigStatusSkift(h.id, e.target.value as Sundhedsstatus)
                        }
                        className={`text-xs font-semibold px-2 py-0.5 rounded-lg border cursor-pointer focus:ring-1 focus:ring-emerald-500 ${
                          h.sundhedsstatus === 'Aktiv'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : h.sundhedsstatus === 'Sygemeldt'
                              ? 'bg-rose-50 text-rose-800 border-rose-300'
                              : h.sundhedsstatus === 'Skadet'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : 'bg-purple-50 text-purple-800 border-purple-300'
                        }`}
                      >
                        <option value="Aktiv">🟢 Aktiv</option>
                        <option value="Sygemeldt">🔴 Sygemeldt</option>
                        <option value="Skadet">🟠 Skadet</option>
                        <option value="Karantaene">🟣 Karantæne</option>
                      </select>
                    ) : (
                      <span className="text-xs font-semibold">{SUNDHED[h.sundhedsstatus]}</span>
                    )}
                  </Td>
                  <Td className="max-w-xs px-2.5 py-2 text-xs">
                    {h.staldnoter ? (
                      <span className="text-xs text-stone-700 italic block line-clamp-1" title={h.staldnoter}>
                        📝 {h.staldnoter}
                      </span>
                    ) : (
                      <span className="text-xs text-stone-400">—</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap px-2.5 py-2 text-xs">{h.stangmaal_cm} cm</Td>
                  <Td className="whitespace-nowrap px-2.5 py-2 text-xs">{h.max_rytter_vaegt_kg} kg</Td>
                  <Td className="whitespace-nowrap px-2.5 py-2 text-xs">{h.temperament}</Td>
                  <Td className="whitespace-nowrap px-2.5 py-2 text-xs">{jaNej(h.godkendt_til_begyndere)}</Td>
                  <Td className="whitespace-nowrap px-2.5 py-2 text-xs">{jaNej(h.skaane)}</Td>
                  <Td className="whitespace-nowrap px-2.5 py-2 text-xs">{h.springforbud ? 'Forbud' : 'Tilladt'}</Td>
                  <Td className="whitespace-nowrap px-2.5 py-2 text-xs">{UGEDAGE[h.hviledag - 1]}</Td>
                  {kanRedigere && (
                    <Td className="text-right whitespace-nowrap px-2 py-2">
                      <button
                        type="button"
                        onClick={() => setRedigerer({ id: h.id, data: tilInput(h) })}
                        className="inline-flex items-center justify-center p-1 rounded-md text-stone-500 hover:text-emerald-700 hover:bg-stone-100 transition cursor-pointer"
                        title={`Redigér ${h.navn}`}
                      >
                        <span className="text-sm">✏️</span>
                      </button>
                    </Td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </Tabel>
      )}

      {redigerer && (
        <HestDialog
          id={redigerer.id}
          start={redigerer.data}
          onLuk={() => setRedigerer(null)}
        />
      )}
    </section>
  );
}
