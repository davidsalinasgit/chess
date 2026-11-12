import { test,expect,type Page } from '@playwright/test';
import { Chess } from 'chess.js';
import { OPENING_FEN } from '../src/game';
const imported='[Event "Mi estudio"]\n[White "Ana"]\n[Black "Luis"]\n[Date "2026.11.11"]\n\n1. d4 d5 2. c4 *';
const saved=async(page:Page)=>{await expect.poll(()=>page.evaluate(()=>localStorage.getItem('chess-coach.v1'))).not.toBeNull();return page.evaluate(()=>localStorage.getItem('chess-coach.v1'));};
async function readDownload(download:import('@playwright/test').Download){const stream=await download.createReadStream();const chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(Buffer.from(chunk));return Buffer.concat(chunks).toString('utf8');}
test('importa y recupera un PGN separado, conserva partida y exporta íntegramente',async({page})=>{
 await page.addInitScript(()=>{
  const counts={rival:0};(window as unknown as {counts:typeof counts}).counts=counts;const Native=Worker;
  window.Worker=class extends Native{postMessage(message:unknown){if(typeof message==='string'&&message.startsWith('go movetime '))counts.rival++;super.postMessage(message);}};
 });
 await page.goto('/');await page.getByRole('button',{name:'Recuperar la apertura',exact:true}).click();await page.getByRole('button',{name:'Continuar',exact:true}).click();
 await expect.poll(async()=>JSON.parse((await saved(page))!).fen).toBe(OPENING_FEN);
 const live=await saved(page);
 await page.getByLabel('Archivo PGN',{exact:true}).setInputFiles({name:'estudio.pgn',mimeType:'application/x-chess-pgn',buffer:Buffer.from(imported)});
 await expect(page.getByRole('dialog')).toBeVisible();expect(await saved(page)).toBe(live);
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(page.getByRole('button',{name:'Revisar jugada 22: Re8',exact:true})).toBeVisible();
 await page.getByLabel('Archivo PGN',{exact:true}).setInputFiles({name:'estudio.pgn',mimeType:'application/x-chess-pgn',buffer:Buffer.from(imported)});
 await page.getByRole('button',{name:'Abrir en revisión',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Modo Revisión · PGN importado'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Revisar jugada 3: c4',exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Entrenador'}).getByRole('status').filter({hasText:'cp'})).toBeVisible({timeout:30000});
 expect(await page.evaluate(()=>(window as unknown as {counts:{rival:number}}).counts.rival)).toBe(0);expect(await saved(page)).toBe(live);
 await page.reload();await expect(page.getByRole('status').filter({hasText:'Modo Revisión · PGN importado'})).toBeVisible();
 await page.getByRole('button',{name:'Anterior',exact:true}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Preparar partida para análisis',exact:true}).click();
 const file=await download;expect(file.suggestedFilename()).toMatch(/^chess-coach-\d{4}-\d{2}-\d{2}-\d{4}\.pgn$/);
 const g=new Chess();g.loadPgn(await readDownload(file),{strict:true});expect(g.history()).toEqual(['d4','d5','c4']);expect(g.getHeaders().White).toBe('Ana');
 await page.getByRole('button',{name:'Volver a la partida',exact:true}).click();expect(await saved(page)).toBe(live);await expect(page.getByRole('button',{name:'Revisar jugada 22: Re8',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Revisar PGN importado',exact:true}).click();await expect(page.getByRole('button',{name:'Revisar jugada 3: c4',exact:true})).toBeVisible();
});
test('PGN inválido no cambia el guardado; exporta también sin jugadas',async({page})=>{
 await page.goto('/');const before=await saved(page);
 await page.getByLabel('Archivo PGN',{exact:true}).setInputFiles({name:'ilegal.pgn',mimeType:'text/plain',buffer:Buffer.from('1. e4 e5 2. Ke3 *')});await expect(page.getByRole('alert')).toContainText('PGN inválido');expect(await saved(page)).toBe(before);
 const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar PGN',exact:true}).click();const g=new Chess();g.loadPgn(await readDownload(await downloading),{strict:true});expect(g.history()).toEqual([]);expect(g.getHeaders()).toMatchObject({White:'Usuario',Black:'Stockfish',Result:'*'});
});
test('IA solo explícita, código de acceso, pregunta y nivel sin modificar partida',async({page})=>{
 const requests:Record<string,unknown>[]=[];
 await page.route('**/api/coach',async route=>{
  const body=route.request().postDataJSON();requests.push(body);
  if(body.action==='unlock')return route.fulfill({status:200,json:{unlocked:true}});
  if(requests.length===1)return route.fulfill({status:401,json:{error:'Introduce el código de acceso.'}});
  return route.fulfill({json:{explanation:'Interpretación educativa en español.',mistakes:['La amenaza es una hipótesis por comprobar.'],suggestions:['Contrasta este plan con Stockfish.'],facts:['Evaluación calculada en el navegador.']}});
 });
 await page.goto('/');await page.getByRole('button',{name:'Recuperar la apertura',exact:true}).click();await page.getByRole('button',{name:'Continuar',exact:true}).click();
 const button=page.getByRole('button',{name:'Explicar con IA',exact:true});await expect(button).toBeEnabled({timeout:30000});expect(requests).toHaveLength(0);
 const before=await saved(page);await button.click();await page.getByLabel('Código de acceso a la IA',{exact:true}).fill('codigo-de-prueba');await page.getByRole('button',{name:'Habilitar acceso',exact:true}).click();await expect(page.getByText(/Acceso habilitado/)).toBeVisible();expect(requests).toHaveLength(2);
 await page.getByLabel('Nivel',{exact:true}).selectOption('avanzado');await button.click();await expect(page.getByTestId('ai-response')).toContainText('Interpretación educativa en español.');
 const explanation=requests[2];expect(explanation.level).toBe('avanzado');expect(explanation.lastMove).toBe('Nbd2');expect(explanation.selectedPly).toBe(21);expect(explanation.positionPly).toBe(22);expect(explanation.evidence).toBeTruthy();
 await page.getByLabel('Pregunta sobre esta posición',{exact:true}).fill('¿Qué amenaza el adversario?');await page.getByRole('button',{name:'Enviar pregunta',exact:true}).click();await expect.poll(()=>requests.length).toBe(4);expect(requests[3].question).toBe('¿Qué amenaza el adversario?');expect(await saved(page)).toBe(before);
});
test('API no configurada conserva pistas y tablero',async({page})=>{
 await page.route('**/api/coach',route=>route.fulfill({status:503,json:{error:'La IA no está configurada. Stockfish sigue disponible.'}}));
 await page.goto('/');const button=page.getByRole('button',{name:'Explicar con IA',exact:true});await expect(button).toBeEnabled({timeout:30000});await button.click();await expect(page.getByText('La IA no está configurada. Stockfish sigue disponible.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Pista',exact:true}).click();await expect(page.getByTestId('hint')).toContainText('Jugada recomendada:');
 await page.locator('[data-square="e2"]').click();await page.locator('[data-square="e4"]').click();await expect(page.getByRole('status').filter({hasText:/^Tu turno · Blancas$/})).toBeVisible({timeout:30000});await expect(page.locator('.move > button')).toHaveCount(2);
});
