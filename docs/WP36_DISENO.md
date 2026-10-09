# WP-36 · Anomalías del extracto — diseño

Paquete del plan definitivo (ND-07, Ola 3, ≈ 2,5 sesiones). **Primera entrega el 9/10/2026**, sin dependencias del hogar. Estado: **en curso** — el detector y su pantalla están hechos; el criterio del plan («llegan **a la bandeja** con evidencia; falsos positivos < 20 %») no está cumplido todavía por dos motivos honestos que se explican en §3 y §5.

## 1. Qué hace

Un detector puro (`canonical-statement-anomalies.js`) sobre los movimientos **ya importados**, y una tarjeta «Cosas raras en tus movimientos» en **Movimientos** (`anomalias-ui.js`). Mira los últimos 45 días y marca cinco cosas, cada una con su evidencia:

| Aviso | Qué lo dispara | Qué lo evita |
|---|---|---|
| **Recibo devuelto** (el más grave) | Un ingreso con «devolución de recibo / recibo devuelto / impagado / rechazado» | Una devolución de compra («devolución tienda») no es una anomalía. Si encuentra el cargo original (mismo importe, ≤ 45 días antes) lo enseña |
| **Posible duplicado** | Mismo concepto, importe y cuenta, a ≤ 1 día, ≥ 5 € | Importes pequeños, otra cuenta, y un concepto que **ya se repite el mismo día en otras 2 ocasiones** (billetes de metro, café): costumbre, no anomalía |
| **Comisión** | Una comisión que **nunca** se había visto (≥ 90 días de extracto), o que ya se cobraba (≥ 3 veces) y **sube un 25 %** o más | Menos de 90 días de historia: no se presume que sea nueva |
| **Sin partida en el plan** | Un cobro **una vez al mes, tres meses seguidos**, de importe estable (±10 %) y sin partida en el plan | Con partida, importes inestables, o varios cargos al mes (compra habitual) |
| **Importe alto** | Un cargo por encima del **P95 de su partida** con holgura (×1,25, +25 € y +2·(P95−mediana)) y ≥ 8 cargos previos en ≥ 4 meses | Poca historia o poco exceso: un P95 a secas marcaría 1 de cada 20 **por construcción** |

Una fila solo se marca una vez (un duplicado enorme es un duplicado, no además un importe alto). Se muestran **seis** como máximo, de más a menos graves, y se dice cuántos quedan.

## 2. Lo que NUNCA hace

- **No actúa**: no reclama al banco, no clasifica, no borra ni toca ningún movimiento (A11-4; la prueba de navegador comprueba que el extracto queda igual).
- **No presume**: sin extracto de los últimos 45 días dice «No puedo mirar lo reciente»; un silencio sin extracto no significa que todo esté bien (mismo principio que WP-27).
- **No decide por el hogar**: cada aviso se responde con **«Es algo real»**, **«Es normal»** o **«Es normal siempre»** (calla ese patrón), con **Deshacer**.

## 3. Dónde aparece, y por qué no es la bandeja de Hoy

El plan decía «a la bandeja». La bandeja de Hoy es lo que el hogar ve por defecto en su pantalla principal, y **Hoy está congelado hasta leer H-02** (regla vigente desde el 7/10; `docs/ESTADO_TAREAS_Y_FASES.md`). Meter avisos nuevos en esa bandeja cambia lo que Hoy muestra y contamina la línea base de M-HOY (≤ 15 s) que el hogar mide el 9/10. Por eso va a **Movimientos**, donde ya se mira el extracto.

Cuando se lea H-02, llevarlo a la bandeja es **un adaptador de ≈ 15 líneas** (el detector ya devuelve `kind`, `evidence` y `id`; falta mapearlo a `decisionInboxItems` como hizo WP-14). No se construye hoy para no dejar código sin uso ni tentar a activarlo antes de tiempo.

## 4. Cómo se mide «falsos positivos < 20 %»

La tasa **sale de las respuestas**: «es normal» y «es normal siempre» son avisos que sobraban; «es algo real» no. La tarjeta lo enseña con una regla de prudencia: **con menos de 10 respuestas dice «todavía no se puede medir»**, y si la tasa pasa del 20 % lo dice (el detector necesita afinarse). Almacén `statement-anomaly-answers` (en la copia).

### Calibración sintética (cota optimista, no el número real)

Con el hogar ficticio de WP-33 (`tests/wp36-anomalias-extracto.test.cjs`, 40 semillas en la prueba y 200 al medirlo a mano) se inyectan cuatro anomalías por hogar (un duplicado, una devolución de recibo, una comisión nueva y un importe fuera de lo normal):

- **Se encuentran ≥ 90 %** de las inyectadas (la prueba lo exige).
- En un hogar **limpio** el detector marca **4 avisos en 200 hogares** (0,02 por hogar y ventana, todos «importe alto»).

**Por qué esto flatera:** (1) el hogar sintético lo escribió la misma mano que el detector; (2) la proporción de falsos positivos depende de **cuántas anomalías reales hay**. Con cuatro por hogar, 0,02 falsos son un ≈ 0,5 %; si en la vida real hay una anomalía cada diez ventanas, los mismos 0,02 serían ≈ 17 %, y con una cada veinte, ≈ 29 %. La cifra que cuenta es la de las respuestas del hogar.

## 5. Riesgos y decisiones a cuestionar

1. **Solo vale si el hogar importa extractos con regularidad.** Con el extracto parado, la tarjeta dice «No puedo mirar lo reciente» y nada más. Es el mismo límite de WP-27.
2. **«Sin partida en el plan» puede ser ruido**: cualquier cobro mensual sin clasificar sale. Es lo que se pide («recurrente fuera del plan»), pero si el hogar tiene muchos movimientos sin clasificar, será lo primero que sobre; «Es normal siempre» lo calla por concepto.
3. **El concepto se reduce a sus primeras cuatro palabras** (sin números ni referencias). Dos comercios con los mismos cuatro primeros términos se confunden; lo contrario (un comercio cuyo texto cambia de forma) lo parte en dos. Hace falta ver extractos reales para saber cuál pesa más.
4. **Los avisos contestados se identifican por concepto, importe y fecha**: el almacén guarda esas palabras del concepto (el nombre del comercio), no el importe del saldo ni el extracto. Es lo mínimo para no volver a preguntar.
5. **Sin tope de «tiempo de vida» de las respuestas**: «Es normal siempre» dura hasta que se borre el almacén. Si el hogar se arrepiente, hoy solo se deshace la última respuesta.

## 6. Pendiente

- Adaptador a la bandeja de Hoy (tras H-02).
- Medir los falsos positivos con las respuestas reales (≥ 10).
- Afinar con un extracto real (editado) si las respuestas dicen que sobran avisos.
