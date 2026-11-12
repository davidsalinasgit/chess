import { AICoach } from './AICoach';
import { useState } from 'react';
import { classify, formatScore, hintIdea, san, type Evaluation, type Position } from './analysis';
interface Props { pgn:string; timeline: Position[]; index: number; reviewing: boolean; results: Map<string,Evaluation>; error: string; retry:()=>void; navigate:(index:number|null)=>void; hidden:boolean; setHidden:(hidden:boolean)=>void }
export function EvalBar({evaluation,hidden}:{evaluation?:Evaluation;hidden:boolean}) {
 const score = evaluation?.score;
 const percent = !score ? 50 : score.kind === 'mate' ? (score.value > 0 ? 100 : 0) : 50 + 45 * Math.tanh(score.value/400);
 if (hidden) return null;
 return <div className="evaluation" aria-label={`Evaluación desde blancas: ${formatScore(score)}`}><div className="eval-track"><div className="eval-white" style={{height:`${percent}%`}}/></div><span>{!score ? '…' : score.kind === 'mate' ? (score.value > 0 ? '+M' : '−M') : `${score.value >= 0 ? '+' : ''}${(score.value/100).toFixed(1)}`}</span></div>;
}
export function Trainer({pgn,timeline,index,reviewing,results,error,retry,navigate,hidden,setHidden}:Props) {
 const [hint,setHint] = useState(false);
 const [idea,setIdea] = useState(false);
 const [detail,setDetail] = useState(false);
 const current = timeline[index], evaluation = results.get(current.fen);
 const previous = index > 0 ? results.get(timeline[index-1].fen) : undefined;
 const verdict = previous && evaluation && current.move ? classify(previous,evaluation,current.move) : undefined;
 const recommended = san(current.fen,evaluation?.bestMove);
 const mistakes = timeline.flatMap((p,i) => {
  if (!i || !p.move) return [];
  const b=results.get(timeline[i-1].fen),a=results.get(p.fen);
  if (!b || !a) return [];
  const v=classify(b,a,p.move); return v.severity >= 3 ? [{i,move:p.move.san,v}] : [];
 }).sort((a,b)=>b.v.severity-a.v.severity || (b.v.loss??0)-(a.v.loss??0)).slice(0,5);
 return <section className="panel trainer" aria-label="Entrenador">
  <div className="panel-title"><h2>Entrenador</h2><span>Stockfish local</span></div>
  <label className="check"><input type="checkbox" checked={hidden} onChange={e=>setHidden(e.target.checked)}/> Ocultar evaluación</label>
  {!hidden && <p className="score" role="status">Evaluación: {formatScore(evaluation?.score)} <small>desde blancas{evaluation ? ` · profundidad ${evaluation.depth}` : ' · calculando…'}</small></p>}
  {error && <p role="alert">{error} <button onClick={retry}>Reintentar análisis</button></p>}
  <div className="actions"><button disabled={!recommended} onClick={()=>setHint(true)}>Pista</button><button disabled={!index || !verdict} onClick={()=>setDetail(true)}>Analizar jugada</button></div>
  {hint && recommended && <div className="coach-detail" data-testid="hint"><p>Jugada recomendada: <strong>{recommended}</strong></p><button onClick={()=>setIdea(v=>!v)}>{idea ? 'Ocultar idea' : 'Explicar idea'}</button>{idea && evaluation && <p>{hintIdea(current.fen,evaluation)}</p>}</div>}
  {detail && verdict && current.move && <div className="coach-detail" data-testid="move-analysis"><p><strong>{current.move.san}: {verdict.label}</strong></p><p>{verdict.note}</p><p>Antes: {formatScore(previous?.score)}. Después: {formatScore(evaluation?.score)}.</p>{previous && <p>Stockfish recomendaba: {san(timeline[index-1].fen,previous.bestMove) ?? 'Sin recomendación disponible'}.</p>}</div>}
  <div className="review-nav" aria-label="Revisión de partida"><button disabled={!index} onClick={()=>navigate(index-1)}>Anterior</button><span>{reviewing ? `Revisión ${index}/${timeline.length-1}` : 'Posición actual'}</span><button disabled={index===timeline.length-1} onClick={()=>navigate(index+1)}>Siguiente</button></div>
  {!reviewing && <button disabled={timeline.length<2} onClick={()=>navigate(timeline.length-1)}>Revisar partida</button>}
  {reviewing && <><button className="primary" onClick={()=>navigate(null)}>Volver a la partida</button><h3>Evaluaciones por jugada</h3><div className="review-list" aria-label="Evaluaciones del historial">{timeline.slice(1).map((p,j)=>{const i=j+1,b=results.get(timeline[i-1].fen),a=results.get(p.fen);return <button key={i} onClick={()=>navigate(i)} aria-current={i===index ? 'step' : undefined}>{Math.ceil(i/2)}{i%2 ? '.' : '…'} {p.move?.san} · {a && b && p.move ? classify(b,a,p.move).label : 'Pendiente'}{!hidden && ` · ${formatScore(a?.score)}`}</button>;})}</div><h3>Principales errores</h3>{mistakes.length ? <ul className="mistakes">{mistakes.map(m=><li key={m.i}><button onClick={()=>navigate(m.i)}>{Math.ceil(m.i/2)}{m.i%2 ? '.' : '…'} {m.move} · {m.v.label}{m.v.loss !== undefined ? ` (${m.v.loss} cp)` : ''}</button></li>)}</ul> : <p className="muted">Sin errores importantes entre las jugadas analizadas.</p>}<p className="muted">{timeline.filter(p=>results.has(p.fen)).length}/{timeline.length} posiciones analizadas. Las clasificaciones son orientativas.</p></>}
  <AICoach pgn={pgn} timeline={timeline} index={index} reviewing={reviewing} results={results}/>
 </section>;
}
