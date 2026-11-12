/** A fresh worker per search prevents stale bestmove messages after undo/reset. */
export function search(fen: string, skill: number, onMove: (uci: string) => void, onError: () => void) {
 const worker = new Worker(`${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`);
 let stopped = false;
 const timer = window.setTimeout(fail, 30000);
 function stop() { stopped = true; clearTimeout(timer); worker.terminate(); }
 function fail() { if (!stopped) { stop(); onError(); } }
 worker.onerror = fail;
 worker.onmessage = ({ data }) => {
  if (stopped || typeof data !== 'string') return;
  if (data === 'uciok') {
   worker.postMessage(`setoption name Skill Level value ${skill}`);
   worker.postMessage('setoption name Hash value 16');
   worker.postMessage('isready');
  } else if (data === 'readyok') {
   worker.postMessage(`position fen ${fen}`);
   worker.postMessage(`go movetime ${300 + skill * 60}`);
  } else if (data.startsWith('bestmove ')) {
   const move = data.split(' ')[1]; stop(); onMove(move);
  }
 };
 worker.postMessage('uci');
 return stop;
}
