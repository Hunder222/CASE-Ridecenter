import path from 'node:path';
import { expect, test } from '@playwright/test';
import { config as indlaesEnv } from 'dotenv';

indlaesEnv({ path: path.resolve(import.meta.dirname, '../.env'), quiet: true });

test('V6 & V7: Ledelsesdashboard, KPIer, Heatmap og fraværsmonitorering (FR-016, US4, T156)', async ({
  page,
}) => {
  test.setTimeout(180_000);

  // 1. Log ind som Ledelse
  await page.goto('/admin/login');
  await page.locator('#email').fill('malene@ridecenter.dk');
  await page.locator('#adgangskode').fill('Ridecenter2026!');
  await page.getByRole('button', { name: /Log ind/i }).click();

  // 2. Gå til /admin/dashboard
  await page.goto('/admin/dashboard');
  await expect(page.getByText('Ledelsesoverblik')).toBeVisible();

  // Verificér KPI kort
  await expect(page.getByText('Holdudnyttelse')).toBeVisible();
  await expect(page.getByText('Heste ude af drift')).toBeVisible();
  await expect(page.getByText('Ventelisteforslag')).toBeVisible();
  await expect(page.getByText('Aktive vikarkoder')).toBeVisible();

  // Verificér Heatmap tabel
  await expect(page.getByText(/Hesteflådens belastningsfordeling/i)).toBeVisible();
  await expect(page.getByText('Man')).toBeVisible();
  await expect(page.getByText('Fre')).toBeVisible();
});

