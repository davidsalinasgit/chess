import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Chess, type Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { opening, restore, save, status, undoTurn } from './game';
import { search } from './engine';
import './style.css';
import { positions } from './analysis';
import { useAnalysis } from './useAnalysis';
import { EvalBar, Trainer } from './Trainer';
import { downloadPgn, importPgn, IMPORT_KEY, MAX_PGN_BYTES, stampGame } from './pgn';

function App() {
 const [initial] = useState(() => { try { return restore(localStorage); } catch { return { game: new Chess(), difficulty: 5, warning: 'El almacenamiento local no está disponible.' }; } });
 const game = useRef(initial.game);
 const [initialImport] = useState(()=>{try{const raw=localStorage.getItem(IMPORT_KEY);return {game:raw?importPgn(raw):null,warning:''};}catch{return {game:null,warning:'No se pudo recuperar la revisión importada. Tu partida de juego se conserva; vuelve a importar el archivo original.'};}});
 const [imported,setImported] = useState<Chess|null>(initialImport.game);
 const [importActive,setImportActive] = useState(()=>{try{return !!imported && localStorage.getItem('chess-coach.review-source')==='imported';}catch{return false;}});
 const [pendingImport,setPendingImport] = useState<Chess|null>(null);
 const [importError,setImportError] = useState('');
 const inputFile = useRef<HTMLInputElement>(null);
 const fileGeneration=useRef(0);
 const [fen, setFen] = useState(game.current.fen());
 const [reviewIndex,setReviewIndex] = useState<number|null>(()=>{try{return importActive?imported!.history().length:localStorage.getItem('chess-coach.mode')==='review'?game.current.history().length:null;}catch{return null;}});
 const [epoch,setEpoch] = useState(0);
 const [hideEvaluation,setHideEvaluation] = useState(() => { try { return localStorage.getItem('chess-coach.hide-evaluation') === 'true'; } catch { return false; } });
 const viewingGame = importActive && imported ? imported : game.current;
 const timeline = useMemo(() => positions(viewingGame),[fen,epoch,imported,importActive]);
 const viewingIndex = reviewIndex === null ? timeline.length-1 : Math.min(reviewIndex,timeline.length-1);
 const displayFen = timeline[viewingIndex].fen;
 const analysis = useAnalysis(timeline,viewingIndex,reviewIndex !== null,epoch);
 function navigate(index:number|null) { if(index!==null)cancel.current();if(index===null){if(importActive)setEpoch(n=>n+1);setImportActive(false);} setReviewIndex(index); setSelected(null); setPromotion(null); }
 const [difficulty, setDifficulty] = useState(initial.difficulty);
 const [notice, setNotice] = useState(initial.warning ?? initialImport.warning);
 const [engineError, setEngineError] = useState(false);
 const [retry, setRetry] = useState(0);
 const [selected, setSelected] = useState<Square | null>(null);
 const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
 const [confirm, setConfirm] = useState<'new' | 'opening' | null>(null);
 const cancel = useRef<() => void>(() => {});
 const update = () => { setFen(game.current.fen()); setSelected(null); setPromotion(null); setEngineError(false); };
 useEffect(() => {
  try { stampGame(game.current); save(localStorage, game.current, difficulty); }
  catch { setNotice('No se pudo guardar la partida. Exporta el PGN para conservarla.'); }
 }, [fen, difficulty, epoch]);
 useEffect(() => {
  if (reviewIndex !== null || game.current.turn() !== 'b' || game.current.isGameOver()) return;
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
 }, [fen, difficulty, retry, reviewIndex, importActive]);
 function move(from: string, to: string, promote?: string) {
  if (reviewIndex !== null || game.current.turn() !== 'w' || game.current.isGameOver() || promotion && !promote) return false;
  const legal = game.current.moves({ verbose: true }).filter(m => m.from === from && m.to === to);
  if (!legal.length) return false;
  if (legal[0].isPromotion() && !promote) { setPromotion({ from, to }); return false; }
  try { game.current.move({ from, to, promotion: promote }); update(); return true; } catch { return false; }
 }
 function reset(kind: 'new' | 'opening') {
  cancel.current(); setImportActive(false); setReviewIndex(null); setEpoch(n=>n+1); game.current = kind === 'opening' ? opening() : new Chess();
  update(); setConfirm(null); setNotice(kind === 'opening' ? 'Apertura Española recuperada. Historial y FEN verificados: juegan blancas, movimiento 12.' : 'Partida nueva. Juegas con blancas.');
 }
 useEffect(()=>{try{localStorage.setItem('chess-coach.review-source',importActive?'imported':'current');localStorage.setItem('chess-coach.mode',reviewIndex===null?'play':'review');}catch{/* Optional preference. */}},[importActive,reviewIndex]);
 async function readImport(file:File|undefined) {
  const generation=++fileGeneration.current;setImportError('');if(!file)return;
  if(file.size>MAX_PGN_BYTES){setImportError('El PGN supera el límite de 256 KB.');return;}
  try{const candidate=importPgn(await file.text());if(generation===fileGeneration.current)setPendingImport(candidate);}catch(e){if(generation===fileGeneration.current)setImportError(e instanceof Error?e.message:'No se pudo leer el archivo.');}
 }
 function acceptImport() {
  if(!pendingImport)return;
  cancel.current();setImported(pendingImport);setImportActive(true);setReviewIndex(pendingImport.history().length);setEpoch(n=>n+1);
  try{localStorage.setItem(IMPORT_KEY,pendingImport.pgn());}catch{setNotice('El PGN se abrió, pero no pudo guardarse en este navegador. Conserva su archivo original.');}
  setPendingImport(null);setSelected(null);setPromotion(null);
 }
 function openImported() {if(imported){cancel.current();setEpoch(n=>n+1);setImportActive(true);setReviewIndex(imported.history().length);setSelected(null);setPromotion(null);}}
 const exportCurrent = () => downloadPgn(viewingGame,importActive);
 const history = viewingGame.history();
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
   <div className="board-with-eval"><EvalBar hidden={hideEvaluation} evaluation={analysis.results.get(displayFen)}/><div className="board"><Chessboard options={{ id: 'coach-board', position: displayFen, boardOrientation: 'white', darkSquareStyle: { backgroundColor: '#668b78' }, lightSquareStyle: { backgroundColor: '#eee9d9' }, squareStyles: highlights, allowDragging: reviewIndex === null && game.current.turn() === 'w' && !game.current.isGameOver() && !promotion, canDragPiece: ({ piece }) => piece.pieceType.startsWith('w'), allowDrawingArrows: false, onPieceDrop: ({ sourceSquare, targetSquare }) => targetSquare ? move(sourceSquare, targetSquare) : false, onSquareClick: ({ square }) => {
    if (reviewIndex !== null || promotion || game.current.turn() !== 'w' || game.current.isGameOver()) return;
    if (selected && move(selected, square)) return;
    if (game.current.get(square as Square)?.color === 'w') setSelected(square as Square); else setSelected(null);
   } }}/></div></div>
   <div className="player"><span>♙ Tú <small>Blancas</small></span><span>{reviewIndex !== null ? 'Revisión · solo lectura' : 'Arrastra o toca para mover'}</span></div>
  </section>
  <aside><section className="panel"><p className="eyebrow">LA PARTIDA</p><div className="mode-switch" aria-label="Modo de la aplicación"><button aria-pressed={reviewIndex===null} onClick={()=>navigate(null)}>Jugar</button><button aria-pressed={reviewIndex!==null} onClick={()=>{cancel.current();navigate(timeline.length-1);}}>Revisión</button></div><h2 role="status" aria-live="polite">{reviewIndex !== null ? `Modo Revisión${importActive ? ' · PGN importado' : ''}` : engineError ? 'El motor no pudo responder.' : status(game.current)}</h2>
   {engineError && reviewIndex===null && <button onClick={() => { setEngineError(false); setRetry(r => r + 1); }}>Reintentar motor</button>}
   <label htmlFor="difficulty">Dificultad del rival <strong>{difficulty} / 20</strong></label>
   <input id="difficulty" type="range" min="0" max="20" value={difficulty} onChange={e => setDifficulty(Number(e.target.value))}/><div className="range-labels"><span>Principiante</span><span>Experto</span></div>
   <div className="actions"><button className="primary" onClick={() => setConfirm('new')}>Nueva partida</button><button disabled={!game.current.history().length || reviewIndex!==null} onClick={() => { cancel.current(); setReviewIndex(null); undoTurn(game.current); setEpoch(n=>n+1); update(); }}>Deshacer turno</button><button onClick={exportCurrent}>Exportar PGN</button><button onClick={()=>inputFile.current?.click()}>Importar PGN</button><button onClick={exportCurrent}>Preparar partida para análisis</button>{imported && !importActive && <button onClick={openImported}>Revisar PGN importado</button>}</div>
   <input className="file-input" ref={inputFile} type="file" accept=".pgn,application/x-chess-pgn,text/plain" aria-label="Archivo PGN" onChange={e=>{void readImport(e.target.files?.[0]);e.target.value='';}}/>
   {importError && <p role="alert">{importError}</p>}
   <p className="muted">{importActive?'PGN importado en revisión. Tu partida de juego se conserva.':'Exporta la partida completa para conservarla o adjuntarla en ChatGPT.'}</p>
  </section>
  <Trainer pgn={viewingGame.pgn()} key={`${epoch}:${displayFen}:${reviewIndex === null ? 'live' : 'review'}`} timeline={timeline} index={viewingIndex} reviewing={reviewIndex !== null} results={analysis.results} error={analysis.error} retry={analysis.retry} navigate={navigate} hidden={hideEvaluation} setHidden={hidden=>{ setHideEvaluation(hidden); try { localStorage.setItem('chess-coach.hide-evaluation',String(hidden)); } catch { /* Session preference remains usable. */ } }}/>
  <section className="panel history"><div className="panel-title"><h2>Jugadas</h2><span>{history.length} medias jugadas</span></div><div className="moves" aria-label="Historial de jugadas">{!history.length ? <p>Tu primera jugada abre el camino.</p> : Array.from({ length: Math.ceil(history.length / 2) }, (_, i) => <div className="move" key={i}><span>{i + 1}.</span><button aria-label={`Revisar jugada ${i*2+1}: ${history[i*2]}`} onClick={()=>navigate(i*2+1)}>{history[i*2]}</button>{history[i*2+1] ? <button aria-label={`Revisar jugada ${i*2+2}: ${history[i*2+1]}`} onClick={()=>navigate(i*2+2)}>{history[i*2+1]}</button> : <span>—</span>}</div>)}</div><small>Notación algebraica estándar (SAN): K rey, Q dama, R torre, B alfil, N caballo.</small></section>
  <section className="panel opening"><p className="eyebrow">RETOMA TU ESTUDIO</p><h2>Apertura Española</h2><p>Recupera nuestra posición tras 11…Re8, con todo el historial.</p><button onClick={() => setConfirm('opening')}>Recuperar la apertura</button></section>
  </aside></div>
  {notice && <p role="status" className="notice">{notice}<button aria-label="Cerrar aviso" onClick={() => setNotice('')}>×</button></p>}
  <footer>Partida guardada automáticamente en este navegador. <span>Entrenador con Stockfish · Análisis orientativo</span></footer>
  {pendingImport && <div className="overlay"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="import-title"><h2 id="import-title">¿Abrir PGN en revisión?</h2><p>{pendingImport.history().length} medias jugadas válidas. Tu partida de juego se conserva. Se reemplazará la revisión importada anterior.</p><div className="actions"><button autoFocus onClick={()=>setPendingImport(null)}>Cancelar</button><button className="primary" onClick={acceptImport}>Abrir en revisión</button></div></section></div>}
  {promotion && <div className="overlay"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="promotion-title"><h2 id="promotion-title">Elige la promoción</h2><div className="actions">{[['q', 'Dama'], ['r', 'Torre'], ['b', 'Alfil'], ['n', 'Caballo']].map(([piece, name]) => <button autoFocus={piece === 'q'} key={piece} onClick={() => move(promotion.from, promotion.to, piece)}>{name}</button>)}</div><button onClick={() => setPromotion(null)}>Cancelar</button></section></div>}
  {confirm && <div className="overlay"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><h2 id="confirm-title">{confirm === 'new' ? '¿Comenzar una nueva partida?' : '¿Recuperar la Apertura Española?'}</h2><p>Tu partida de juego será reemplazada. Puedes cancelar y exportarla desde Jugar antes de continuar. La revisión importada se conserva.</p><div className="actions"><button autoFocus onClick={() => setConfirm(null)}>Cancelar</button><button className="primary" onClick={() => reset(confirm)}>Continuar</button></div></section></div>}
 </main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
