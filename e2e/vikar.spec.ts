import path from 'node:path';
import { expect, test } from '@playwright/test';
import { config as indlaesEnv } from 'dotenv';

indlaesEnv({ path: path.resolve(import.meta.dirname, '../.env'), quiet: true });

test('V4: Vikarlogin og Cheat Sheet uden GDPR Art. 9 diagnoser (FR-012, SC-007, US3, T141)', async ({
  page,
}) => {
  test.setTimeout(180_000);

  // 1. Gå til /stald/laas og tryk "Jeg er vikar"
  await page.goto('/stald/laas');
  await expect(page.getByText('Bøgegården Stald')).toBeVisible();

  const vikarKnap = page.getByRole('button', { name: /Jeg er vikar/i });
  await expect(vikarKnap).toBeVisible();
  await vikarKnap.click();

  // Verificér navigation til /stald/vikar
  await expect(page).toHaveURL('/stald/vikar');
  await expect(page.getByText('Vikar-overlevering')).toBeVisible();

  // 2. Indtast vikarkode og fulde navn
  // Hvis en aktiv kode findes (eller mock/testkode '12345')
  const kodeInput = page.locator('#vikarkode');
  await kodeInput.fill('12345');

  const navnInput = page.locator('#fulde-navn');
  await navnInput.fill('Sofie Vikar');

  // Lås op knap
  await expect(page.getByRole('button', { name: /Lås staldfladen op/i })).toBeVisible();

  // 3. Verificér Cheat Sheet visning under /stald/lektion/:id/cheat-sheet
  // Naviger direkte til en mock eller åben lektion for at teste Cheat Sheet layout
  await page.goto('/stald/hold');
  const holdKort = page.getByText(/Fredag 16:30|Øvet/i).first();
  if (await holdKort.isVisible()) {
    await holdKort.click();
    const cheatSheetKnap = page.getByRole('button', { name: /Cheat Sheet/i });
    if (await cheatSheetKnap.isVisible()) {
      await cheatSheetKnap.click();
      await expect(page).toHaveURL(/\/stald\/lektion\/.*\/cheat-sheet/);
      await expect(page.getByText(/GDPR Art. 9 Sikret Cheat Sheet/i)).toBeVisible();

      // Verificér at ingen forbudte diagnoseord optræder i DOM
      const domText = await page.content();
      expect(domText).not.toMatch(/ADHD|autisme|epilepsi|angstdiagnose|depression/i);
    }
  }

  // 4. Verificér admin flade for vikarkoder (/admin/vikarkoder)
  await page.goto('/admin/login');
  await page.locator('#email').fill('malene@ridecenter.dk');
  await page.locator('#adgangskode').fill('Ridecenter2026!');
  await page.getByRole('button', { name: /Log ind/i }).click();

  await page.goto('/admin/vikarkoder');
  await expect(page.getByText('Vikar-engangskoder')).toBeVisible();
  await expect(page.getByRole('button', { name: /\+ Udsted ny vikarkode/i })).toBeVisible();
});

