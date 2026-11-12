import { useEffect, useRef, useState } from 'react';
import { Analyzer } from './analyzer';
import type { Evaluation, Position } from './analysis';
/** Cache is bounded and session-local. Visible position always has priority. */
export function useAnalysis(timeline: Position[], index: number, review: boolean, epoch: number) {
 const cache = useRef(new Map<string, Evaluation>());
 const [results,setResults] = useState(new Map<string,Evaluation>());
 const [error,setError] = useState('');
 const [retry,setRetry] = useState(0);
 const key = timeline.map(p => p.fen).join('|');
 useEffect(() => { cache.current.clear(); setResults(new Map()); },[epoch]);
 useEffect(() => {
  let active = true; let analyzer: Analyzer | undefined;
  let delay: ReturnType<typeof setTimeout> | undefined;
  let wake: (() => void) | undefined;
  setError('');
  const order = [...new Set([index, index-1, timeline.length-1, timeline.length-2, ...timeline.map((_,i)=>i).reverse()])].filter(i=>i>=0).slice(0,256);
  async function run() {
   try {
    for (const i of order) {
     const fen = timeline[i].fen;
     if (!active) return;
     const cached = cache.current.get(fen);
     if (cached && !timeline[i].terminal) { cache.current.delete(fen); cache.current.set(fen,cached); continue; }
     if (timeline[i].terminal) {
      cache.current.delete(fen); cache.current.set(fen,timeline[i].terminal!);
      while (cache.current.size > 256) cache.current.delete(cache.current.keys().next().value!);
      setResults(new Map(cache.current)); continue;
     }
     analyzer ??= new Analyzer();
     const result = await analyzer.evaluate(fen);
     if (!active) return;
     cache.current.set(fen,result);
     while (cache.current.size > 256) cache.current.delete(cache.current.keys().next().value!);
     setResults(new Map(cache.current));
     await new Promise<void>(resolve => { wake = resolve; delay = setTimeout(resolve,120); });
    }
   } catch (e) { if (active) setError(e instanceof Error ? e.message : 'No se pudo analizar.'); }
   finally { analyzer?.dispose(); }
  }
  // Debounce touch navigation; at most one coach Worker alongside the rival.
  const start = setTimeout(() => { void run(); },150);
  return () => { active=false; clearTimeout(start); clearTimeout(delay); wake?.(); analyzer?.dispose(); };
 },[key,index,review,epoch,retry]);
 return { results,error,retry:()=>setRetry(n=>n+1) };
}
