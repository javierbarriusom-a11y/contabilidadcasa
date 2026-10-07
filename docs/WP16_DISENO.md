# WP-16 · Banda de caja a 30 días — diseño y calibración

Paquete del plan definitivo (NPV-01, Ola 3 adelantada, ≈ 5 sesiones estimadas). Construido el 7/10/2026 sobre WP-08 (días de cargo), WP-10 (medidor de calidad), WP-28 (kit de gráficos) y WP-33 (hogar sintético con verdad conocida).

## 1. El problema

La previsión actual pone cada gasto del que no sabe la fecha **el día 8** y lo trata como si fuera cierto. Con datos reales, el 100 % de las salidas tenía fecha estimada (`docs/OLA2_RECALIBRACION.md`). Una línea que finge conocer el día de cada recibo no dice la verdad en ninguna de las dos direcciones: avisa de un bajón que quizá no llegue y no avisa del que sí.

## 2. Qué es

Una tarjeta plegada en **Plan › Previsión** («Banda de caja a 30 días») con tres cosas, calculadas sobre 500 trayectorias:

1. **La banda P10-P90** de la liquidez día a día (CaixaBank + Mediolanum) y su mediana, más la trayectoria «según el plan» para compararla.
2. **La probabilidad de cruzar el suelo** de liquidez, con el tramo de días donde pasaría: «En 3 de cada 10 trayectorias la liquidez baja del suelo (1500 €) entre el 8 y el 12 de noviembre».
3. **El día más probable del mínimo** (o «lo más probable es que el punto más bajo sea el saldo de hoy», si ningún día baja de ahí).

Con el kit de WP-28: se recorre con el dedo, el ratón o las flechas, con la lectura fija bajo el gráfico, y «Ver como tabla» da los 31 días. Es **probabilidad, no calendario**: no dice qué día cae cada recibo.

## 3. Cómo se modela (y por qué)

| Qué | Cómo | Motivo |
|---|---|---|
| Eventos con día cierto (observado, por regla, día de cargo indicado por el hogar) | Caen en su día | Es lo que sabe el plan |
| Eventos con fecha **estimada** | Uniforme en una ventana (días 1-28 del mes, sin lo anterior al saldo declarado) | Sin dato mejor, la ignorancia honesta; la ventana aprendida (WP-04/WP-08) sustituirá a la genérica |
| Gasto variable estimado (súper, gasolina) | **Repartido por igual** entre los días que quedan del mes, sin azar | Llega en muchos pagos pequeños; tratarlo como un pago en un día al azar inventaría una varianza que no existe |
| Dentro de un día | Primero lo que sale; el mínimo se mide ahí. La banda, a fin de día | Prudente: no se anuncia un colchón que depende de que el cobro llegue antes que el recibo |
| Traspasos entre cuentas propias | Ignorados | No mueven la liquidez total |
| Saldo declarado de hace N días | La banda parte de la fecha de los saldos y se ensancha por los días sin declarar | No se finge frescura |
| Importe | **Sin incertidumbre** (hoy) | La app no aporta dispersión por partida; el motor la admite (`amountSd`). La tarjeta lo dice |
| Semilla | Fija y determinista | Un repintado no mueve la banda |

**Decisión de diseño que cuestionar:** un evento estimado anterior a la fecha de los saldos se mantiene **pendiente** (su día era una suposición del plan y el saldo no lo ha recogido); uno con día cierto anterior ya pasó. Con saldos del 20 y un recibo «del día 8» sin día cierto, el recibo se reparte entre el 20 y el 28, no se descarta.

## 4. Calibración con el hogar sintético (WP-33)

Un mes ficticio con dos cargos fijos conocidos y cuatro erráticos (fecha uniforme 1-28, la forma que el generador asigna a «errático»), cobro el día 15, saldo de partida 3.600 € y suelo 800 €. Se compara lo que dice el motor con lo que pasó de verdad en **cada** hogar (semillas distintas; la verdad la da el generador):

| Medida | Resultado (600 hogares, 1.000 trayectorias) |
|---|---|
| Cobertura de la banda P10-P90 a los días 7 / 14 / 21 | **92,7 % / 87,0 % / 93,5 %** (nominal 80 %: la banda es algo conservadora por la discretización a días) |
| Probabilidad media de cruzar el suelo | **0,225** frente a una frecuencia real de **0,247** (dentro del ruido: ≈ 1,2 errores típicos) |
| Contraste: la previsión actual (todo lo desconocido el día 8, como cierto) | Afirma que cruza el suelo en el **100 %** de los meses; en realidad cruza en el **25 %**. Su «banda» (una línea) cubre solo el 6-35 % de la realidad |

Lectura: el motor está **calibrado en su propio terreno** (cuando la distribución de fechas es la que supone). La prueba no demuestra que la ventana 1-28 sea la del hogar real; eso lo dirá su histórico. Las pruebas fijan los umbrales con estas medidas (`tests/wp16-banda-caja.test.cjs`, 250 hogares): cobertura entre 78 % y 97 %, probabilidad media a menos de 0,07 de la frecuencia real, y que el modelo «todo el día 8» dé una alarma casi segura que no se da.

## 5. Lo que la tarjeta dice de sí misma

- **«La banda es ancha»** cuando ≥ 70 % de lo que se mueve (por importe) tiene fecha estimada: el mismo umbral que el medidor de calidad (WP-10). Con la demo, el 100 %: dice cuánto puede variar la caja, pero poco en qué día.
- **«Solo recoge la incertidumbre de las fechas»**: no cubre un gasto que salga más caro.
- **«Los saldos son calculados, no declarados»** si el modo no es «Real manual».
- **Sin suelo declarado** no afirma ningún cruce.

## 6. Pendiente

| Qué | Cuándo |
|---|---|
| Ventana **aprendida** por partida (WP-04/WP-08) en lugar de 1-28, y los cargos a ±1 día (`casi-fijo`) como ventana de 3 días en vez de día cierto | Cuando el hogar dé de alta días de cargo (H-08, 13/11); medir con el hogar sintético |
| Dispersión de **importes** (`amountSd`) por partida, desde el error medio medido (PVC13) | Con ≥ 3 cierres |
| Una línea en Hoy («3 de cada 10 trayectorias bajan del suelo…») | **Solo tras H1** (la prueba cronometrada de Hoy del 9/10): no se toca Hoy sin línea base |
| Medir con datos reales: ¿la banda informa o es siempre ancha? | Tras el cierre del 1-3/11 y los días de cargo |
| Decisión: dar la **mediana** (P50) como titular en vez del plan | Tras ver la banda con datos reales |

## 7. Cómo se prueba

- `tests/wp16-banda-caja.test.cjs` (24): sin dato = no calculable, línea cuando todo es cierto, probabilidad = fracción de la ventana, ventana propia, eventos anteriores al saldo, traspasos e importes nulos, orden dentro del día, sin suelo, `amountSd`, gasto repartido, determinismo, límites, percentiles, frase, **calibración (3 pruebas con el hogar sintético)** y cableado.
- `tests/wp28-kit-graficos.test.cjs`: la línea de umbral del kit.
- `tests/qa1-flujos-completos.spec.cjs`: la tarjeta en 1280 y 390 px con teclado, frase, suelo visible, tabla de 31 filas y que no se repinta sola.
