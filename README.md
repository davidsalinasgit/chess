# Chess Coach

Primera versión funcional en español: React + TypeScript + Vite, react-chessboard, chess.js y Stockfish 19 lite en un Web Worker local de un solo hilo. Se puede jugar arrastrando piezas o tocando origen y destino. Las blancas son del usuario; las negras responden automáticamente. La promoción permite elegir dama, torre, alfil o caballo.

## Ejecutar

Requiere Node.js 22.12+ (recomendado 24) y npm.

```sh
npm ci
npm run dev
```

Abrir la URL que muestra Vite. Para probar desde un iPhone o iPad en la misma red, usar la IP del equipo y el puerto 5173. No se necesita clave ni conexión a un servicio para jugar. `postinstall` copia el motor y WASM desde el paquete fijado en el lockfile a `public/stockfish`; no omitir los scripts de instalación.

## Comprobar

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Las pruebas de navegador ejecutan la compilación de producción con perfiles de escritorio, iPhone e iPad (Chromium emulado). Comprueban una respuesta real del motor, movimiento ilegal, cancelación al deshacer, recuperación, exportación y anchura móvil. La emulación no sustituye una prueba en Safari físico.

## Desplegar

```sh
npm ci
npm run build
npm run preview
```

Publicar **todo `dist/`** en un alojamiento estático (Netlify, Vercel, Cloudflare Pages o un servidor HTTP). Comando de build: `npm run build`; directorio de salida: `dist`. Vite usa rutas relativas para permitir subdirectorios. Servir `.wasm` con `Content-Type: application/wasm` y `.js` como JavaScript; no convertir peticiones de `/stockfish/*` en el HTML principal. El motor de un hilo no requiere encabezados COOP/COEP. Para una CSP propia permitir `worker-src 'self'`, `script-src 'self' 'wasm-unsafe-eval'` y los estilos inline usados por el tablero.

La partida se guarda en `localStorage` del navegador y origen actuales. Se conserva PGN, FEN y dificultad; se reconstruye el historial para mantener reglas como la repetición. Si el almacenamiento falla aparece un aviso; exportar PGN permite conservar la partida fuera del navegador. El modo privado o borrar los datos puede eliminarla. Deshacer elimina la última jugada blanca y la respuesta negra, o solo la blanca si el motor aún calcula. Cambiar de dificultad cancela la búsqueda y la reinicia al nivel elegido (0–20, sin equivalencia garantizada a Elo). El fallo del motor ofrece reintento y nunca inventa una respuesta.

## Apertura Española

El botón de recuperación carga las 22 medias jugadas proporcionadas y compara el FEN resultante **exactamente**, incluidos los contadores, con:

```
r2qr1k1/2p1bppp/p1np1n2/1p2p2b/3PP3/1BP2N1P/PP1N1PP1/R1BQR1K1 w - - 3 12
```

La prueba automatizada confirma la coincidencia; juegan blancas en el movimiento 12. Nueva partida y recuperación piden confirmación antes de reemplazar la partida guardada. El historial usa SAN internacional para mantener compatibilidad PGN; la interfaz explica las letras de piezas en español.

## Arquitectura y siguiente etapa

- `src/game.ts`: reglas, apertura, persistencia y estados de partida.
- `src/engine.ts`: protocolo UCI y ciclo de vida del Worker. Cada búsqueda tiene su propio Worker y límite de 30 segundos; se termina al deshacer, cambiar partida o dificultad para descartar respuestas antiguas.
- `src/main.tsx`: interacción, promoción, historial y controles.
- `src/coach.ts`: contrato `CoachService`, petición con PGN/FEN/última jugada e idioma y respuesta con explicación, errores y sugerencias; adaptador HTTP `ServerCoach` preparado para `POST /api/coach`.

El entrenador todavía no está conectado ni existe ese endpoint. En la segunda etapa implementar un servidor que valide los datos, limite tamaño y frecuencia, autentique según el despliegue y llame a OpenAI con `OPENAI_API_KEY` guardada **solo en el servidor**. Nunca usar una variable `VITE_*` para secretos. Contrastar comentarios del modelo con análisis del motor y devolver explicaciones en español. Integrar el servicio tras cada jugada usando `AbortSignal` para cancelar solicitudes obsoletas.

## Licencias del motor

Stockfish.js se distribuye bajo GPL-3.0. El build incluye su licencia y un enlace al código fuente de la versión utilizada en `dist/stockfish/`. Conservar esos avisos al redistribuir. Fuente y scripts de compilación: https://github.com/nmrugg/stockfish.js/tree/v19.0.1 (paquete npm `stockfish@19.0.1`, sin modificaciones). Consultar esa licencia antes de redistribuir una versión modificada del motor.
