import { describe,it,expect } from 'vitest';
import { Chess } from 'chess.js';
import { classify,parseInfo,positions,san,hintIdea,formatScore,terminal,type Evaluation } from './analysis';
const cp = (value:number):Evaluation => ({score:{kind:'cp',value},depth:10,pv:[]});
const mate = (value:number):Evaluation => ({score:{kind:'mate',value},depth:10,pv:[]});
describe('entrenador determinista',()=>{
 it('normaliza cp y mate al punto de vista blanco',()=>{
  const fen=new Chess().fen(); expect(parseInfo('info depth 9 score cp 32 pv e2e4 e7e5',fen)?.score.value).toBe(32);
  const g=new Chess();g.move('e4');expect(parseInfo('info depth 9 score cp 32 pv e7e5',g.fen())?.score.value).toBe(-32);
  expect(parseInfo('info depth 9 score mate -3 pv e7e5',g.fen())?.score.value).toBe(3);
 });
 it('rechaza bounds, PV secundarias e información incompleta',()=>{
  for(const line of ['info depth 9 score cp 5 lowerbound pv e2e4','info depth 9 multipv 2 score cp 5 pv e2e4','info depth 8','bestmove e2e4']) expect(parseInfo(line,new Chess().fen())).toBeUndefined();
 });
 it('clasifica los umbrales exactos y la mejor jugada',()=>{
  const g=new Chess(),m=g.move('e4');
  for(const [loss,label] of [[0,'Buena jugada'],[49,'Buena jugada'],[50,'Imprecisión'],[149,'Imprecisión'],[150,'Error'],[299,'Error'],[300,'Error grave']] as const) expect(classify(cp(0),cp(-loss),m).label).toBe(label);
  expect(classify({...cp(0),bestMove:'e2e4'},cp(0),m).label).toBe('Mejor jugada');
 });
 it('invierte la pérdida para negras',()=>{const g=new Chess();g.move('e4');const m=g.move('e5');expect(classify(cp(0),cp(200),m).loss).toBe(200);expect(classify(cp(0),cp(-200),m).loss).toBe(0);});
 it('trata mates sin inventar centipeones ni penalizar distancias',()=>{
  const m=new Chess().move('e4');
  expect(classify(mate(3),cp(900),m).label).toBe('Error grave');
  expect(classify(cp(0),mate(-4),m).label).toBe('Error grave');
  expect(classify(mate(-3),mate(-6),m).severity).toBe(0);
  expect(classify(mate(3),mate(6),m).loss).toBeUndefined();
 });
 it('describe solo hechos comprobables y no ejecuta una pista',()=>{
  const g=new Chess(),fen=g.fen();const e={...cp(25),bestMove:'e2e4',pv:['e2e4','e7e5','g1f3']};
  expect(hintIdea(fen,e)).toContain('e4 → e5 → Nf3');expect(g.fen()).toBe(fen);expect(san(fen,'e2e5')).toBeUndefined();
 });
 it('reconstruye posiciones sin mutar PGN e incluye tablas por repetición',()=>{
  const g=new Chess();for(const m of ['Nf3','Nf6','Ng1','Ng8','Nf3','Nf6','Ng1','Ng8'])g.move(m);
  const pgn=g.pgn(),timeline=positions(g);expect(timeline).toHaveLength(9);expect(timeline.at(-1)?.terminal?.score.value).toBe(0);expect(g.pgn()).toBe(pgn);
 });
 it('muestra un mate consumado sin distancia falsa',()=>{const g=new Chess();for(const m of ['f3','e5','g4','Qh4#'])g.move(m);expect(formatScore(terminal(g.fen())?.score)).toBe('Jaque mate · ganan negras');});
});
