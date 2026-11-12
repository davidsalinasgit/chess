import { Chess, type Move } from 'chess.js';
export type Score = { kind: 'cp' | 'mate'; value: number; terminal?: boolean };
export interface Evaluation { score: Score; bestMove?: string; pv: string[]; depth: number }
export interface Position { fen: string; move?: Move; terminal?: Evaluation }
export function positions(game: Chess): Position[] {
 const moves = game.history({ verbose: true });
 const replay = new Chess(moves[0]?.before ?? game.fen());
 const result: Position[] = [{fen:replay.fen(),terminal:terminal(replay.fen())}];
 for (const move of moves) { replay.move(move.san); result.push({fen:move.after,move,terminal:replay.isDraw() ? {score:{kind:'cp',value:0},depth:0,pv:[]} : terminal(move.after)}); }
 return result;
}
/** UCI scores are relative to side to move. Ignore bounds and secondary PVs. */
export function parseInfo(line: string, fen: string): Evaluation | undefined {
 if (!line.startsWith('info ') || /\b(upperbound|lowerbound)\b/.test(line) || /multipv ([2-9]|\d{2,})\b/.test(line)) return;
 const score = line.match(/\bscore (cp|mate) (-?\d+)\b/);
 const depth = line.match(/\bdepth (\d+)/);
 if (!score || !depth) return;
 const pv = line.match(/\bpv (.+)$/)?.[1].trim().split(/\s+/) ?? [];
 return { score: { kind: score[1] as Score['kind'], value: Number(score[2]) * (fen.split(' ')[1] === 'w' ? 1 : -1) }, depth: Number(depth[1]), bestMove: pv[0], pv };
}
export function terminal(fen: string): Evaluation | undefined {
 const g = new Chess(fen);
 if (g.isCheckmate()) return { score: {kind:'mate',value:g.turn() === 'w' ? -1 : 1,terminal:true}, depth:0, pv:[] };
 if (g.isDraw()) return { score:{kind:'cp',value:0},depth:0,pv:[] };
}
export function formatScore(score?: Score) {
 if (!score) return 'Pendiente';
 if (score.terminal) return `Jaque mate · ganan ${score.value > 0 ? 'blancas' : 'negras'}`;
 return score.kind === 'mate' ? `Mate · ${score.value > 0 ? 'blancas' : 'negras'} (${Math.abs(score.value)})` : `${score.value >= 0 ? '+' : ''}${score.value} cp`;
}
export function san(fen: string, uci?: string) {
 if (!uci) return undefined;
 try { return new Chess(fen).move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]}).san; } catch { return undefined; }
}
export interface Verdict { label: string; loss?: number; note: string; severity: number }
export function classify(before: Evaluation, after: Evaluation, move: Move): Verdict {
 const side = move.color === 'w' ? 1 : -1;
 const b = before.score, a = after.score;
 const best = before.bestMove === move.from + move.to + (move.promotion ?? '');
 // Mate is categorical, never converted to a fabricated centipawn value.
 if (b.kind === 'mate' || a.kind === 'mate') {
  const wasWinning = b.kind === 'mate' && b.value * side > 0;
  const nowLosing = a.kind === 'mate' && a.value * side < 0;
  if ((wasWinning && !(a.kind === 'mate' && a.value * side > 0)) || (nowLosing && !(b.kind === 'mate' && b.value * side < 0))) return {label:'Error grave',severity:4,note: wasWinning ? 'El motor ya no encuentra el mate favorable que había detectado.' : 'El motor detecta ahora un mate forzado en contra.'};
  return {label: best ? 'Mejor jugada' : 'Sin clasificación en cp',severity:0,note:'Hay una secuencia de mate. No se comparan distancias de mate con centipeones ni se penaliza alargar un mate.'};
 }
 const loss = Math.max(0, Math.round((b.value - a.value) * side));
 const severity = loss >= 300 ? 4 : loss >= 150 ? 3 : loss >= 50 ? 2 : 1;
 return { label: best ? 'Mejor jugada' : ['','Buena jugada','Imprecisión','Error','Error grave'][severity], loss, severity: best ? 0 : severity, note:`Pérdida estimada: ${loss} cp. Evaluaciones aproximadas con búsqueda limitada.` };
}
export function hintIdea(fen: string, evaluation: Evaluation): string {
 const g = new Chess(fen); const uci = evaluation.bestMove;
 if (!uci) return 'No hay una recomendación legal disponible.';
 try {
  const m = g.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});
  const facts = [`Stockfish propone ${m.san}.`];
  if (m.captured) facts.push('La jugada captura una pieza.');
  if (m.isKingsideCastle() || m.isQueensideCastle()) facts.push('La jugada realiza el enroque.');
  if (m.promotion) facts.push('La jugada promociona el peón.');
  if (g.isCheckmate()) facts.push('Da jaque mate.'); else if (g.isCheck()) facts.push('Da jaque.');
  const line = [m.san];
  for (const next of evaluation.pv.slice(1,4)) { try { line.push(g.move({from:next.slice(0,2),to:next.slice(2,4),promotion:next[4]}).san); } catch { break; } }
  if (line.length > 1) facts.push(`Continuación calculada: ${line.join(' → ')}.`);
  facts.push(`Evaluación de esta posición: ${formatScore(evaluation.score)} desde blancas, profundidad ${evaluation.depth}. La variante es orientativa, no una explicación estratégica.`);
  return facts.join(' ');
 } catch { return 'No hay una recomendación legal disponible.'; }
}
