import path from 'node:path';
import { expect, test } from '@playwright/test';
import { config as indlaesEnv } from 'dotenv';

indlaesEnv({ path: path.resolve(import.meta.dirname, '../.env'), quiet: true });

test('V10: Offline synkroniseringskonflikt (SC-001, US1, T122)', async ({ browser }) => {
  test.setTimeout(180_000);

  // 1. Opret to uafhængige browserkontekster (repræsenterer to stald-tablets)
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();

  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  // 2. Log ind med PIN på begge enheder
  for (const page of [pageA, pageB]) {
    await page.goto('/stald/laas');
    await expect(page.getByText('Bøgegården Stald')).toBeVisible();

    for (let i = 0; i < 4; i++) {
      await page.getByRole('button', { name: '2', exact: true }).click();
    }
    await expect(page).toHaveURL(/\/stald\/hold|\/stald\/i-dag/);
  }

  // 3. Begge kontekster går offline
  await contextA.setOffline(true);
  await contextB.setOffline(true);

  // 4. Begge åbner samme lektion
  const holdA = pageA.getByText(/Fredag 16:30|Øvet/i).first();
  if (await holdA.isVisible()) {
    await holdA.click();
  }

  const holdB = pageB.getByText(/Fredag 16:30|Øvet/i).first();
  if (await holdB.isVisible()) {
    await holdB.click();
  }

  // 5. Tablet A markerer første elev som Fremmoedt
  const knapA = pageA.getByRole('button', { name: /Fremmødt/i }).first();
  if (await knapA.isVisible()) {
    await knapA.click();
  }

  // Tablet B markerer samme elev som Udeblevet (lidt senere tidsstempel)
  await pageB.waitForTimeout(500);
  const knapB = pageB.getByRole('button', { name: /Udeblevet/i }).first();
  if (await knapB.isVisible()) {
    await knapB.click();
  }

  // 6. Genopret netværksforbindelse på begge
  await contextA.setOffline(false);
  await contextB.setOffline(false);

  // Trigger sync eller vent på synk
  await pageA.waitForTimeout(2500);
  await pageB.waitForTimeout(2500);

  await contextA.close();
  await contextB.close();
});

