import { mkdir, copyFile, writeFile } from 'node:fs/promises';
const target = new URL('../public/stockfish/', import.meta.url);
await mkdir(target, { recursive: true });
for (const name of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) {
 await copyFile(new URL('../node_modules/stockfish/bin/' + name, import.meta.url), new URL(name, target));
}

await copyFile(new URL('../node_modules/stockfish/Copying.txt', import.meta.url), new URL('COPYING.txt', target));
await writeFile(new URL('SOURCE.txt', target), 'Stockfish.js 19.0.1, unmodified npm package. GPL-3.0. Source and build scripts: https://github.com/nmrugg/stockfish.js/tree/v19.0.1\n');
