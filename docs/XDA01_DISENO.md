# XDA-01 · Lo que la app te pide (diseño)

Ficha de origen: `docs/PROPUESTA_SEPTIMA_AUDITORIA_2026-10-17.md`, XDA-01. Sin puerta. Construida el 26/10/2026 a petición del hogar
(«sigue con lo siguiente que no dependa de mí»), detrás de XPR-06.

## Problema

Cada paquete añade una obligación de datos y nadie suma su coste. GOV-01 fija 10 minutos a la semana de mantenimiento, pero se mide
preguntando (panel de uso de WP-03) o, desde el 24/10, con el Repaso semanal. Por función no se sabe qué cuesta, y las funciones sin dato
enseñan «sin datos» y parecen rotas.

## Qué hace el PR-1

- **Registro de contratos** (`canonical-data-contracts.js`, puro). Cada función declara qué fuentes necesita y cada cuánto. Las fuentes
  son las seis fichas de frescura de WP-45 (`datos-ui.js`): saldos, extracto, cobros y cargos esperados, valoración de la cartera, índices
  de referencia y cierre del mes.
- **Coste semanal.** Para cada dato, minutos × 7 / cadencia. Los minutos son los de WP-45: medidos cuando hay al menos 3 usos y, si no,
  supuestos, y se dice. Para cada función, la suma de lo suyo. El **total cuenta cada fuente una vez**, con la cadencia más exigente entre
  las funciones que la piden: dar el extracto sirve a la vez a Movimientos, a la Previsión y al Cierre.
- **Hambre.** Una función tiene hambre si alguno de sus datos está antiguo o no ha llegado nunca (tono `stale` o `unknown` de WP-45). Sin
  ninguna ficha, todas tienen hambre: no se finge que algo está al día.
- **Lo que no aplica no cuenta.** Sin cartera no hay valoración que dar; sin índices declarados, no hay revisión de la hipoteca.
- **Tarjeta** en Ajustes › Uso de la app: la frase con el total frente a los 10 min, una barra (`<meter>`), los minutos medidos por el
  Repaso semanal si hay alguno terminado, y cada función con su coste, su hambre y el enlace a dar el dato que falta. Primero las que tienen
  hambre; después, por lo que cuestan.
- **Nace apagada** en Funciones en prueba (regla de XGO-03), con interruptor propio: sin encenderla, la tarjeta está oculta y XGO-01 no
  cuenta nada nuevo. El medidor (XGO-02) cuenta la vista y, como acción, cada vez que se va a dar un dato desde la tarjeta.

## Cadencias y minutos supuestos (a revisar con lo medido)

| Función | Datos y cadencia |
|---|---|
| Hoy: la cifra del día | saldos cada 4 días (cuando WP-26 los da por antiguos); cobros y cargos esperados cada semana |
| Movimientos y Clasificar | extracto cada semana |
| Previsión y banda de caja | saldos y extracto cada semana |
| Cierre del mes | extracto y cierre cada mes |
| Cartera e inversión (si hay cartera) | valoración cada 35 días (cuando WP-45 la da por antigua) |
| Patrimonio neto | cierre cada mes; valoración cada 35 días si hay cartera |
| Revisión de la hipoteca (si hay índices) | índices cada mes |

Minutos supuestos por vez, mientras no haya 3 medidas: saldos 20 s, extracto 2 min, cobros 30 s, valoración 1 min, índices 1 min y
cierre 3 min (los mismos supuestos que la cola de WP-45).

## Lo que queda para el PR-2 (si el PR-1 se usa)

- **«Pausar»** una función: libera su obligación del total y silencia sus avisos. Silenciar avisos toca muchas pantallas, y cada aviso
  tiene que saber de qué función es. Pausar sin silenciar sería engañoso, así que no entra a medias.
- **Plegar a una línea** las funciones con hambre en su propia pantalla, con el dato que falta y el enlace exacto.
- Ordenar por **valor por minuto**, como pide la ficha: hoy no hay una medida de valor por función (el medidor de XGO-02 empieza a darla).

## Registro de altas (XUX-02, 27/10)

Además de lo que se da cada semana, el registro guarda las **altas**: lo que se da una vez para que una tarjeta deje de estar vacía (`ALTAS`,
`alta(id)`). De momento, el plan B (10 min) y la política de inversión (15 min), supuestos. Las usa «Ver cómo quedaría» (XUX-02) al pie de
cada ejemplo.

## Métrica y retirada

Métrica de la ficha: M-COSTE medido, no declarado; funciones con hambre, 0 o pausadas. Se retira si nadie la abre en dos meses (queda el
registro como comprobación del CI).
