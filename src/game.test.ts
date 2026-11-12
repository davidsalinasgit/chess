import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { opening, OPENING_FEN, restore, save, undoTurn, status } from './game';
describe('reglas y persistencia', () => {
 it('reconstruye exactamente el FEN de la Española y conserva las 22 medias jugadas', () => { const g = opening(); expect(g.fen()).toBe(OPENING_FEN); expect(g.history()).toHaveLength(22); expect(g.turn()).toBe('w'); });
 it('rechaza movimientos ilegales', () => { expect(() => new Chess().move({from:'e2',to:'e5'})).toThrow(); });
 it('permite enroque y captura al paso', () => { const g = opening(); expect(g.history()).toContain('O-O'); const e = new Chess(); for (const m of ['e4','a6','e5','d5','exd6']) e.move(m); expect(e.get('d5')).toBeUndefined(); expect(e.get('d6')?.color).toBe('w'); });
 it('permite las cuatro promociones', () => { for (const promotion of ['q','r','b','n']) { const g = new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1'); g.move({from:'a7',to:'a8',promotion}); expect(g.get('a8')?.type).toBe(promotion); } });
 it('detecta mate', () => { const g = new Chess(); for (const m of ['f3','e5','g4','Qh4#']) g.move(m); expect(status(g)).toBe('Jaque mate. Ganan las negras.'); expect(g.isGameOver()).toBe(true); });
 it('deshace el turno completo o la jugada pendiente', () => { const g = new Chess(); g.move('e4'); undoTurn(g); expect(g.history()).toHaveLength(0); g.move('d4'); g.move('d5'); undoTurn(g); expect(g.history()).toHaveLength(0); });
 it('guarda y recupera el historial y la dificultad', () => { let data = ''; const storage = { setItem: (_:string,v:string) => {data=v;}, getItem: () => data }; const g = opening(); save(storage,g,12); const recovered = restore(storage); expect(recovered.game.fen()).toBe(OPENING_FEN); expect(recovered.game.history()).toEqual(g.history()); expect(recovered.difficulty).toBe(12); });
 it('no acepta datos corruptos ni FEN incoherente', () => { expect(restore({ getItem: () => '{' }).warning).toBeTruthy(); expect(restore({getItem: () => JSON.stringify({version:1,pgn:'1. e4',fen:OPENING_FEN})}).warning).toBeTruthy(); });
 it('conserva la repetición al recuperar el PGN', () => { const g = new Chess(); for(const m of ['Nf3','Nf6','Ng1','Ng8','Nf3','Nf6','Ng1','Ng8']) g.move(m); let data=''; save({setItem:(_,v)=>{data=v;}},g,5); expect(restore({getItem:()=>data}).game.isThreefoldRepetition()).toBe(true); });
});
