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
npx playwright install chromium webkit
npm run test:e2e
```

Las pruebas de navegador ejecutan la compilación de producción con perfiles de escritorio, iPhone e iPad (Chromium emulado). Comprueban una respuesta real del motor, movimiento ilegal, cancelación al deshacer, recuperación, exportación y anchura móvil. La emulación no sustituye una prueba en Safari físico.

## Desplegar

```sh
npm ci
npm run build
npm run preview
```

Para las funciones gratuitas, publicar **todo `dist/`** en un alojamiento estático (Netlify, Vercel, Cloudflare Pages o un servidor HTTP). Comando de build: `npm run build`; directorio de salida: `dist`. Vite usa rutas relativas para permitir subdirectorios. Servir `.wasm` con `Content-Type: application/wasm` y `.js` como JavaScript; no convertir peticiones de `/stockfish/*` en el HTML principal. El motor de un hilo no requiere encabezados COOP/COEP. Para una CSP propia permitir `worker-src 'self'`, `script-src 'self' 'wasm-unsafe-eval'` y los estilos inline usados por el tablero.

La partida se guarda en `localStorage` del navegador y origen actuales. Se conserva PGN, FEN y dificultad; se reconstruye el historial para mantener reglas como la repetición. Si el almacenamiento falla aparece un aviso; exportar PGN permite conservar la partida fuera del navegador. El modo privado o borrar los datos puede eliminarla. Deshacer elimina la última jugada blanca y la respuesta negra, o solo la blanca si el motor aún calcula. Cambiar de dificultad cancela la búsqueda y la reinicia al nivel elegido (0–20, sin equivalencia garantizada a Elo). El fallo del motor ofrece reintento y nunca inventa una respuesta.

## Apertura Española

El botón de recuperación carga las 22 medias jugadas proporcionadas y compara el FEN resultante **exactamente**, incluidos los contadores, con:

```
r2qr1k1/2p1bppp/p1np1n2/1p2p2b/3PP3/1BP2N1P/PP1N1PP1/R1BQR1K1 w - - 3 12
```

La prueba automatizada confirma la coincidencia; juegan blancas en el movimiento 12. Nueva partida y recuperación piden confirmación antes de reemplazar la partida guardada. El historial usa SAN internacional para mantener compatibilidad PGN; la interfaz explica las letras de piezas en español.

## Arquitectura

- `src/game.ts`: reglas, apertura, persistencia y estados de partida.
- `src/engine.ts`: protocolo UCI y ciclo de vida del Worker. Cada búsqueda tiene su propio Worker y límite de 30 segundos; se termina al deshacer, cambiar partida o dificultad para descartar respuestas antiguas.
- `src/main.tsx`: interacción, promoción, historial y controles.
- `src/coach.ts`: contrato `CoachService`, petición con PGN/FEN/última jugada e idioma y respuesta con explicación, errores y sugerencias; adaptador HTTP `ServerCoach` preparado para `POST /api/coach`.

La etapa 2B conecta `ServerCoach` a la función `api/coach.ts` exclusivamente para consultas explícitas. La configuración privada, límites y presupuesto se documentan en [Configurar IA en Vercel](docs/ai-setup.md). No se realizan consultas de IA tras las jugadas ni al cargar la aplicación.

## Licencias del motor

Stockfish.js se distribuye bajo GPL-3.0. El build incluye su licencia y un enlace al código fuente de la versión utilizada en `dist/stockfish/`. Conservar esos avisos al redistribuir. Fuente y scripts de compilación: https://github.com/nmrugg/stockfish.js/tree/v19.0.1 (paquete npm `stockfish@19.0.1`, sin modificaciones). Consultar esa licencia antes de redistribuir una versión modificada del motor.

## Etapa 2A: entrenador con Stockfish (modo mixto)

La barra discreta junto al tablero y el panel **Entrenador** actualizan la evaluación automáticamente. Todos los valores se muestran desde el punto de vista de blancas: +100 cp equivale aproximadamente a un peón de ventaja, negativo favorece a negras. La barra usa una escala visual saturada (no es una probabilidad de victoria); los mates aparecen como +M/−M y el panel indica el bando y distancia calculada. Un mate ya consumado se identifica sin inventar distancia. **Ocultar evaluación** elimina la barra y los valores automáticos; la preferencia se conserva en este navegador. Pistas y análisis siguen siendo acciones voluntarias.

No se muestran recomendaciones ni comentarios detallados automáticamente durante la partida. **Pista** muestra la jugada SAN calculada en la posición visible sin ejecutarla; **Explicar idea** describe únicamente hechos legales verificables (captura, jaque, mate, enroque, promoción) y hasta cuatro medias jugadas de la variante principal. No atribuye objetivos estratégicos al motor. **Analizar jugada** muestra las evaluaciones antes/después de la última jugada de la posición visible, la pérdida estimada, clasificación y la recomendación que había calculado Stockfish antes de jugar. Los botones esperan resultados válidos; si falla el analizador aparece un reintento independiente del rival.

### Criterio orientativo de clasificación

Se compara la evaluación antes y después de cada media jugada, invirtiendo el signo para valorar las decisiones de negras: `max(0, (antes − después) × signoDelJugador)`. Las pequeñas ganancias por ruido de búsqueda se consideran pérdida cero. Si coincide exactamente con la primera jugada de la variante calculada, se etiqueta **Mejor jugada**. En otros casos:

| Pérdida | Clasificación |
| --- | --- |
| 0–49 cp | Buena jugada |
| 50–149 cp | Imprecisión |
| 150–299 cp | Error |
| 300 cp o más | Error grave |

Son umbrales heurísticos, no juicios definitivos: las búsquedas tienen presupuesto breve y pueden alcanzar profundidades diferentes. Se descartan puntuaciones UCI con `lowerbound`/`upperbound` y PV secundarias. Los mates **no se convierten en centipeones**: perder un mate favorable detectado o permitir un nuevo mate en contra se señala como error grave, sin una pérdida ficticia en cp. Si el mate del mismo bando persiste no se penalizan cambios de distancia; salvo coincidencia con la mejor jugada se muestra **Sin clasificación en cp**. Detectar un mate depende del horizonte del motor. Los finales y las tablas, incluida triple repetición reconstruida desde el historial, se reconocen con chess.js.

### Revisión y rendimiento móvil

Tocar una jugada del historial, **Revisar partida**, **Anterior** o **Siguiente** cambia solo la posición de revisión. El tablero histórico no permite jugar. Se muestran evaluaciones y clasificaciones por jugada y hasta cinco errores principales entre las posiciones ya analizadas (ordenados por gravedad y pérdida). **Volver a la partida** recupera la posición vigente; ni navegar ni pedir ayudas cambia el PGN, guardado o turno. En la etapa 2B, entrar en Revisión pausa y cancela la respuesta del rival. Volver a Jugar reanuda la partida donde estaba, incluida una posible respuesta pendiente de negras.

El analizador es independiente del Worker rival: un único Worker adicional, WASM de un hilo, Hash de 8 MB, una búsqueda cada vez, máximo solicitado `depth 12 nodes 20000 movetime 200`. Los límites de profundidad/nodos/tiempo terminan al primero que se alcanza. Tras cada búsqueda se cede una pausa de 120 ms, y navegar aplica un debounce de 150 ms. Se prioriza la posición visible y su anterior, luego la actual y las posiciones más recientes (hasta 256 por cola). La caché de sesión conserva hasta 256 posiciones, no se guarda en localStorage y se limpia al crear/recuperar una partida. Los historiales mayores pueden necesitar recalcular posiciones antiguas al revisarlas. El límite de Hash no representa toda la memoria WASM del Worker.

Cambiar posición, deshacer o cambiar partida termina el Worker de análisis; las respuestas obsoletas no se publican. Al acabar la cola también se termina. El rival conserva su presupuesto y dificultad propios. No se añaden hilos WASM, SharedArrayBuffer ni requisitos de COOP/COEP; se mantienen toque y arrastre. Las pruebas móviles automatizadas usan emulación; comprobar Safari real en el iPad de destino sigue siendo parte de la revisión previa a producción.

### Arquitectura para la etapa 2B

`src/analysis.ts` contiene la normalización UCI, clasificación y explicaciones deterministas; `src/analyzer.ts` gestiona el Worker; `src/useAnalysis.ts` coordina prioridades/caché/cancelación y `src/Trainer.tsx` presenta las ayudas a demanda. El contrato `CoachService`, `CoachRequest`, `CoachAdvice` y el adaptador `ServerCoach` de `src/coach.ts` se conservan. Stockfish sigue siendo la fuente de evaluaciones y variantes; la etapa 2B extiende ese contrato con nivel, pregunta, índices y evidencia del motor y añade el backend de explicaciones opcionales. `src/AICoach.tsx` gestiona consultas y cancelación; `server/` valida, limita consumo y consulta a OpenAI; `src/pgn.ts` gestiona archivos PGN.

### Verificación adicional con WebKit

`npm run test:e2e` mantiene los tres perfiles Chromium para que funcione con las dependencias originales del proyecto. `npm run test:webkit` ejecuta la misma suite con WebKit y perfil iPad; requiere `npx playwright install --with-deps webkit` en un equipo con permisos de instalación. CI instala esas bibliotecas y ejecuta ambas suites. En el entorno de desarrollo de esta entrega WebKit se descargó, pero faltan bibliotecas GTK4/Graphene y otras dependencias del sistema y no hay permisos administrativos; por ello no se pudo validar localmente esta suite adicional. No se afirma haber probado Safari físico.


## Etapa 2B: IA opcional y archivos de partidas

- **Explicar con IA** y preguntas en español según nivel principiante/intermedio/avanzado. La explicación de la última jugada blanca se separa de los hechos del motor. Sin claves/configuración, Stockfish sigue disponible.
- **Exportar PGN** y **Preparar partida para análisis** descargan la partida completa con cabeceras y nombre fechado, sin enviar nada automáticamente a ChatGPT.
- **Importar PGN** valida antes de confirmar y abre un estudio en Revisión, guardado aparte. La partida contra Stockfish no se reemplaza; Jugar permite retomarla. No hay respuestas automáticas de negras en Revisión.
- Las pruebas de servidor simulan OpenAI y Redis para validar autorizaciones, límites globales compartidos, errores y entradas; las pruebas de navegador también simulan la IA y usan Stockfish real. No consumen OpenAI.

Consultar [Configuración privada, backend y presupuesto en Vercel](docs/ai-setup.md) y [Guardar, importar y compartir PGN desde Safari/iPad](docs/ipad-pgn.md). En Vercel se necesita el repositorio completo y `api/coach.ts` para la IA; un hosting exclusivamente estático conserva las funciones gratuitas.
