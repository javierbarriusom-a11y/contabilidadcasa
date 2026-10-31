# XDA-03 · Extractos en PDF — diseño

Paquete de la séptima auditoría (`docs/PROPUESTA_SEPTIMA_AUDITORIA_2026-10-17.md`, XDA-03). Decisiones del hogar del
**26/10/2026**:

- hace hoy el paso 0 adelantado: qué formatos ofrece la app de cada banco;
- acepta **pdf.js alojado en el propio sitio** (≈ 1,7 MB, con revisión de seguridad) si alguna cuenta solo da PDF;
- **no se descarta el nivel 1**, pegar el texto.

## 1. Lectura genérica, con el cuadre como garantía

No hay un formato por banco: WP-51 decidió no inventarlos. El motor (`canonical-statement-lines.js`, puro) reconoce la
forma de una línea de movimiento:

- **Al principio:** una fecha, y a veces la fecha valor. Las fechas sin año toman el de la primera fecha completa del texto.
- **Al final:** importes con formato español (`1.234,56`, `-86,40`, `86,40-`, `(86,40)`). Si hay dos, el último es el saldo.
- **En medio:** el concepto.

**Texto pegado:**

- Una línea con fecha y concepto pero sin importes se completa con la siguiente si esa solo trae importes; así llegan a
  veces las columnas al pegar.
- Una línea corta sin fecha ni importes, justo debajo de un movimiento, pasa a «más datos»; es el concepto que en el PDF
  ocupa dos líneas.
- Se reconocen «Saldo anterior» y «Saldo final».

**Signos:**

- Si el PDF marca los cargos con «-», los demás importes son abonos.
- Si no marca ninguno pero trae saldos, cada signo sale del saldo: saldo − saldo anterior = ±importe, en orden ascendente
  o descendente. La primera fila necesita la línea del saldo anterior.
- Si no hay forma de saberlo, la línea **no entra** y se dice. Nunca se adivina.

**Cuadre:** si cada fila cumple saldo anterior + importe = saldo, la lectura es buena. Si no, se dice desde qué línea se
rompe, y la revisión de Importar bloquea lo que trae saldos y no cuadra (P11).

**Diagnóstico:** estructura y motivos, sin conceptos, importes ni fechas.

## 2. Nivel 1 (hecho el 26/10): pegar el texto

- En Importar v2 hay una fuente plegada, «Texto de un PDF». Lo leído se pasa al importador como un CSV en memoria, con
  cabeceras conocidas. Así todo lo de después es exactamente lo de un CSV (huella de duplicados, bandeja, lote,
  «Deshacer», periodo de XDA-04) y `app.js` no cambia.
- El texto se borra del campo al leerlo y no se guarda en ningún almacén. La prueba de navegador lo comprueba.
- **Límite conocido:** en el iPhone, seleccionar todo el texto de un PDF de varias páginas puede ser torpe. Si lo es, el
  camino es el nivel 2.

### 2b. El mismo campo, con lo copiado de la web del banco (31/10/2026)

El hogar confirmó que Banco Mediolanum no da CSV, Excel ni PDF. Lo que queda es copiar la lista de movimientos de su web
y pegarla en el mismo campo, que pasa a llamarse «Texto de un PDF o de la web del banco». El lector entiende ya tres
formatos de web que antes no leía:

- el «€» o «EUR» separado del importe por un espacio;
- la fecha con el mes en letra («31 oct. 2026», «30 de octubre de 2026», «31 oct» con el año de hoy; lo que caería en el
  futuro es del año anterior);
- cada dato en su línea: fecha, concepto, importe y, debajo, el saldo, con el que se fija el signo.

La forma real de la web de Mediolanum (vista el 31/10): cabecera con tabuladores y cada movimiento en cinco líneas
(fecha, concepto, «-» de la columna vacía, importe con «€» y saldo con «€»), lo más nuevo arriba. Se lee entera y cuadra; el
guion suelto de una columna vacía no se pega al concepto, y delante de un importe sin signo se toma como signo menos.

Lo demás no cambia: el cuadre, la revisión, la huella de duplicados y que el texto no se guarda.

## 3. Nivel 2 (si el paso 0 confirma una cuenta que solo da PDF)

- **pdf.js en `vendor/`:** versión fijada y corregida (≥ 4.2.67, por CVE-2024-4367), `isEvalSupported: false`, sin
  fuentes ni recursos de fuera, *worker* del mismo sitio y cargado solo al elegir un PDF. Pasa la revisión de NTC-06.
- **Mismo motor:** `linesFromItems` rehace las filas por página y altura con las posiciones que da pdf.js, y `parse` hace
  el resto.
- **Entradas:** Importar acepta `.pdf`, y el buzón de XDA-02 deja de decir «todavía no se puede leer» para los PDF.
- **Pruebas:** con PDF inventados que genera el propio navegador de pruebas desde tablas, sabiendo qué tienen que dar. Y
  un PDF real del hogar, con los datos cambiados, antes de darlo por bueno.
