# Configurar el entrenador con IA en Vercel

La etapa 2B mantiene todo el entrenamiento local gratis. `POST /api/coach` solo llama a OpenAI tras pulsar **Explicar con IA** o **Enviar pregunta**. Introducir el código de acceso no llama a OpenAI. No hay consultas al cargar, después de una jugada, al navegar o al cambiar nivel. Las pruebas usan proveedores simulados; no se hicieron llamadas de pago durante el desarrollo.

## Configuración privada

Después de revisar y aprobar el PR, configurar en **Vercel → Project → Settings → Environment Variables**. Usar Production para el despliegue aprobado. No activar la IA en previews por defecto: las funciones gratuitas no requieren ninguna de estas variables. Vercel debe desplegar el proyecto completo, no solo `dist`, para incluir `api/coach.ts`. `vercel.json` limita la función a 25 segundos. No hay que reescribir `/api/*` a `index.html`.

| Variable privada | Uso |
| --- | --- |
| `OPENAI_API_KEY` | Clave de un proyecto dedicado de OpenAI, nunca una variable `VITE_*`. |
| `OPENAI_MODEL` | Modelo compatible con Responses API y Structured Outputs. Predeterminado: `gpt-4.1-mini`. |
| `COACH_ALLOWED_ORIGIN` | Origen HTTPS exacto de la web, por ejemplo `https://chess.example.com`, sin ruta ni `/` final. Solo se aceptan peticiones con ese Origin. |
| `COACH_ACCESS_CODE` | Código compartido privado, mínimo 16 caracteres; generar uno aleatorio de 32 caracteres o más. Se entrega solo a usuarios autorizados. |
| `COACH_SESSION_SECRET` | Secreto de firma de al menos 32 caracteres; usar 64 caracteres aleatorios. |
| `UPSTASH_REDIS_REST_URL` | URL REST HTTPS de una base Upstash Redis dedicada. |
| `UPSTASH_REDIS_REST_TOKEN` | Token de escritura privado de esa base; necesita ejecutar EVAL, GET, INCR y EXPIRE. |
| `COACH_DAILY_LIMIT` | Máximo global de consultas por día UTC. Predeterminado 100; admite 1–500. Se recomienda comenzar con 10. |

Crear Redis desde Upstash o su integración de Vercel y copiar la URL/token REST en estas variables. No se usa memoria de una función como limitador: si Redis o cualquier configuración obligatoria falta o falla, la IA devuelve 503 y no se llama a OpenAI. Las funciones gratuitas siguen operativas. `.env.example` contiene solo nombres y valores vacíos. `.env*` está ignorado por Git.

Para generar código y secreto en **tu terminal**, sin subirlos al repositorio:

```sh
openssl rand -hex 16
openssl rand -hex 32
```

Tras configurar las variables, el administrador debe aplicar un nuevo despliegue aprobado de Vercel para que se carguen. Este PR no configura claves, no fusiona ni despliega producción. Para una preview con IA de prueba, usar sus propias variables, origen exacto y un límite pequeño; preferiblemente una clave de proyecto independiente. No compartir las variables privadas en capturas ni conversaciones.

## Acceso y protección de consumo

Al pulsar una consulta sin sesión se pide **Código de acceso a la IA**. Una vez validado, el servidor emite una cookie `__Host-chess-coach`, firmada con HMAC, `Secure`, `HttpOnly`, `SameSite=Strict`, con duración de ocho horas. El código no se guarda en localStorage, el JavaScript no puede leer la cookie y desbloquear no inicia consultas automáticamente. No es un sistema de cuentas personales; para abrir el servicio al público conviene sustituir este acceso compartido por autenticación de usuarios y cuotas individuales.

Redis evalúa de manera **atómica** todos los contadores aplicables; sus claves tienen caducidad y las IP se seudonimizan mediante HMAC:

- Desbloqueo: 8 intentos por IP cada 10 minutos y 100 globales cada 10 minutos.
- Consultas de IA: 3 por IP/minuto, 30 por IP/día UTC y 20 por sesión/día UTC.
- Cupo global diario: `COACH_DAILY_LIMIT`, compartido por todas las funciones del mismo origen y secreto.

Los rechazos devuelven 429 con un mensaje en español. Puede ser necesario esperar hasta el siguiente día UTC; no se reintenta automáticamente. El límite por IP usa `x-forwarded-for`, que Vercel establece para el cliente. Si se mueve el backend a otro servidor, configurar un proxy que sobrescriba esa cabecera y no permita al cliente falsificarla. El cupo global sigue siendo la barrera final aunque cambie la IP o se creen sesiones nuevas. Para protección de tráfico masivo anterior a la función, puede añadirse el firewall/WAF de Vercel.

