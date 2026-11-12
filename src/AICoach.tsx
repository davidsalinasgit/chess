import { useEffect,useRef,useState } from 'react';
import { CoachError,ServerCoach,type CoachAdvice,type CoachLevel,type CoachRequest } from './coach';
import type { Evaluation,Position } from './analysis';
interface Props {pgn:string;timeline:Position[];index:number;reviewing:boolean;results:Map<string,Evaluation>}
const service=new ServerCoach();
function evidence(e:Evaluation):Evaluation{return {...e,pv:e.pv.slice(0,8)};}
export function AICoach({pgn,timeline,index,reviewing,results}:Props) {
 const [level,setLevel]=useState<CoachLevel>(()=>{try{const saved=localStorage.getItem('chess-coach.coach-level');return ['principiante','intermedio','avanzado'].includes(saved??'')?saved as CoachLevel:'principiante';}catch{return 'principiante';}});
 const [question,setQuestion]=useState('');const [code,setCode]=useState('');
 const [needsCode,setNeedsCode]=useState(false);const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');const [advice,setAdvice]=useState<CoachAdvice|null>(null);
 const abort=useRef<AbortController|null>(null);
 useEffect(()=>()=>abort.current?.abort(),[]);
 let selectedPly=reviewing?index:0;
 if(!reviewing)for(let i=index;i>0;i--)if(timeline[i].move?.color==='w'){selectedPly=i;break;}
 const selected=timeline[selectedPly];
 const current=results.get(timeline[index].fen),before=selectedPly?results.get(timeline[selectedPly-1].fen):undefined,after=selectedPly?results.get(selected.fen):undefined;
 const ready=!!current && (!selectedPly || !!before && !!after);
 function request():CoachRequest {
  return {pgn,fen:timeline[index].fen,lastMove:selected.move?.san??'',language:'es',selectedPly,positionPly:index,level,question:question.trim(),evidence:{current:evidence(current!),before:before?evidence(before):undefined,after:after?evidence(after):undefined}};
 }
 async function run(unlock=false) {
  if(busy || (!unlock && !ready))return;
  setBusy(true);setMessage('');setAdvice(null);
  const controller=new AbortController();abort.current=controller;
  const timeout=setTimeout(()=>controller.abort(),22000);
  try{
   if(unlock){await service.unlock(code,controller.signal);setCode('');setNeedsCode(false);setMessage('Acceso habilitado. Pulsa «Explicar con IA» o envía tu pregunta para hacer una consulta.');}
   else{setAdvice(await service.explain(request(),controller.signal));}
  }catch(e){
   if(controller.signal.aborted)setMessage('Consulta cancelada o tiempo de espera agotado. Puedes seguir usando Stockfish.');
   else{if(e instanceof CoachError && e.status===401)setNeedsCode(true);setMessage(e instanceof Error?e.message:'No se pudo consultar la IA.');}
  }finally{clearTimeout(timeout);if(abort.current===controller){setBusy(false);abort.current=null;}}
 }
 return <div className="ai-coach" aria-label="Entrenador con IA">
  <h3>Entrenador con IA</h3><p className="muted">Consulta opcional al servidor. Solo se usa la API al pulsar el botón o enviar una pregunta; Stockfish sigue siendo gratuito.</p>
  <label htmlFor="coach-level">Nivel</label><select id="coach-level" value={level} onChange={e=>{setLevel(e.target.value as CoachLevel);try{localStorage.setItem('chess-coach.coach-level',e.target.value);}catch{/* Optional preference. */}}} disabled={busy}><option value="principiante">Principiante</option><option value="intermedio">Intermedio</option><option value="avanzado">Avanzado</option></select>
  <p className="muted">{selected.move?`${reviewing?'Jugada seleccionada':'Última jugada de blancas'}: ${selected.move.san}. `:'Sin jugada seleccionada. '}Preguntas sobre la posición visible.</p>
  <button disabled={busy||!ready} onClick={()=>void run()}>Explicar con IA</button>
  {!ready && <p className="muted">Esperando el análisis local de las posiciones necesarias…</p>}
  <form onSubmit={e=>{e.preventDefault();if(question.trim())void run();}}><label htmlFor="coach-question">Pregunta sobre esta posición</label><textarea id="coach-question" maxLength={1000} rows={3} value={question} onChange={e=>setQuestion(e.target.value)} disabled={busy}/><button type="submit" disabled={busy||!ready||!question.trim()}>Enviar pregunta</button></form>
  {needsCode && <form onSubmit={e=>{e.preventDefault();void run(true);}}><label htmlFor="coach-code">Código de acceso a la IA</label><input id="coach-code" type="password" autoComplete="off" maxLength={256} value={code} onChange={e=>setCode(e.target.value)} disabled={busy}/><button disabled={busy||!code}>Habilitar acceso</button><p className="muted">Lo proporciona quien administra esta aplicación. No es una clave de OpenAI.</p></form>}
  {busy && <p role="status">Consultando… <button onClick={()=>abort.current?.abort()}>Cancelar consulta</button></p>}
  {message && <p role="status">{message}</p>}
  {advice && <div className="ai-response" data-testid="ai-response"><h3>Datos calculados por Stockfish</h3><ul>{(advice.facts??[]).map((fact,i)=><li key={i}>{fact}</li>)}</ul><h3>Interpretación educativa de la IA</h3><p>{advice.explanation}</p>{advice.mistakes.length>0&&<><h4>Observaciones y amenazas</h4><ul>{advice.mistakes.map((s,i)=><li key={i}>{s}</li>)}</ul></>}{advice.suggestions.length>0&&<><h4>Planes y sugerencias</h4><ul>{advice.suggestions.map((s,i)=><li key={i}>{s}</li>)}</ul></>}<small>Las interpretaciones pueden contener errores. Contrasta las hipótesis con el análisis local.</small></div>}
 </div>;
}
