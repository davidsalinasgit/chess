import { Chess } from 'chess.js';
export const OPENING_PGN = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. d4 d6 9. c3 Bg4 10. h3 Bh5 11. Nbd2 Re8';
export const OPENING_FEN = 'r2qr1k1/2p1bppp/p1np1n2/1p2p2b/3PP3/1BP2N1P/PP1N1PP1/R1BQR1K1 w - - 3 12';
export const SAVE_KEY = 'chess-coach.v1';
export function opening() {
 const game = new Chess(); game.loadPgn(OPENING_PGN);
 if (game.fen() !== OPENING_FEN) throw new Error('El historial no coincide con el FEN de la apertura.');
 return game;
}
export function undoTurn(game: Chess) {
 if (!game.history().length) return;
 game.undo();
 if (game.turn() === 'b') game.undo();
}
export function status(game: Chess) {
 if (game.isCheckmate()) return game.turn() === 'w' ? 'Jaque mate. Ganan las negras.' : '¡Jaque mate! Ganan las blancas.';
 if (game.isStalemate()) return 'Tablas por ahogado.';
 if (game.isThreefoldRepetition()) return 'Tablas por triple repetición.';
 if (game.isInsufficientMaterial()) return 'Tablas por material insuficiente.';
 if (game.isDraw()) return 'Tablas por la regla de los 50 movimientos.';
 return (game.turn() === 'w' ? 'Tu turno · Blancas' : 'Stockfish está pensando…') + (game.isCheck() ? ' · Jaque' : '');
}
export function restore(storage: Pick<Storage, 'getItem'>): { game: Chess; difficulty: number; warning?: string } {
 try {
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) return { game: new Chess(), difficulty: 5 };
  const saved = JSON.parse(raw);
  if (saved.version !== 1 || typeof saved.pgn !== 'string' || typeof saved.fen !== 'string') throw Error();
  const game = new Chess(); game.loadPgn(saved.pgn);
  if (game.fen() !== saved.fen) throw Error();
  return { game, difficulty: Number.isInteger(saved.difficulty) && saved.difficulty >= 0 && saved.difficulty <= 20 ? saved.difficulty : 5 };
 } catch { return { game: new Chess(), difficulty: 5, warning: 'No se pudo recuperar la partida guardada. Se inició una partida nueva.' }; }
}
export function save(storage: Pick<Storage, 'setItem'>, game: Chess, difficulty: number) {
 storage.setItem(SAVE_KEY, JSON.stringify({ version: 1, pgn: game.pgn(), fen: game.fen(), difficulty }));
}
