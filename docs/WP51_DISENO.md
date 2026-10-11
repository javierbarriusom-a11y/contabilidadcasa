# WP-51 · Perfiles de extracto con autodetección — diseño

Paquete del plan definitivo (ND-04, Ola 3, ≈ 2,5 sesiones). **Entrega del 11/10/2026.** Estado: **en curso**: la lectura de CSV está hecha y probada con un corpus sintético (WP-33), pero **ningún extracto real de ningún banco se ha probado todavía**, que es lo que dice si el paquete cumple su criterio («cero extractos rechazados sin explicación»).

## 1. Qué hace

Antes, el importador de extractos (Registrar › Importar extracto) leía un CSV solo si traía cabeceras `Fecha / Movimiento / Importe / Saldo` en la primera fila, y decidía el separador **fila a fila** (el que más veces aparecía en esa línea). Un concepto con comas («PAGO TARJETA, TIENDA A, B») en un fichero de punto y coma podía partir mal la fila, y una fila con un importe ilegible se **descartaba en silencio**. Ahora (`canonical-statement-profiles.js`, motor puro; `extracto-perfiles-ui.js` y `extracto-perfiles.css`, el panel; almacén `statement-profiles-data`, **en la copia**):

1. **Deduce** la codificación (UTF-8 con o sin BOM, UTF-16 y Windows-1252), el separador (por consistencia entre filas, con comillas), el formato decimal (coma o punto, con miles), el orden de las fechas (día/mes o mes/día, ISO, mes en letra, año de dos cifras, con hora), la **fila de cabecera** (saltando filas de título) y el **papel de cada columna** (fecha, fecha valor, concepto, más datos, importe, **debe/haber**, columna de signo D/H, saldo).
2. **Dice lo que no sabe** en vez de suponerlo: fechas que no deciden entre día/mes y mes/día, «1.234» (¿mil doscientos o 1,234?), cifras con dos formatos, fichero que no es UTF-8, filas sin concepto, saldos que no se pueden leer.
3. **Audita el signo con la columna de saldo**: cada saldo debería ser el anterior más el movimiento (en orden ascendente o descendente). Si encaja «al revés», avisa de que los cargos y abonos pueden estar cambiados y ofrece «Invertir el signo»; **no lo corrige solo**.
4. **Cada fila ilegible sale con su número de línea y su motivo** («Fila 17: fecha no reconocida (xx/yy)») y **no se importa**: ni como 0 ni como «lo que quede al quitar letras» (el parser anterior convertía «abc12» en 12).
5. **Panel «Cómo he leído este fichero»** en el paso 1: lo deducido, las cinco primeras filas ya interpretadas, los avisos, las filas con error y los ajustes (separador, decimal, orden de fechas, fila de cabecera, papel de cada columna, invertir signo). Corregir **relee el mismo fichero** (solo en el paso 1: más allá se perderían las decisiones). Si no hay cabecera reconocible, enseña las primeras filas y deja asignar los papeles a mano.
6. **Perfiles con nombre**: el resultado se guarda («Mi banco») con la firma de la cabecera; la próxima vez que llegue un fichero con esa cabecera se aplica solo (separador, decimal, fechas, columnas). Lo fijado a mano en el momento gana al perfil. Máximo 12; quitar uno se deshace.
7. **«Copiar diagnóstico»**: estructura (formatos, papeles de columna, números de fila y motivos), **nunca** conceptos, importes ni fechas del fichero.

El contenido del extracto **solo vive en memoria**: ni el panel ni el motor lo guardan en ningún almacén (el almacén de perfiles guarda formatos, no datos). El asistente de cuatro pasos de siempre (clasificar, duplicados, incorporar, deshacer lote) no cambia.

## 2. Reglas del motor, con prueba (`tests/wp51-perfiles-extracto.test.cjs`, 21 pruebas)

- Formato de siempre intacto; título antes de la cabecera; separador por consistencia (el concepto con comas ya no rompe la fila); formato inglés; debe/haber y columna D/H (**una «C» suelta es un error de fila**: unos bancos la usan para cargo y otros para crédito); codificaciones; comillas con saltos de línea (los números de fila son los de la línea física del fichero); fechas.
- **Ambigüedad avisada y corregible**: fechas, «1.234», mezcla de formatos; el override la resuelve y el aviso desaparece.
- **Importes estrictos** (`parseNumber`): «abc12», «1.2.3», «12,5x» → error de fila; «12,50-», «(12,50)», «−12,50 €», «EUR 1.000» → bien.
- **Saldo como auditor del signo**: cuadra (ascendente o descendente), «signo invertido» (avisa sin corregir; con `invertSign` cuadra) y «no cuadra».
- **Verdad conocida (WP-33):** el mismo hogar sintético (12 meses, > 60 movimientos) escrito en **seis formatos** distintos (punto y coma con coma decimal; tabulador con título; coma con comillas y punto decimal ISO; mes/día/año; debe/haber; importe sin signo + D/H) se lee **idéntico al libro original**, sin errores ni avisos y con los saldos cuadrando.
- Perfiles: firma, precedencia (lo explícito gana al perfil), límite de 12, normalización de basura. Diagnóstico sin contenido (se comprueba con marcas secretas). Motor puro (sin DOM, red, almacenamiento, reloj ni azar) y **sin ningún perfil «de banco» inventado**.

