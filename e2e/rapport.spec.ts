import path from 'node:path';
import { expect, test } from '@playwright/test';
import { config as indlaesEnv } from 'dotenv';

indlaesEnv({ path: path.resolve(import.meta.dirname, '../.env'), quiet: true });

test('V8: 1-klik kommunal tilsynsrapport og hashkæde-verifikation (SC-009, FR-018, FR-019, US4, T157)', async ({
  page,
}) => {
  test.setTimeout(180_000);

  // 1. Log ind som Ledelse
  await page.goto('/admin/login');
  await page.locator('#email').fill('malene@ridecenter.dk');
  await page.locator('#adgangskode').fill('Ridecenter2026!');
  await page.getByRole('button', { name: /Log ind/i }).click();

  // 2. Gå til /admin/rapporter
  await page.goto('/admin/rapporter');
  await expect(page.getByText('Kommunal Tilsynsrapport')).toBeVisible();

  // Klik på "Generer kommunal tilsynsrapport"
  const startTid = Date.now();
  const genererKnap = page.getByRole('button', { name: /Generer kommunal tilsynsrapport/i });
  await expect(genererKnap).toBeVisible();
  await genererKnap.click();

  // Verificér svar og download knap vises hurtigt (< 5 sek., SC-009)
  await expect(page.getByText(/Rapport genereret på/i)).toBeVisible();
  const varighed = Date.now() - startTid;
  expect(varighed).toBeLessThan(5_000);

  await expect(page.getByText(/Fil-kontrolsum/i)).toBeVisible();
  await expect(page.getByText(/Hashkæde hovedhash/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /Download CSV/i }).first()).toBeVisible();

  // 3. Gå til /admin/audit og verificér hashkæde
  await page.goto('/admin/audit');
  await expect(page.getByText('Revisionsspor & Hashkæde')).toBeVisible();

  const verificerKnap = page.getByRole('button', { name: /Verificér hashkæde/i });
  await expect(verificerKnap).toBeVisible();
  await verificerKnap.click();

  // Verificér grøn successtatus
  await expect(page.getByText(/Hashkæde fuldstændig intakt og verificeret/i)).toBeVisible();
});

