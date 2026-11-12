# Guardar y recuperar partidas desde Safari en iPad

## Guardar una partida o preparar un análisis en ChatGPT

1. En Chess Coach, pulsa **Exportar PGN** o **Preparar partida para análisis**. Ambos descargan el PGN completo de la partida que estás viendo, incluso si recorres una posición anterior o la partida no ha terminado.
2. Si Safari pide confirmación, elige **Descargar**. El archivo tendrá un nombre como `chess-coach-2026-11-11-2158.pgn`, con fecha y hora locales del dispositivo.
3. Abre las descargas de Safari y toca la lupa o abre **Archivos → Explorar → Descargas**. Según la configuración de Safari, puede estar en iCloud Drive o «En mi iPad».
4. Conserva el archivo en una carpeta propia o compártelo desde el menú de Archivos. En ChatGPT abre una conversación, usa el botón de adjuntar y selecciona ese `.pgn` desde Archivos. Puedes pedir, por ejemplo: «Analiza esta partida en español para un principiante y revisa mis errores principales».

La aplicación no envía automáticamente nada a ChatGPT. El PGN es autónomo: incluye las cabeceras estándar, posición inicial personalizada si existe, historial SAN completo, comentarios compatibles y resultado. Usa `*` para una partida inconclusa sin resultado declarado. El nombre de archivo es la hora de descarga; la cabecera Date conserva la fecha de la partida cuando está disponible. En partidas antiguas sin fecha, se asigna al abrir esta versión por primera vez.

La descarga se inicia desde el gesto del usuario con un enlace Blob adjunto al documento y MIME PGN UTF-8; el archivo se mantiene disponible durante 60 segundos para la descarga de Safari. Si Safari abre una vista previa en lugar de descargarlo, usa **Compartir → Guardar en Archivos**. La ubicación exacta de descargas depende de iPadOS y de los ajustes de Safari.

## Importar sin perder la partida actual

1. Pulsa **Importar PGN** y selecciona un archivo `.pgn` desde Archivos.
2. Chess Coach valida las jugadas con chess.js. Si hay un error, muestra un aviso y mantiene tu partida intacta.
3. Revisa el número de medias jugadas y confirma **Abrir en revisión**. Puedes cancelar sin cambiar nada. Esta confirmación reemplaza únicamente la revisión importada anterior; no reemplaza la partida contra Stockfish.
4. El modo **Revisión** muestra las posiciones y análisis gratuitos, pistas e IA opcional. No permite mover piezas y el rival está pausado. Si el PGN termina con turno de negras, no se añade una respuesta automática.
5. Recorre el historial con los botones, consulta errores y exporta la partida completa en cualquier momento.
6. Pulsa **Volver a la partida** o **Jugar** para retomar tu partida original exactamente donde estaba. Si quedaron negras pendientes, Stockfish retoma su respuesta al regresar a Jugar.
7. **Revisar PGN importado** vuelve al estudio importado. Se conserva separado en este navegador y se recupera tras recargar; guarda siempre su archivo original como copia independiente.

Límites: un archivo de una sola partida, hasta 256 KB y 2000 medias jugadas. Se aceptan SAN estándar, enroques, promociones, comentarios y una posición inicial FEN. Para evitar pérdidas silenciosas, se rechazan colecciones de varias partidas y árboles de variantes: exporta una partida y una línea principal desde la herramienta de origen. Las cabeceras y comentarios se conservan; no se guardan árboles alternativos. El backend de IA tiene límites menores y puede rechazar un estudio extenso sin afectar el análisis gratuito ni su exportación.

Crear una partida nueva o recuperar la Apertura Española conserva su confirmación habitual antes de sustituir la partida de juego. El guardado automático permanece en el mismo origen/navegador; borrar datos de Safari o usar modo privado puede eliminarlo. Un archivo `.pgn` exportado permite recuperar sus movimientos independientemente del guardado local.
