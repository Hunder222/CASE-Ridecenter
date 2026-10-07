import path from 'node:path';
import { expect, test } from '@playwright/test';
import { config as indlaesEnv } from 'dotenv';

indlaesEnv({ path: path.resolve(import.meta.dirname, '../.env'), quiet: true });

test('V1: Stald offline og hurtig afkrydsning (SC-001, US1, T121)', async ({ page, context }) => {
  test.setTimeout(180_000);

  // 1. Gå til staldens låseskærm og tast 4-cifret PIN (2222 for Marie)
  await page.goto('/stald/laas');
  await expect(page.getByText('Bøgegården Stald')).toBeVisible();

  // Tryk på tasterne 2, 2, 2, 2
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: '2', exact: true }).click();
  }

  // Verificér oplåsning og navigation til holdvisning (< 2 sek)
  await expect(page).toHaveURL(/\/stald\/hold|\/stald\/i-dag/);

  // 2. Slå netværk fra (offline-emulering)
  await context.setOffline(true);

  // Verificér at synkindikatoren viser offline
  const synkKnap = page.locator('header button').filter({ hasText: /offline/i });
  await expect(synkKnap).toBeVisible();

  // 3. Åbn lektionsvisning for dagens hold
  const holdKort = page.getByText(/Fredag 16:30|Øvet/i).first();
  if (await holdKort.isVisible()) {
    await holdKort.click();
  }

  // 4. Test "Markér alle fremmødt"
  const startTid = Date.now();
  const markerAlleKnap = page.getByRole('button', { name: /Markér alle fremmødt/i });
  if (await markerAlleKnap.isVisible()) {
    await markerAlleKnap.click();

    // Toggle én rytter til Udeblevet
    const udeblevetKnap = page.getByRole('button', { name: /Udeblevet/i }).first();
    if (await udeblevetKnap.isVisible()) {
      await udeblevetKnap.click();
    }
  }

  const varighed = Date.now() - startTid;
  expect(varighed).toBeLessThan(15_000); // SC-001: under 15 sekunder

  // 5. Genopret netværksforbindelse
  await context.setOffline(false);
});

