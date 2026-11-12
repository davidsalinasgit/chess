import type { Evaluation } from './analysis';
export type CoachLevel = 'principiante' | 'intermedio' | 'avanzado';
export interface CoachEvidence { current:Evaluation; before?:Evaluation; after?:Evaluation }
/** Optional fields extend the existing contract; the 2B backend requires position context. */
export interface CoachRequest {
 pgn:string; fen:string; lastMove:string; language:'es';
 selectedPly?:number; positionPly?:number; level?:CoachLevel; question?:string;
 evidence?:CoachEvidence;
}
export interface CoachAdvice { explanation:string; mistakes:string[]; suggestions:string[]; facts?:string[] }
export interface CoachService { explain(request:CoachRequest,signal?:AbortSignal):Promise<CoachAdvice> }
export class CoachError extends Error { constructor(message:string,public status:number){super(message);} }
async function decode(response:Response) {
 const data = await response.json().catch(()=>({}));
 if (!response.ok) throw new CoachError(typeof data.error==='string' ? data.error : 'No se pudo consultar al entrenador. Inténtalo más tarde.',response.status);
 return data;
}
async function post(body:unknown,signal?:AbortSignal) {
 try{return await fetch('/api/coach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});}
 catch(error){if(signal?.aborted)throw error;throw new CoachError('No se pudo conectar con el entrenador. Puedes seguir usando Stockfish.',0);}
}
export class ServerCoach implements CoachService {
 async explain(request:CoachRequest,signal?:AbortSignal):Promise<CoachAdvice> {
  const response=await post(request,signal);
  const data=await decode(response);
  if(typeof data.explanation!=='string' || !Array.isArray(data.mistakes) || !Array.isArray(data.suggestions)) throw new Error('El entrenador devolvió una respuesta inválida.');
  return data;
 }
 async unlock(code:string,signal?:AbortSignal):Promise<void> {
  await decode(await post({action:'unlock',code},signal));
 }
}
