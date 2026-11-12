import { Chess } from 'chess.js';
import { classify, formatScore, positions, san, type Evaluation } from '../src/analysis.js';
import type { CoachRequest } from '../src/coach.js';
export class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
export function validateRequest(input:unknown) {
 const fail=()=>{throw new HttpError(400,'Los datos de la partida o del análisis no son válidos.');};
 if(!input || typeof input!=='object')return fail();
 const r=input as CoachRequest;
 if(typeof r.pgn!=='string' || r.pgn.length>48000 || typeof r.fen!=='string' || r.fen.length>100 || r.language!=='es' || typeof r.lastMove!=='string' || r.lastMove.length>16)return fail();
 if(!['principiante','intermedio','avanzado'].includes(r.level??'') || typeof r.question!=='string' || r.question.length>1000)return fail();
 if(r.pgn.replace(/\{[^}]*\}/gs,' ').replace(/\[[^\]]*\]/gs,' ').trim().split(/\s+/).length>2000)return fail();
 let g:Chess;
 try {g=new Chess();g.loadPgn(r.pgn,{strict:true});}catch{return fail();}
 const history=g.history({verbose:true});
 if(history.length>600 || !Number.isInteger(r.positionPly) || r.positionPly!<0 || r.positionPly!>history.length || !Number.isInteger(r.selectedPly) || r.selectedPly!<0 || r.selectedPly!>r.positionPly!)return fail();
 const timeline=positions(g), visible=timeline[r.positionPly!];
 if(visible.fen!==r.fen)return fail();
 const selected=timeline[r.selectedPly!];
 if((selected.move?.san??'')!==r.lastMove)return fail();
 function evaluation(value:unknown,fen:string):Evaluation {
  if(!value || typeof value!=='object')return fail();
  const e=value as Evaluation;
  if(!e.score || !['cp','mate'].includes(e.score.kind) || !Number.isInteger(e.score.value) || Math.abs(e.score.value)>(e.score.kind==='cp'?100000:1000) || !Number.isInteger(e.depth) || e.depth<0 || e.depth>100 || !Array.isArray(e.pv) || e.pv.length>8)return fail();
  const board=new Chess(fen);
  try {
   for(const uci of e.pv){if(typeof uci!=='string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci))return fail();board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});}
  }catch{return fail();}
  if(e.bestMove!==undefined && (typeof e.bestMove!=='string' || e.bestMove!==e.pv[0]))return fail();
  if(e.score.kind==='mate' && e.score.value===0)return fail();
  return {score:{kind:e.score.kind,value:e.score.value},depth:e.depth,pv:[...e.pv],...(e.bestMove?{bestMove:e.bestMove}:{})};
 }
 if(!r.evidence)return fail();
 const suppliedCurrent=evaluation(r.evidence.current,r.fen);
 const current=visible.terminal ?? suppliedCurrent;
 let before:Evaluation|undefined,after:Evaluation|undefined;
 if(r.selectedPly!>0){const beforePosition=timeline[r.selectedPly!-1];before=evaluation(r.evidence.before,beforePosition.fen);after=evaluation(r.evidence.after,selected.fen);before=beforePosition.terminal??before;after=selected.terminal??after;}
 const facts=[`Posición actual: ${formatScore(current.score)} desde blancas; profundidad ${current.depth}.`, `Turno actual: ${new Chess(r.fen).turn()==='w'?'blancas':'negras'}.`];
 if(selected.move && before && after){
  facts.push(`Jugada seleccionada: ${selected.move.san} (${selected.move.color==='w'?'blancas':'negras'}), media jugada ${r.selectedPly}.`);
  facts.push(`Antes: ${formatScore(before.score)}. Después: ${formatScore(after.score)}. Recomendación previa: ${san(timeline[r.selectedPly!-1].fen,before.bestMove)??'no disponible'}.`);
  const verdict=classify(before,after,selected.move);facts.push(`Clasificación orientativa: ${verdict.label}. ${verdict.note}`);
 }
 const toSanLine=(fen:string,e:Evaluation)=>{
  const board=new Chess(fen);return e.pv.map(uci=>board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]}).san);
 };
 const clean = new Chess(history[0]?.before ?? g.fen());
 for (const move of history) clean.move(move.san);
 return {
  level:r.level!,question:r.question.trim(),facts,
  data:{fen:r.fen,pgn:clean.pgn(),selectedPly:r.selectedPly,positionPly:r.positionPly,lastMove:r.lastMove,evidence:{current,before,after},currentLine:toSanLine(r.fen,current),recommendedLine:before?toSanLine(timeline[r.selectedPly!-1].fen,before):[]},
 };
}
