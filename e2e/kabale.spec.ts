import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { config as indlaesEnv } from 'dotenv';
import { rytterId } from '../tools/seed/data/fredag-ryttere';

// Quickstart V2 – Kabalen for juli (US2, SC-002 – SC-004) på seed "fredag" (global setup).
// Trin 8 (stald-tablet efter publicering) verificeres i Fase 2.

indlaesEnv({ path: path.resolve(import.meta.dirname, '../.env'), quiet: true });

const KABALE = '/admin/kabale/2026-07';
const OVERRIDE = /overstyr|override|tilsidesæt|tving/i;

async function logIndSomMalene(page: Page): Promise<void> {
  const adgangskode = process.env.SEED_ADGANGSKODE;
  if (!adgangskode) throw new Error('SEED_ADGANGSKODE mangler i .env (se .env.example)');
  await page.goto('/admin/login');
  await page.getByLabel('E-mail').fill('malene@demo.dk');
  await page.getByLabel('Adgangskode').fill(adgangskode);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL(/\/admin\/kabale\//);
}

/** Klikker "Kør tildeling" og returnerer den viste varighed i ms. */
async function koerTildeling(page: Page): Promise<number> {
  const svar = page.waitForResponse(
    (r) => r.url().endsWith('/api/v1/tildeling/koersler') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Kør tildeling' }).click();
  expect((await svar).status()).toBe(201);

  const varighed = page.getByText(/Beregnet på \d+ ms/);
  await expect(varighed).toBeVisible();
  await expect(page.getByText('Welfare Guard: 0 overtrædelser')).toBeVisible();
  return Number(/(\d+) ms/.exec((await varighed.textContent()) ?? '')?.[1]);
}

function raekke(page: Page, rytter: string): Locator {
  return page.getByRole('row', { name: new RegExp(rytter) });
}

function ikkeTildelte(page: Page): Locator {
  return page.getByRole('row').filter({ hasText: 'Ikke tildelt – kapacitetsmangel' });
}

async function gem(page: Page, sti: RegExp, knap: Locator): Promise<void> {
  const svar = page.waitForResponse((r) => sti.test(r.url()) && r.request().method() === 'PATCH');
  await knap.click();
  expect((await svar).status()).toBe(200);
}

test('V2: Kabalen for juli – kør, forklar, justér uden override, godkend og publicér', async ({ page }) => {
  test.setTimeout(180_000);
  await logIndSomMalene(page);

  await test.step('Kør tildeling: under 30 sek. og 0 Welfare Guard-overtrædelser (SC-002 – SC-004)', async () => {
    await page.goto(KABALE);
    expect(await koerTildeling(page)).toBeLessThan(30_000);
  });

  await test.step('Forfatningens eksempler i tabellen (F-01 – F-03, F-11)', async () => {
    await expect(raekke(page, 'Anna Gammelgård')).toContainText('Donny');
    await expect(raekke(page, 'Emma Grønby')).not.toContainText('Pixie');
    await expect(raekke(page, 'Sofia Ejby')).not.toContainText('Aida');
    await expect(raekke(page, 'Freja Pedersen')).toContainText('Belle');
  });

  await test.step('Begrundelse for Sophia Kronborg med årsagskode og dansk tekst (FR-010)', async () => {
    await raekke(page, 'Sophia Kronborg').click();
    const panel = page.getByRole('complementary', { name: 'Begrundelse' });
    await expect(panel).toContainText('Sophia Kronborg');
    await expect(panel).toContainText(/SC0[1-5]_[A-Z_0-9]+|HC0[1-8]_[A-Z_]+|ALT_TILDELING/);
    await expect(panel).toContainText(/ønske|turnus|hold/i);
    // Klik på rækken viser begrundelsen, hvor brugeren kigger, og åbner ikke justeringsdialogen.
    await expect(panel).toBeInViewport();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Også for en rytter på det sidste hold langt nede på siden (T097).
    await raekke(page, 'Victoria Skovby').click();
    await expect(panel).toContainText('Victoria Skovby');
    await expect(panel).toBeInViewport();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  await test.step('Alternativ tildeling viser turnus +3 næste måned (US2 AS4)', async () => {
    await page.getByRole('row').filter({ hasText: 'Alternativ tildeling (ønsker optaget)' }).first().click();
    await expect(page.getByRole('complementary', { name: 'Begrundelse' })).toContainText(
      'Turnus næste måned: +3',
    );
  });

  await test.step('Emma Grønby kan ikke få Pixie, og der findes ingen override (Princip I)', async () => {
    await raekke(page, 'Emma Grønby').getByRole('button', { name: 'Justér' }).click();
    const dialog = page.getByRole('dialog');
    const pixie = dialog.getByRole('button', { name: /Pixie/ });
    await expect(pixie).toBeDisabled();
    await expect(dialog).toContainText('Ikke tilladt af hensyn til rytterens sikkerhed (HC-07)');
    await expect(dialog.getByRole('button', { name: OVERRIDE })).toHaveCount(0);
    await expect(dialog).not.toContainText(OVERRIDE);
    await dialog.getByRole('button', { name: 'Luk' }).click();
    await expect(dialog).toBeHidden();
  });

  await test.step('Kapacitetsmangel på begynderholdet falder, når Zigge godkendes til begyndere (research D2)', async () => {
    const foer = await ikkeTildelte(page).count();
    expect(foer).toBeGreaterThan(0);

    await page.goto('/admin/heste');
    await raekke(page, 'Zigge')
      .getByRole('button', { name: /Redigér/ })
      .click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('checkbox', { name: 'Godkendt til begyndere' }).check();
    await gem(page, /\/api\/v1\/heste\//, dialog.getByRole('button', { name: 'Gem' }));

    await page.goto(KABALE);
    await koerTildeling(page);
    await expect.poll(() => ikkeTildelte(page).count()).toBeLessThan(foer);
  });

  await test.step('Lærke Hansen får Aida først med "Godkendt trods niveau" (F-16)', async () => {
    await expect(raekke(page, 'Lærke Hansen')).not.toContainText('Aida');

    await page.goto('/admin/notifikationer');
    await expect(page.getByText(/Lærke Hansens partaftale \(Aida\) mangler niveaugodkendelse/)).toBeVisible();
    await page
      .locator(`a[href="/admin/ryttere/${rytterId('Lærke Hansen')}"]`)
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`/admin/ryttere/${rytterId('Lærke Hansen')}$`));

    await page.getByRole('checkbox', { name: /Godkendt trods niveau/ }).check();
    await gem(page, /\/api\/v1\/ryttere\//, page.getByRole('button', { name: 'Gem' }));

    await page.goto(KABALE);
    await koerTildeling(page);
    await expect(raekke(page, 'Lærke Hansen')).toContainText('Aida');
  });

  await test.step('Godkend og publicér: 5 fredage × 4 hold = 20 lektioner', async () => {
    await page.getByRole('button', { name: 'Godkend' }).click();
    await expect(page.getByText('Godkendt', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Publicér' }).click();
    const bekraeft = page.getByRole('dialog');
    await bekraeft.getByRole('button', { name: 'Publicér' }).click();
    await expect(page.getByText('Publiceret – 20 lektioner oprettet')).toBeVisible();
  });
});
