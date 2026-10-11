# WP-50 · Vivienda y local por índice — diseño

Paquete del plan definitivo (CAR-04, Ola 3, ≈ 1,5 sesiones). **Primera entrega el 11/10/2026: solo el núcleo «a mano».** Estado: **en curso**. Está la revalorización con un índice **que teclea el hogar**, el chip «estimado por índice», el LTV con los dos valores y el interruptor al patrimonio; **no está la descarga automática del índice**, que es justo lo que le daba sentido a la propuesta (§3).

## 1. Qué hace

La tarjeta **«Vivienda y local por índice»** en **Inversión › Cartera**, sobre el patrimonio neto (`indice-vivienda-ui.js`, `indice-vivienda.css`; motor puro `canonical-index-valuation.js`; almacén `housing-index-data`, **en la copia de seguridad**).

1. **Series de índice tecleadas por el hogar** (hasta 6, hasta 80 trimestres cada una): nombre («IPV vivienda · Cataluña») y, por trimestre, el valor del índice (escrito como en España: «187,4»). Quitar un punto o una serie **se deshace**.
2. **Por cada activo de tipo «inmueble»** (la vivienda y el local son los dos que ya existen en Ajustes › Patrimonio): se elige la serie y sale **la estimación al último trimestre con índice** = valor declarado × índice del último trimestre ÷ índice del trimestre de la declaración, con el chip **«estimado por índice · T2 2026»**, la diferencia frente a lo declarado y una frase («sube un 9,09 % desde T2 2025…»). Si el último índice queda a más de dos trimestres del actual, **avisa de que la estimación envejece**.
3. **Interruptor por inmueble, apagado por defecto**: «Usar la estimación en el patrimonio y en el LTV». Solo con él activado **y** la estimación calculable, el valor estimado sustituye al declarado al **leer** (`assetsEffectiveList`): en el patrimonio neto de A14 (Ajustes), en la tarjeta de Patrimonio neto de WP-46 (que además dice «Incluye N inmueble con valor estimado por índice, +X € frente a lo declarado») y en la exposición a vivienda (IVX8). **El valor declarado no se modifica nunca ni se guarda otro.**
4. **LTV** = hipoteca pendiente (los contratos de Deuda cuyo tipo o entidad dice «hipoteca») ÷ suma de los inmuebles, **con el valor declarado y con el estimado**.

## 2. Reglas del motor, con prueba (`tests/wp50-indice-vivienda.test.cjs`, 12 pruebas)

- **Caso de oro a mano:** 300.000 € declarados en T2 2025 con el índice 165 → **327.272,73 €** con el 180 de T2 2026 (+9,09 %); 200.000 € en T1 2024 con el 150 → 240.000 € (+20 %); un índice que baja (200 → 190) da −5 %.
- **Sin el índice del trimestre de la declaración NO se inventa nada**: ni se interpola, ni se usa el trimestre más cercano. Sin ningún trimestre posterior (el último es el de la declaración o anterior): «declarado vigente». Sin valor, sin fecha o sin serie: se queda lo declarado. **Un valor ausente sigue ausente** (no es cero) y un valor 0 no se revaloriza.
- **El almacén se normaliza sin romper** (copias antiguas, basura): puntos no válidos fuera, uno por trimestre (gana el último), orden, máximo 6 series, vínculos a series que no existen fuera, solo `useEstimate === true` activa.
- **Alta, edición y baja** con validación (nombre vacío o repetido, trimestre inexistente, índice no positivo o vacío); **quitar una serie desvincula** los inmuebles que la usaban.
- **`effectiveAssets`:** solo los inmuebles con la estimación activada y calculable llevan el valor estimado (procedencia «estimated»); el resto, intacto; la entrada no se modifica (congelada).
- **LTV:** 150.000 ÷ 300.000 = 50 %; con 327.272,73 € → 45,83 %; **una hipoteca pagada es un 0 % real**, una deuda desconocida no es cero.
- **Propiedad (300 casos):** con el mismo índice no cambia nada; el valor escala con el cociente (±1 céntimo); un índice mayor nunca da un valor menor; determinista. Motor puro: sin DOM, red, almacenamiento ni reloj.

## 3. Dónde se aparta del plan, y por qué

