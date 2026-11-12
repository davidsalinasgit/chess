import { Chess } from 'chess.js';
export const MAX_PGN_BYTES = 256 * 1024;
export const IMPORT_KEY = 'chess-coach.import.v1';
export function localDate(date = new Date()) {
 const pad = (n:number) => String(n).padStart(2,'0');
 return { day:`${date.getFullYear()}.${pad(date.getMonth()+1)}.${pad(date.getDate())}`, stamp:`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}` };
}
const known=(value:string|undefined)=>value && value!=='?' && value!=='????.??.??' ? value : undefined;
export function stampGame(game:Chess,date=new Date()) {
 if (!known(game.getHeaders().Date)) game.setHeader('Date',localDate(date).day);
}
export function importPgn(text:string):Chess {
 if (!text.trim()) throw new Error('El archivo PGN está vacío.');
 if (new TextEncoder().encode(text).length > MAX_PGN_BYTES) throw new Error('El PGN supera el límite de 256 KB.');
 // chess.js imports one main line. Reject side variations/multiple games rather than silently losing them.
 const main = text.replace(/\{[^}]*\}/gs,' ').replace(/;[^\r\n]*/g,' ');
 const movetext=main.replace(/\[[^\]]*\]/gs,' ');
 if(movetext.trim().split(/\s+/).length>5000)throw new Error('El PGN supera el límite de 2000 medias jugadas.');
 if (/[()]/.test(movetext)) throw new Error('Este PGN incluye variantes. Exporta una sola línea principal para conservar todas sus jugadas.');
 if ((main.match(/\[Event\s/g)??[]).length > 1 || (movetext.match(/(?:^|\s)(?:1-0|0-1|1\/2-1\/2|\*)(?=\s|$)/g)??[]).length > 1) throw new Error('Selecciona un archivo con una sola partida.');
 try {
  const game = new Chess(); game.loadPgn(text.replace(/^\uFEFF/,''),{strict:true});
  if (!game.history().length && !/\[(?:Event|FEN)\s|(?:^|\s)(?:1-0|0-1|1\/2-1\/2|\*)(?:\s|$)/.test(main)) throw Error();
  if(game.history().length>2000)throw new Error('Partida demasiado larga.');
  const declared = game.getHeaders().Result;
  if (declared && !['*','1-0','0-1','1/2-1/2'].includes(declared)) throw Error();
  if (game.isCheckmate() && declared && declared !== '*' && declared !== (game.turn()==='w'?'0-1':'1-0')) throw Error();
  return game;
 } catch { throw new Error('PGN inválido: revisa la notación, las jugadas legales y el resultado de la partida.'); }
}
export function exportPgn(game:Chess,date=new Date(),imported=false) {
 const copy = new Chess(); copy.loadPgn(game.pgn());
 const headers=copy.getHeaders();
 copy.setHeader('Event',known(headers.Event) || 'Chess Coach - Entrenamiento');
 copy.setHeader('Site',headers.Site || '?');
 copy.setHeader('Date',known(headers.Date) || localDate(date).day);
 copy.setHeader('Round',headers.Round || '?');
 copy.setHeader('White',known(headers.White) || (imported ? '?' : 'Usuario'));
 copy.setHeader('Black',known(headers.Black) || (imported ? '?' : 'Stockfish'));
 const result = copy.isCheckmate() ? (copy.turn()==='w' ? '0-1' : '1-0') : copy.isDraw() ? '1/2-1/2' : ['1-0','0-1','1/2-1/2'].includes(headers.Result) ? headers.Result : '*';
 copy.setHeader('Result',result);
 return { text:copy.pgn({maxWidth:80})+'\n',filename:`chess-coach-${localDate(date).stamp}.pgn` };
}
export function downloadPgn(game:Chess,imported=false) {
 const file=exportPgn(game,new Date(),imported);
 const url=URL.createObjectURL(new Blob([file.text],{type:'application/x-chess-pgn;charset=utf-8'}));
 const anchor=document.createElement('a'); anchor.href=url;anchor.download=file.filename;anchor.hidden=true;
 document.body.append(anchor);anchor.click();anchor.remove();
 // Safari may consume the Blob after the click handler returns.
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
