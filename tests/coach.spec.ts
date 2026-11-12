import { test, expect, type Page } from '@playwright/test';
async function square(page:Page,name:string){await page.locator(`[data-square="${name}"]`).click();}
async function saved(page:Page){return page.evaluate(()=>localStorage.getItem('chess-coach.v1'));}
test('evaluación automática, pistas explícitas, rival y revisión sin mutaciones',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const state={active:0,max:0}; (window as unknown as {workerStats:typeof state}).workerStats=state;
  const NativeWorker=window.Worker;
  window.Worker=class extends NativeWorker {
   ended=false;
   constructor(url:string|URL,options?:WorkerOptions){super(url,options);state.active++;state.max=Math.max(state.max,state.active);}
   terminate(){if(!this.ended){this.ended=true;state.active--;}super.terminate();}
  };
 });
 await page.goto('/'); const coach=page.getByRole('region',{name:'Entrenador'});
 await expect(coach.getByRole('status')).toContainText('cp',{timeout:30000});
 await expect(page.getByTestId('hint')).toHaveCount(0);
 const start=await saved(page);
 await coach.getByRole('button',{name:'Pista',exact:true}).click();
 await expect(page.getByTestId('hint')).toContainText('Jugada recomendada:');
 await coach.getByRole('button',{name:'Explicar idea',exact:true}).click();
 await expect(page.getByTestId('hint')).toContainText('Stockfish propone');
 expect(await saved(page)).toBe(start);
 await square(page,'e2');await square(page,'e4');
 await expect(page.getByRole('status').filter({hasText:/^Tu turno · Blancas$/})).toBeVisible({timeout:30000});
 await expect(page.locator('.move > button')).toHaveCount(2);
 await expect(page.getByTestId('hint')).toHaveCount(0);
 await expect(page.getByTestId('move-analysis')).toHaveCount(0);
 await expect(coach.getByRole('button',{name:'Analizar jugada',exact:true})).toBeEnabled({timeout:30000});
 await coach.getByRole('button',{name:'Analizar jugada',exact:true}).click();
 await expect(page.getByTestId('move-analysis')).toContainText('Stockfish recomendaba:');
 const current=await saved(page);
 await coach.getByRole('button',{name:'Revisar partida',exact:true}).click();
 await expect(coach.getByText('Principales errores', {exact:true})).toBeVisible();
 await coach.getByRole('button',{name:'Anterior',exact:true}).click();
 await expect(coach.getByText('Revisión 1/2',{exact:true})).toBeVisible();
 await square(page,'d2');await square(page,'d4');expect(await saved(page)).toBe(current);
 await coach.getByRole('button',{name:'Volver a la partida',exact:true}).click();expect(await saved(page)).toBe(current);
 await coach.getByLabel('Ocultar evaluación').check();
 await expect(page.locator('.evaluation')).toHaveCount(0);await expect(coach.getByRole('status')).toHaveCount(0);
 await page.reload();await expect(page.getByLabel('Ocultar evaluación')).toBeChecked();
 await expect(page.locator('.move > button')).toHaveCount(2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 expect(await page.evaluate(()=>(window as unknown as {workerStats:{max:number}}).workerStats.max)).toBeLessThanOrEqual(2);
});
test('cancela al cambiar de posición o partida y conserva la Española',async({page})=>{
 await page.goto('/');await square(page,'e2');await square(page,'e4');
 await page.getByRole('button',{name:'Deshacer turno',exact:true}).click();
 await page.getByRole('button',{name:'Recuperar la apertura',exact:true}).click();await page.getByRole('button',{name:'Continuar',exact:true}).click();
 await expect(page.getByText('Re8',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Revisar jugada 1: e4',exact:true}).click();
 await page.getByRole('button',{name:'Anterior',exact:true}).click();await page.getByRole('button',{name:'Siguiente',exact:true}).click();
 await page.getByRole('button',{name:'Volver a la partida',exact:true}).click();
 expect(JSON.parse((await saved(page))!).fen).toBe('r2qr1k1/2p1bppp/p1np1n2/1p2p2b/3PP3/1BP2N1P/PP1N1PP1/R1BQR1K1 w - - 3 12');
 await page.getByRole('button',{name:'Nueva partida',exact:true}).click();await page.getByRole('button',{name:'Continuar',exact:true}).click();
 await expect(page.getByText('Tu primera jugada abre el camino.',{exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Entrenador'}).getByRole('status')).toContainText('cp',{timeout:30000});
 await expect(page.getByTestId('hint')).toHaveCount(0);
});
