import { describe,it,expect } from 'vitest';
import { Chess } from 'chess.js';
import { exportPgn,importPgn,localDate,stampGame } from './pgn';
import { opening,OPENING_FEN } from './game';
describe('gestión PGN sin pérdida de jugadas',()=>{
 it('exporta nombres locales, metadatos y la Española completa sin mutar',()=>{
  const game=opening(),original=game.pgn(),date=new Date(2026,10,11,21,58);
  const file=exportPgn(game,date);expect(file.filename).toBe('chess-coach-2026-11-11-2158.pgn');
  const restored=importPgn(file.text);expect(restored.fen()).toBe(OPENING_FEN);expect(restored.history()).toEqual(game.history());
  expect(restored.getHeaders()).toMatchObject({Event:'Chess Coach - Entrenamiento',Date:'2026.11.11',White:'Usuario',Black:'Stockfish',Result:'*'});expect(game.pgn()).toBe(original);
 });
 it('mantiene cabeceras, comentarios y posición inicial personalizada',()=>{
  const g=importPgn('[Event "Estudio"]\n[White "Ana"]\n[Black "Luis"]\n[Date "2025.01.03"]\n[SetUp "1"]\n[FEN "7k/P7/8/8/8/8/8/7K w - - 0 1"]\n\n1. a8=Q+ {Promoción} Kh7 *');
  const restored=importPgn(exportPgn(g,new Date(),true).text);expect(restored.history()).toEqual(g.history());expect(restored.getHeaders().White).toBe('Ana');expect(restored.getHeaders().Date).toBe('2025.01.03');expect(restored.getComments()).toEqual(g.getComments());
 });
 it('exporta una partida vacía válida, una inconclusa y un mate',()=>{
  for(const moves of [[],['e4'],['f3','e5','g4','Qh4#']]){const g=new Chess();moves.forEach(m=>g.move(m));const r=importPgn(exportPgn(g).text);expect(r.history()).toEqual(g.history());expect(r.getHeaders().Result).toBe(moves.length===4?'0-1':'*');}
 });
 it('conserva resultados declarados por abandono y metadatos de fecha',()=>{const g=importPgn('[Result "1-0"]\n\n1. e4 e5 1-0');expect(importPgn(exportPgn(g).text).getHeaders().Result).toBe('1-0');stampGame(g,new Date(2026,0,2));expect(g.getHeaders().Date).toBe('2026.01.02');expect(localDate(new Date(2026,0,2,3,4)).stamp).toBe('2026-01-02-0304');});
 it('rechaza entrada vacía, ilegal, grande, múltiples partidas y variantes sin truncar',()=>{
  for(const bad of ['', 'hola', '1. e4 e5 2. Ke3 *','x'.repeat(262145),'1. e4 {'+'a'.repeat(262120)+'} *','[Event "A"]\n1. e4 *\n[Event "B"]\n1. d4 *','1. e4 (1. d4 d5) e5 *'])expect(()=>importPgn(bad)).toThrow();
 });
});