El origen y secreto forman el espacio de claves del limitador. Cambiarlos reinicia sus contadores y las sesiones; distintas previews no comparten cupo con producción. Al rotarlos, tener en cuenta el gasto ya consumido ese día y reducir el límite o deshabilitar temporalmente la clave. Redis consume operaciones de su propio plan: revisar también su cuota.

## Presupuesto y límites

Cada consulta admitida reserva su cupo **antes** de llamar al proveedor. Si falla, se cancela o agota el tiempo, no se devuelve ese cupo: una petición aceptada por OpenAI podría facturarse aunque no se muestre una respuesta. No hay reintentos, streaming ni conversaciones encadenadas. Cada pregunta envía únicamente el contexto actual validado.

Límites del servidor:

- POST JSON de hasta 80 KB; PGN de hasta 48 000 caracteres y 600 medias jugadas; pregunta de hasta 1000 caracteres.
- Reconstrucción de FEN, jugada seleccionada e índice desde el PGN usando chess.js. Se validan scores, profundidades y hasta ocho jugadas UCI legales por variante. Las cifras del motor de navegador no se recalculan en el servidor: no son una prueba criptográfica de fuerza o exactitud del análisis.
- Antes de enviar a OpenAI se reconstruye un PGN sin comentarios ni cabeceras arbitrarias. Se separan instrucciones de los datos del usuario. Contexto más instrucciones: máximo 20 000 bytes UTF-8.
- Respuesta: máximo solicitado de 900 tokens, JSON estructurado validado y hasta 8000 caracteres en total; respuestas incompletas se rechazan.
- Redis: 2,5 segundos; OpenAI: 15 segundos, incluyendo la lectura del resultado; función Vercel: 25 segundos. El cliente permite cancelar y abandona a los 22 segundos. Cambiar posición desmonta la consulta y descarta la respuesta anterior.

No se promete un tope exacto en dólares: los precios dependen del modelo y pueden cambiar. Como cálculo conservador para el modelo predeterminado, reservar hasta **21 000 tokens de entrada y 900 de salida por consulta** (el límite de bytes más margen de protocolo). Con `N` consultas/día y precios actuales `Pentrada`/`Psalida` por millón:

```
coste diario conservador ≈ N × (21 000 × Pentrada + 900 × Psalida) / 1 000 000
```

Consultar los precios vigentes de OpenAI antes de aumentar `N` o cambiar modelo. Usar un proyecto dedicado, revisar Usage y configurar presupuesto y alertas en OpenAI. Algunas alertas de presupuesto no bloquean peticiones: el corte efectivo de esta aplicación lo aplican los contadores del servidor. El coste de Vercel y Redis va aparte.

## Respuestas educativas

El backend devuelve **datos calculados por Stockfish** producidos por código determinista y, aparte, la **interpretación educativa de la IA**. Se instruye al modelo a explicar la jugada seleccionada, comparar con la recomendación previa, comentar amenazas y planes según el nivel, y marcar como hipótesis lo que no demuestran las variantes aportadas. La IA puede equivocarse: no se presenta su texto como un cálculo del motor y no puede ejecutar jugadas.

En modo Jugar, «Explicar con IA» selecciona la última jugada de blancas, aunque Stockfish ya haya respondido; las preguntas se refieren al FEN visible. En Revisión se usa la jugada seleccionada. Si aún faltan evaluaciones locales, los botones esperan sin iniciar cobros. La petición contiene FEN, PGN, índices, SAN seleccionada y evaluaciones/variantes antes y después. El PGN y la pregunta salen del dispositivo solo en una consulta explícita. `store:false` evita guardar la respuesta para recuperación mediante la API; siguen aplicándose las políticas de datos del proveedor.

## Desarrollo y pruebas

`npm run dev` y `npm run preview` sirven la aplicación Vite y Stockfish. No ejecutan funciones Vercel. Para probar el backend configurado se puede usar Vercel CLI (`vercel dev`) con variables privadas locales y el origen correspondiente; las cookies Secure requieren un origen seguro compatible con el navegador. El flujo local sin claves se prueba con mocks de HTTP y las pruebas de servidor, sin facturación.

```sh
npm ci
npm test
npm run build
npx playwright install --with-deps chromium webkit
npm run test:e2e
npm run test:webkit
```

CI ejecuta compilación, pruebas de servidor/PGN y ambas suites de navegador. Antes de producción, probar manualmente un código incorrecto, acceso correcto, explicación, pregunta, límite 429, falta de Redis y ausencia de clave. No copiar una clave de producción a las pruebas. El funcionamiento real de la clave/modelo debe comprobarlo el administrador con una consulta consciente después de aprobar y configurar el despliegue.
