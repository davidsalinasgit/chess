/** Stage 2: implement /api/coach on a server; OPENAI_API_KEY belongs only there. */
export interface CoachRequest { pgn: string; fen: string; lastMove: string; language: 'es' }
export interface CoachAdvice { explanation: string; mistakes: string[]; suggestions: string[] }
export interface CoachService { explain(request: CoachRequest, signal?: AbortSignal): Promise<CoachAdvice> }
export class ServerCoach implements CoachService {
 async explain(request: CoachRequest, signal?: AbortSignal): Promise<CoachAdvice> {
  const response = await fetch('/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal });
  if (!response.ok) throw new Error('No se pudo consultar al entrenador.');
  return response.json();
 }
}
