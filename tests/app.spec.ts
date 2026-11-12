import { test, expect } from '@playwright/test';
async function square(page: import('@playwright/test').Page, name: string) { await page.locator(`[data-square="${name}"]`).click(); }
test('partida real, motor, guardado, deshacer, recuperación y exportación', async ({ page }) => {
 const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
 await page.goto('/');
 await expect(page.getByRole('status').filter({hasText: /^Tu turno · Blancas$/})).toBeVisible();
 await square(page,'e2'); await square(page,'e4');
 await expect(page.getByText('e4', {exact:true})).toBeVisible();
 await expect(page.getByRole('status').filter({hasText: /^Tu turno · Blancas$/})).toBeVisible({timeout:30000});
 await expect(page.locator('.move > button').nth(1)).not.toHaveText('—');
 await page.reload(); await expect(page.getByText('e4', {exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Deshacer turno'}).click();
 await expect(page.getByText('Tu primera jugada abre el camino.')).toBeVisible();
 await page.getByRole('button',{name:'Recuperar la apertura'}).click(); await page.getByRole('button',{name:'Continuar'}).click();
 await expect(page.getByText('Re8',{exact:true})).toBeVisible();
 const download = page.waitForEvent('download'); await page.getByRole('button',{name:'Exportar PGN'}).click();
 expect((await download).suggestedFilename()).toMatch(/^chess-coach-\d{4}-\d{2}-\d{2}-\d{4}\.pgn$/);
 await page.reload(); await expect(page.getByText('Re8',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Nueva partida'}).click(); await page.getByRole('button',{name:'Continuar'}).click();
 await expect(page.getByText('Tu primera jugada abre el camino.')).toBeVisible();
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
 expect(errors).toEqual([]);
});
test('movimiento ilegal y cambio de partida durante búsqueda', async ({page}) => {
 await page.goto('/'); await square(page,'e2'); await square(page,'e5');
 await expect(page.getByText('Tu primera jugada abre el camino.')).toBeVisible();
 await square(page,'e2'); await square(page,'e4');
 await page.getByRole('button',{name:'Deshacer turno'}).click();
 await expect(page.getByText('Tu primera jugada abre el camino.')).toBeVisible();
 await expect(page.getByRole('status').filter({hasText: /^Tu turno · Blancas$/})).toBeVisible();
});
test('promoción elegida y final de partida', async ({page}) => {
 const fen = '7k/P7/8/8/8/8/8/7K w - - 0 1';
 await page.addInitScript(({fen}) => localStorage.setItem('chess-coach.v1',JSON.stringify({version:1,fen,pgn:`[SetUp "1"]\n[FEN "${fen}"]\n\n*`,difficulty:0})),{fen});
 await page.goto('/'); await square(page,'a7'); await square(page,'a8');
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByRole('button',{name:'Caballo',exact:true}).click();
 await expect(page.getByText('a8=N',{exact:true})).toBeVisible();
 await expect(page.getByRole('status').filter({hasText:'Tablas por material insuficiente.'})).toBeVisible();
});
