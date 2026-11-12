import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Chess, type Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { opening, restore, save, status, undoTurn } from './game';
import { search } from './engine';
import './style.css';

function App() {
 const [initial] = useState(() => { try { return restore(localStorage); } catch { return { game: new Chess(), difficulty: 5, warning: 'El almacenamiento local no está disponible.' }; } });
 const game = useRef(initial.game);
 const [fen, setFen] = useState(game.current.fen());
 const [difficulty, setDifficulty] = useState(initial.difficulty);
 const [notice, setNotice] = useState(initial.warning ?? '');
 const [engineError, setEngineError] = useState(false);
 const [retry, setRetry] = useState(0);
 const [selected, setSelected] = useState<Square | null>(null);
 const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
 const [confirm, setConfirm] = useState<'new' | 'opening' | null>(null);
 const cancel = useRef<() => void>(() => {});
 const update = () => { setFen(game.current.fen()); setSelected(null); setPromotion(null); setEngineError(false); };
 useEffect(() => {
  try { save(localStorage, game.current, difficulty); }
  catch { setNotice('No se pudo guardar la partida. Exporta el PGN para conservarla.'); }
 }, [fen, difficulty]);
 useEffect(() => {
  if (game.current.turn() !== 'b' || game.current.isGameOver()) return;
  const expected = fen;
  try {
   cancel.current = search(fen, difficulty, uci => {
    if (game.current.fen() !== expected) return;
    try {
     game.current.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }); update();
    } catch { setEngineError(true); }
   }, () => setEngineError(true));
  } catch { setEngineError(true); }
  return () => cancel.current();
 }, [fen, difficulty, retry]);
 function move(from: string, to: string, promote?: string) {
  if (game.current.turn() !== 'w' || game.current.isGameOver() || promotion && !promote) return false;
  const legal = game.current.moves({ verbose: true }).filter(m => m.from === from && m.to === to);
  if (!legal.length) return false;
  if (legal[0].isPromotion() && !promote) { setPromotion({ from, to }); return false; }
  try { game.current.move({ from, to, promotion: promote }); update(); return true; } catch { return false; }
 }
 function reset(kind: 'new' | 'opening') {
  cancel.current(); game.current = kind === 'opening' ? opening() : new Chess();
  update(); setConfirm(null); setNotice(kind === 'opening' ? 'Apertura Española recuperada. Historial y FEN verificados: juegan blancas, movimiento 12.' : 'Partida nueva. Juegas con blancas.');
 }
 function exportPgn() {
  const url = URL.createObjectURL(new Blob([game.current.pgn()], { type: 'application/x-chess-pgn' }));
  const a = document.createElement('a'); a.href = url; a.download = 'chess-coach.pgn'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
 }
 const history = game.current.history();
 const highlights: Record<string, React.CSSProperties> = {};
 if (selected) {
  highlights[selected] = { backgroundColor: '#eac35c' };
  for (const m of game.current.moves({ square: selected, verbose: true })) highlights[m.to] = { backgroundImage: 'radial-gradient(circle, #153d3570 22%, transparent 25%)' };
 }
 return <main>
  <header><span className="brand">♞ Chess Coach</span><span className="tag">TU ESPACIO DE ENTRENAMIENTO</span></header>
  <section className="intro"><p className="eyebrow">APRENDE JUGANDO</p><h1>Cada jugada cuenta.</h1><p>Juega con blancas, encuentra tu ritmo y entrena contra Stockfish.</p></section>
  <div className="layout"><section className="board-section" aria-label="Partida de ajedrez">
   <div className="player"><span>♟ Stockfish <small>Negras · Nivel {difficulty}</small></span><span className="dot"/> </div>
   <div className="board"><Chessboard options={{ id: 'coach-board', position: fen, boardOrientation: 'white', darkSquareStyle: { backgroundColor: '#668b78' }, lightSquareStyle: { backgroundColor: '#eee9d9' }, squareStyles: highlights, allowDragging: game.current.turn() === 'w' && !game.current.isGameOver() && !promotion, canDragPiece: ({ piece }) => piece.pieceType.startsWith('w'), allowDrawingArrows: false, onPieceDrop: ({ sourceSquare, targetSquare }) => targetSquare ? move(sourceSquare, targetSquare) : false, onSquareClick: ({ square }) => {
    if (promotion || game.current.turn() !== 'w' || game.current.isGameOver()) return;
    if (selected && move(selected, square)) return;
    if (game.current.get(square as Square)?.color === 'w') setSelected(square as Square); else setSelected(null);
   } }}/></div>
   <div className="player"><span>♙ Tú <small>Blancas</small></span><span>Arrastra o toca para mover</span></div>
  </section>
  <aside><section className="panel"><p className="eyebrow">LA PARTIDA</p><h2 role="status" aria-live="polite">{engineError ? 'El motor no pudo responder.' : status(game.current)}</h2>
   {engineError && <button onClick={() => { setEngineError(false); setRetry(r => r + 1); }}>Reintentar motor</button>}
   <label htmlFor="difficulty">Dificultad del rival <strong>{difficulty} / 20</strong></label>
   <input id="difficulty" type="range" min="0" max="20" value={difficulty} onChange={e => setDifficulty(Number(e.target.value))}/><div className="range-labels"><span>Principiante</span><span>Experto</span></div>
   <div className="actions"><button className="primary" onClick={() => setConfirm('new')}>Nueva partida</button><button disabled={!history.length} onClick={() => { cancel.current(); undoTurn(game.current); update(); }}>Deshacer turno</button><button onClick={exportPgn}>Exportar PGN</button></div>
  </section>
  <section className="panel history"><div className="panel-title"><h2>Jugadas</h2><span>{history.length} medias jugadas</span></div><div className="moves" aria-label="Historial de jugadas">{!history.length ? <p>Tu primera jugada abre el camino.</p> : Array.from({ length: Math.ceil(history.length / 2) }, (_, i) => <div className="move" key={i}><span>{i + 1}.</span><span>{history[i * 2]}</span><span>{history[i * 2 + 1] ?? '—'}</span></div>)}</div><small>Notación algebraica estándar (SAN): K rey, Q dama, R torre, B alfil, N caballo.</small></section>
  <section className="panel opening"><p className="eyebrow">RETOMA TU ESTUDIO</p><h2>Apertura Española</h2><p>Recupera nuestra posición tras 11…Re8, con todo el historial.</p><button onClick={() => setConfirm('opening')}>Recuperar la apertura</button></section>
  </aside></div>
  {notice && <p role="status" className="notice">{notice}<button aria-label="Cerrar aviso" onClick={() => setNotice('')}>×</button></p>}
  <footer>Partida guardada automáticamente en este navegador. <span>Entrenador en español con IA · Próxima etapa</span></footer>
  {promotion && <div className="overlay"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="promotion-title"><h2 id="promotion-title">Elige la promoción</h2><div className="actions">{[['q', 'Dama'], ['r', 'Torre'], ['b', 'Alfil'], ['n', 'Caballo']].map(([piece, name]) => <button autoFocus={piece === 'q'} key={piece} onClick={() => move(promotion.from, promotion.to, piece)}>{name}</button>)}</div><button onClick={() => setPromotion(null)}>Cancelar</button></section></div>}
  {confirm && <div className="overlay"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><h2 id="confirm-title">{confirm === 'new' ? '¿Comenzar una nueva partida?' : '¿Recuperar la Apertura Española?'}</h2><p>La partida actual será reemplazada. Puedes cancelar y exportar su PGN para conservarla.</p><div className="actions"><button autoFocus onClick={() => setConfirm(null)}>Cancelar</button><button className="primary" onClick={() => reset(confirm)}>Continuar</button></div></section></div>}
 </main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