| El plan decía | Lo entregado | Por qué |
|---|---|---|
| «Revalorización trimestral desde el último valor declarado con un índice público» (la propuesta: «**nadie lo actualiza**», A14-3 es a mano) | **El hogar teclea el índice** cada trimestre | **Es la desviación que más cuesta: sigue siendo trabajo manual**, aunque más ligero (un número por serie y trimestre, en vez de volver a tasar). La descarga automática no se ha construido: ver las dos filas siguientes |
| «*Verificar* fuente accesible y CORS» | **No verificado** | Desde el entorno de desarrollo **no hay salida hacia el INE** (la conexión se rechaza): no he podido comprobar ni que la API responda ni que permita CORS desde la web publicada. **No afirmo que funcione** |
| «Si no, vía función privada tras WP-05» | **No construido** | El plan pone como condición que **«ninguna conexión externa» pase la revisión de WP-05** (`docs/NTC06_AMENAZAS.md`: servidor nuevo = fila nueva, CSP con `connect-src`, interruptor de apagado, RQ-12 antes de enlazar), y **WP-05 se decide el 16/10**. Una conexión desde el navegador a un tercero es justo lo que esa regla frena. Meter datos del INE **fijados en el código** tampoco: no puedo verificarlos y un índice inventado sería peor que ninguno |
| «Alimenta LTV y patrimonio» | **Alimenta el patrimonio (A14, WP-46) y la exposición a vivienda, solo si se activa por inmueble; el LTV lo calcula la propia tarjeta** con los dos valores | El LTV de la vivienda **no existía en la app** (el LTV que hay es el de la cartera, Lombard). Un LTV «oficial» necesitaría saber qué hipoteca es de qué inmueble, que la app no sabe. Y que una estimación cambie el patrimonio **sin que nadie lo decida** sería meter una cifra no declarada en un número que se firma |

## 4. Decisiones mías y riesgos a cuestionar

1. **El valor de la tarjeta depende de que alguien teclee el índice cada trimestre.** Si no se hace, la estimación envejece (se avisa a los dos trimestres) y, a la larga, el modo «a mano» es un A14-3 con otra forma. **Si el hogar no va a teclear un número cada trimestre, este paquete no sirve y hay que esperar a WP-05.**
2. **Un índice agregado no es una tasación.** Una comunidad autónoma entera no es vuestro barrio, ni un local es una vivienda (el IPV del INE es de **vivienda**: para el local hace falta otra serie, y puede no existir). La cifra se rotula siempre «estimado»; **el banco usa su propia tasación para el LTV**.
3. **El interruptor apagado por defecto** es mío: la propuesta pedía que «alimente» el patrimonio sin más. Mantiene el patrimonio firmado como hasta ahora salvo que se decida.
4. **Al firmar un cierre, la foto del patrimonio (WP-46) congela el valor que estuviera activo** (declarado o estimado) y **no marca cuál era**: una serie con la estimación a veces activada y a veces no tiene saltos que no son del mercado. Sin remedio sencillo: se dice en la tarjeta.
5. **La hipoteca se detecta por la palabra «hipoteca»** en el tipo o la entidad del contrato y se compara con **todos** los inmuebles juntos. Con dos inmuebles y una hipoteca, el LTV de cada uno no se conoce. Si un contrato de hipoteca no tiene saldo pendiente, el LTV queda corto (se dice).
6. **Con varias series, el vínculo es manual** inmueble a serie: nada impide enlazar la vivienda con una serie de otra comunidad.
7. **Quitar un punto del trimestre de la declaración** deja sin estimación a quien lo usaba (se ve en pantalla y se deshace durante 10 s).
8. **El texto de la fuente («IPV del INE por comunidad autónoma») es de memoria y está marcado «a verificar»**: no he podido comprobarlo.
9. **No está en Hoy** (congelado hasta H-02) ni en la carta del mes.

## 5. Pendiente

- **La descarga automática del índice**, tras la revisión de WP-05 (el 16/10) y verificando fuente y CORS: servidor nuevo en la tabla de `NTC06_AMENAZAS.md`, CSP, interruptor de apagado y, si el INE no permite CORS, función privada.
- Marcar en la foto del patrimonio si lleva estimaciones; el LTV por inmueble cuando se pueda vincular cada hipoteca; índice específico para locales; avisar cada trimestre de que toca teclear el índice (recordatorios, WP-32).
- **Del hogar:** decir si va a teclear el índice cada trimestre (o si prefiere esperar a la descarga automática) y, si sí, qué serie usar para la vivienda y para el local.
