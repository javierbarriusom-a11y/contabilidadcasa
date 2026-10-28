# WP-18 · Aportado frente a valor y rentabilidad ponderada por tiempo (NIN-03)

**PR-1, 28/10/2026.** Ficha de la propuesta: `docs/PROPUESTA_QUINTA_AUDITORIA_2026-10-02.md` (NIN-03). Paquete del plan: `BACKLOG_DEFINITIVO.md` §5.3 (P2, Ola 3), depende de WP-15.

## 1. Qué responde

Dos preguntas sobre la cartera que la app no contestaba:

1. **¿Cuánto de lo que tenemos lo pusimos nosotros y cuánto el mercado?** «De cada 100 € de vuestra cartera, 82 los pusisteis vosotros y 18 los ganó el mercado.» En pérdidas: «Habéis puesto X y hoy vale Y: el mercado se ha llevado Z (P % de lo puesto).»
2. **¿Qué hizo el mercado, al margen de cuándo aportamos?** La rentabilidad ponderada por tiempo (TWR), junto a la XIRR que ya existía.

## 2. Por qué ahora se puede

Hasta WP-15 la app decía, con razón, que la TWR «exige valoraciones intermedias que esta app no registra». Desde el 6/10 la hoja de valoración guarda una serie con fecha por posición (`portfolio-valuations`). Esa frase se ha corregido en `app.js`: ahora dice dónde está la TWR.

## 3. El cálculo (`canonical-portfolio-valuation.js`, puro)

- **Aportado frente a valor** (`contributedVsValue`): sobre lo que sigue en cartera, el coste de lo que queda (`costBasis` de cada posición, el mismo FIFO de siempre) frente a su valor. No es lo mismo que todo lo aportado desde siempre: lo vendido ya no está.
- **Puntos de valor de una posición** (`positionPoints`): el alta (su coste, en la fecha de compra), el valor declarado con su fecha y las valoraciones de la hoja. A igual fecha manda la hoja.
- **TWR de una posición** (`positionTwr`, `chainTwr`): encadena los tramos entre dos puntos. Dentro de un tramo, cada aportación o venta cuenta por los días que estuvo invertida (Modified Dietz), porque la app no tiene el valor justo el día de cada flujo.
  - Con valoraciones mensuales, la diferencia con la TWR exacta es pequeña, y la pantalla lo dice.
  - **Con menos de dos puntos, «datos insuficientes»**: nunca una cifra.
  - **Se anualiza solo con un año o más.** Antes, la cifra es la del periodo, y la pantalla avisa de que entonces no se compara directamente con la XIRR, que siempre va pasada a un año.
- **TWR de la cartera** (`portfolioTwr`): en cada fecha con algún punto, cada posición vale su último punto conocido. Si no se valoró ese día, se arrastra su último valor; `carried` cuenta cuántas veces, y la pantalla lo dice. El alta de cada posición es una aportación más.

## 4. La pantalla (`aportado-ui.js`)

- Tarjeta «Aportado frente a valor» en Inversión › Cartera, debajo de «Valoración de la cartera».
- Contenido: la frase, las dos rentabilidades con su explicación y, plegado, el detalle por posición (lo que costó, el valor, la TWR y la XIRR).
- **Sin dos fechas con valor:** dice qué falta y ofrece «Actualizar valoración», que abre la hoja de WP-15.
- **Nace apagada en Funciones en prueba** (XGO-03, «Aportado frente a valor»). Sin posiciones, no sale. No cambia ningún dato y no recomienda comprar ni vender.
- **Medidor (XGO-02):** vista y, como acción, ir a valorar desde la tarjeta. La métrica de la ficha: que se mire tras cada valoración. Se retira si en dos meses con valoraciones nadie la abre.
- **Estilos** en `calma.css` (la hoja de las tarjetas de Cartera), para no añadir otra petición.

## 5. Lo que no hace este PR-1

- **El gráfico de aportaciones acumuladas (escalón) frente al valor** que pedía la ficha. Se hará en el PR-2 con el kit de gráficos (WP-28), solo si la tarjeta se usa.
- **Una TWR exacta**, que exigiría el valor de cada posición el día de cada aportación. La hoja no lo pide, y pedirlo costaría minutos al hogar.
- **Cambiar `iv2XirrLabel`**, que sigue con el formato viejo («+43.13%») en el resto de Cartera. La tarjeta formatea su propia XIRR («+43,1 % al año»). El resto es una deuda conocida (`docs/rediseno/ESTADO.md` §5).

## 6. Pruebas

- `tests/wp18-aportado-twr.test.cjs` (6), con cifras calculadas a mano:
  - un tramo con un flujo al final no cuenta como mercado;
  - la TWR no depende de cuándo se aportó;
  - no se anualiza antes de un año;
  - sin dos puntos no hay cifra;
  - la cartera arrastra y lo cuenta;
  - el reparto en ganancias y en pérdidas.
- `tests/iv2-app-integracion.test.cjs`: la frase antigua de que la app no registra valoraciones ya no está.
- E2E «WP-18 · Aportado frente a valor» a 390 y 1280 px, la de 390 px también en Safari:
  - apagada no sale; encendida da la frase (82 y 18), la TWR (+29,6 % del 1 ene al 1 oct), la XIRR «al año» y el aviso de que no se comparan directamente;
  - el detalle por posición, con su TWR y su XIRR; sin desbordar;
  - sin dos fechas con valor, lleva a la hoja de valoración.
