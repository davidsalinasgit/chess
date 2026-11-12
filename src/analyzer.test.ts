import { afterEach,describe,it,expect,vi } from 'vitest';
import { Analyzer } from './analyzer';
import { Chess } from 'chess.js';
class FakeWorker {
 static instances:FakeWorker[]=[];
 onmessage:((event:{data:string})=>void)|null=null;
 onerror:(()=>void)|null=null;
 messages:string[]=[]; terminated=false;
 constructor(){FakeWorker.instances.push(this);}
 postMessage(message:string){this.messages.push(message);queueMicrotask(()=>{
  if(message==='uci')this.onmessage?.({data:'uciok'});
  if(message==='isready')this.onmessage?.({data:'readyok'});
 });}
 terminate(){this.terminated=true;}
 emit(data:string){this.onmessage?.({data});}
}
afterEach(()=>{vi.unstubAllGlobals();FakeWorker.instances=[];});
describe('Worker de análisis independiente',()=>{
 it('limita recursos, reutiliza una instancia y convierte el score',async()=>{
  vi.stubGlobal('Worker',FakeWorker);const a=new Analyzer();const g=new Chess();g.move('e4');const pending=a.evaluate(g.fen());
  await vi.waitFor(()=>expect(FakeWorker.instances[0].messages.some(m=>m.startsWith('go '))).toBe(true));
  const w=FakeWorker.instances[0];w.emit('info depth 10 score cp 30 pv e7e5');w.emit('bestmove e7e5');
  expect((await pending).score.value).toBe(-30);expect(w.messages).toContain('setoption name Hash value 8');expect(w.messages).toContain('go depth 12 nodes 20000 movetime 200');
  const next=a.evaluate(new Chess().fen());await Promise.resolve();w.emit('info depth 9 score cp 20 pv d2d4');w.emit('bestmove d2d4');expect((await next).bestMove).toBe('d2d4');expect(FakeWorker.instances).toHaveLength(1);a.dispose();expect(w.terminated).toBe(true);
 });
 it('cancela búsquedas y no publica mensajes tardíos',async()=>{
  vi.stubGlobal('Worker',FakeWorker);const a=new Analyzer();const p=a.evaluate(new Chess().fen());const rejection=expect(p).rejects.toThrow('cancelado');
  await Promise.resolve();a.dispose();FakeWorker.instances[0].emit('bestmove e2e4');await rejection;expect(FakeWorker.instances[0].terminated).toBe(true);
 });
 it('rechaza resultados sin score válido',async()=>{
  vi.stubGlobal('Worker',FakeWorker);const a=new Analyzer();const p=a.evaluate(new Chess().fen());const rejection=expect(p).rejects.toThrow('fiable');
  await vi.waitFor(()=>expect(FakeWorker.instances[0].messages.some(m=>m.startsWith('go '))).toBe(true));FakeWorker.instances[0].emit('bestmove e2e4');await rejection;a.dispose();
 });
});
