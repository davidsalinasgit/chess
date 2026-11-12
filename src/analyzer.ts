import { parseInfo, terminal, type Evaluation } from './analysis';
/** One independent, single-thread worker. Sequential searches only. */
export class Analyzer {
 private worker: Worker;
 private ready: Promise<void>;
 private finish?: (result?: Evaluation, error?: Error) => void;
 private disposed = false;
 constructor() {
  this.worker = new Worker(`${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`);
  this.ready = new Promise((resolve, reject) => {
   const timeout = setTimeout(() => { reject(new Error('El analizador no respondió.')); this.dispose(); }, 15000);
   this.finish = (_, error) => { clearTimeout(timeout); reject(error ?? new Error('Análisis cancelado.')); };
   this.worker.onerror = () => { this.finish?.(undefined,new Error('No se pudo cargar el analizador.')); this.dispose(); };
   this.worker.onmessage = ({data}) => {
    if (data === 'uciok') {
     this.worker.postMessage('setoption name Hash value 8');
     this.worker.postMessage('setoption name Threads value 1');
     this.worker.postMessage('isready');
    } else if (data === 'readyok') { clearTimeout(timeout); this.finish = undefined; resolve(); }
   };
   this.worker.postMessage('uci');
  });
  // Cancellation may occur before the caller awaits readiness.
  void this.ready.catch(() => {});
 }
 async evaluate(fen: string): Promise<Evaluation> {
  const end = terminal(fen); if (end) return end;
  await this.ready;
  if (this.disposed) throw new Error('Análisis cancelado.');
  return new Promise((resolve,reject) => {
   let latest: Evaluation | undefined;
   const timer = setTimeout(() => { this.finish?.(undefined,new Error('Tiempo de análisis agotado.')); this.dispose(); },5000);
   this.finish = (result,error) => { clearTimeout(timer); this.finish = undefined; if (result) resolve(result); else reject(error ?? new Error('El motor no entregó una evaluación fiable.')); };
   this.worker.onmessage = ({data}) => {
    if (typeof data !== 'string' || this.disposed) return;
    const info = parseInfo(data,fen); if (info) latest = info;
    if (data.startsWith('bestmove ')) {
     // Do not replace the PV recommendation with a move from a bound-only line.
     this.finish?.(latest);
    }
   };
   this.worker.postMessage(`position fen ${fen}`);
   this.worker.postMessage('go depth 12 nodes 20000 movetime 200');
  });
 }
 dispose() {
  if (this.disposed) return;
  this.disposed = true; this.worker.terminate(); this.finish?.(undefined,new Error('Análisis cancelado.')); this.finish = undefined;
 }
}
