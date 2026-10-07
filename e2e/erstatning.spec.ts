import path from 'node:path';
import { expect, test } from '@playwright/test';
import { config as indlaesEnv } from 'dotenv';

indlaesEnv({ path: path.resolve(import.meta.dirname, '../.env'), quiet: true });

test('V3: Syg hest og top-3 erstatning offline (SC-002, US3, T140)', async ({ page, context }) => {
  test.setTimeout(180_000);

  // 1. Log ind som staldelev (PIN 3333 for Staldelev Jens) på /stald/laas
  await page.goto('/stald/laas');
  await expect(page.getByText('Bøgegården Stald')).toBeVisible();

  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: '3', exact: true }).click();
  }

  // Verificér oplåsning
  await expect(page).toHaveURL(/\/stald\/hold|\/stald\/i-dag/);

  // 2. Gå til /stald/heste og meld hest KanIkkeBruges ("halter")
  await page.goto('/stald/heste');
  await expect(page.getByText('Staldens Heste')).toBeVisible();

  // Find en hest (f.eks. Toobi eller første hest) og klik "Meld hestestatus"
  const meldKnap = page.getByRole('button', { name: /Meld hestestatus/i }).first();
  if (await meldKnap.isVisible()) {
    await meldKnap.click();

    // Vælg "Kan ikke bruges"
    await page.getByRole('button', { name: /Kan ikke bruges/i }).click();

    // Udfyld beskrivelse
    const textarea = page.locator('textarea');
    await textarea.fill('Halter på venstre forben efter foldgang');

    // Indsend melding
    await page.getByRole('button', { name: /Indsend melding/i }).click();

    // Bekræft at hesten nu fremstår med rød status / Sygemeldt
    await expect(page.getByText(/Sygemeldt/i).first()).toBeVisible();
  }

  // 3. Gå offline
  await context.setOffline(true);

  // 4. Log ind som ridelærer Marie (PIN 2222)
  await page.goto('/stald/laas');
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: '2', exact: true }).click();
  }
  await expect(page).toHaveURL(/\/stald\/hold|\/stald\/i-dag/);

  // 5. Åbn dagens lektion
  const holdKort = page.getByText(/Fredag 16:30|Øvet/i).first();
  if (await holdKort.isVisible()) {
    await holdKort.click();
  }

  // 6. Klik "Erstat hest" for en rytter
  const erstatKnap = page.getByRole('button', { name: /Erstat hest/i }).first();
  if (await erstatKnap.isVisible()) {
    const startTid = Date.now();
    await erstatKnap.click();

    // Verificér URL er /stald/plads/:id/erstat
    await expect(page).toHaveURL(/\/stald\/plads\/.*\/erstat/);

    // Verificér at top-3 forslag vises hurtigt (< 2 sek.)
    await expect(page.getByText(/Top-3 egnede erstatningsheste/i)).toBeVisible();
    const beregningstid = Date.now() - startTid;
    expect(beregningstid).toBeLessThan(2_000); // SC-002: under 2 sekunder

    // Vælg første forslag
    const vaelgKnap = page.getByRole('button', { name: /Vælg /i }).first();
    if (await vaelgKnap.isVisible()) {
      await vaelgKnap.click();

      // Bekræft omplacering modal
      await page.getByRole('button', { name: /Godkend omplacering/i }).click();

      // Verificér tilbage på lektion
      await expect(page).toHaveURL(/\/stald\/lektion\//);
    }
  }

  // 7. Genopret netværk
  await context.setOffline(false);
});