## 3. Dónde se aparta del plan, y por qué

| El plan decía | Lo entregado | Por qué |
|---|---|---|
| «Perfiles con nombre **por banco**» y «averiguar qué formatos exporta cada banco» | **Perfiles que guarda el hogar**, ninguno preinstalado | No conozco el formato real de exportación de ningún banco concreto y **no lo voy a inventar** de memoria: un perfil «CaixaBank» falso rechazaría o malinterpretaría extractos reales. La autodetección cubre lo común; lo que no, se corrige una vez y se guarda |
| «Cuaderno 43 solo si lo ofrecen; verificar» | **No construido** | No se sabe si el banco del hogar lo ofrece. Es un formato de ancho fijo distinto: otro motor |
| «Corpus de pruebas **anonimizado**» (de extractos reales) | **Corpus sintético** (WP-33), seis formatos | El repositorio es público y no puede llevar extractos reales; además no tengo ninguno. **Lo que no cubre un corpus inventado es lo que un banco real hace de forma inesperada** |
| Excel (.xlsx) | **Sin cambios** | El lector de Excel sigue exigiendo una hoja de movimientos con sus cabeceras (`loadTransactionsFromWorkbook`). La autodetección es solo para CSV/TXT |

## 4. Decisiones mías y riesgos a cuestionar

1. **No hay ninguna prueba con un extracto real.** El criterio de éxito («cero extractos rechazados sin explicación») solo se mide con el fichero que el hogar descarga de su banco. Hasta entonces, el paquete es construido, no comprobado.
2. **Las filas ilegibles no bloquean el paso 2.** El panel las lista y dice que no se importarán, pero «Continuar» sigue disponible con las demás. Alternativa más estricta: bloquear hasta que no haya filas con error. Me pareció excesivo (un pie de página mal formado impediría importar), pero **un hogar con prisa puede importar un extracto al que le faltan filas**; el saldo final y la comprobación de huecos del paso 4 lo detectan en parte.
3. **Orden día/mes por defecto = día/mes.** Si todas las fechas del fichero son ≤ 12, no hay forma de saberlo: se avisa y se supone el orden español. Un fichero en mes/día de un mes en que todos los días son ≤ 12 sale mal **con aviso**, no sin él.
4. **Una cabecera que no se reconoce** (un banco que llame a la columna «Operación» o «F. oper.») cae al modo manual: hay que asignar los papeles una vez y guardar el perfil. La lista de nombres reconocidos es mía (fecha operación, fecha contable, descripción, cargos, abonos, saldo disponible…), **sin contrastar con ningún banco**.
5. **La comprobación del saldo exige ≥ 3 saldos y el 80 % de los pares**: un extracto con pocos movimientos no tiene auditoría de signo. Y un extracto **parcial** (faltan filas) sale «no cuadra» aunque el signo esté bien: el aviso lo dice como posibilidad entre varias.
6. **Un perfil se reconoce por la firma exacta de la cabecera**: si el banco añade una columna, el perfil deja de aplicarse (se ve: «Perfil aplicado» desaparece).
7. **Corregir la lectura rehace la sesión**: descarta la entrada de la bandeja de la lectura anterior y conserva la cuenta elegida; no conserva nada más (en el paso 1 no hay nada más).
8. El 50 % de «en curso» **infrapuntúa** esta vez lo hecho en CSV (≈ 80 % del alcance) pero **sobrepuntúa lo comprobado** (0 extractos reales): lo dejo en la regla.

## 5. Pendiente

- **Del hogar:** subir **un extracto real** (su CSV) a Registrar › Importar extracto y decir si se lee bien o qué dice el panel; si hay filas con error o avisos, **copiar el diagnóstico** (no lleva datos) y pasármelo. Con un par de bancos reales se afina la lista de cabeceras y se decide si merece la pena un perfil preinstalado.
- Cuaderno 43 (si el banco lo ofrece), autodetección para el Excel, bloquear el paso 2 con filas ilegibles (si se prefiere), previsualizar más de cinco filas, perfil por cuenta.
- Con este paquete **WP-33 gana su segundo consumidor** (WP-08 y WP-51); le falta solo la banda de WP-16.
