# WP-31 · Nóminas y retenciones — diseño

Paquete del plan definitivo (CAP-05 + NPV-11, Ola 2, ≈ 4 sesiones). **PR-1 construido el 8/10/2026**, sin dependencias del hogar. El plan lo describía como «lector de PDF» y pedía antes **decidir el lector** (librería, tamaño, licencia) y preparar nóminas sintéticas. Esa decisión está tomada aquí, y cambia el orden del trabajo.

## 1. Qué problema resuelve y qué valor tiene cada parte

El estimador de Renta (`estimateIrpfResult`) recibe las retenciones **tecleadas** («Retenciones y pagos a cuenta ya realizados»). WP-31 pretendía que no se tecleen, y que el hogar se entere si la empresa cambia el % de retención.

Separando las dos mitades, el valor está casi todo en la primera:

| Parte | Valor | Coste |
|---|---|---|
| **Registro de nóminas** (seis cifras al mes) → retenciones acumuladas del año, meses que faltan, aviso de cambio del % | Es lo que alimenta la Renta (WP-21) y a WP-23 (% de retención y bruto anual por persona) | Ninguno de dependencias |
| **Leer el PDF** para no teclear esas cifras | Ahorra ≈ 1 minuto al mes por nómina (el plan estima −5 min/mes) | Una librería de terceros en el origen donde viven los datos más sensibles del hogar |

**PR-1 entrega la primera parte entera y el único tramo de la segunda que es puro: el parseo del texto.** El PDF solo aportaría el texto.

## 2. Decisión sobre el lector de PDF: aplazada, con números

Se midió `pdfjs-dist` 4.10.38 (Apache-2.0): **353 KB** de biblioteca + **1,38 MB** de *worker* minificados (≈ 100 KB + 400 KB comprimidos) = ≈ 1,7 MB. Alternativas: `unpdf` (MIT, ≈ 2 MB empaquetado) y el OCR de A17-3 (Tesseract, ya cargado bajo demanda desde jsDelivr con huella SRI).

Razones para no meterlo ahora:

1. **El riesgo no compensa el ahorro.** Una nómina contiene sueldo, NIF, nº de afiliación e IBAN. Cargar código de terceros en ese origen es justo la amenaza nº 2 de `docs/NTC06_AMENAZAS.md`. Con la biblioteca *vendida* en el repositorio el riesgo baja, pero el repositorio crece 1,7 MB, entra en la caché sin conexión (ARQ-5) y todo cambio de versión es una revisión de seguridad. Con CDN, el *worker* no puede llevar huella SRI.
2. **No hay muestras reales.** Cada pagador tiene su formato; sin una nómina real (editada) no se puede afirmar que el lector funcione. Las plantillas del parseo están probadas con textos **inventados** en tres disposiciones.
3. **El hogar no ha tenido que teclear nada todavía.** Antes de pagar 1,7 MB hay que ver si seis cifras al mes molestan.

**Criterio para retomarlo (PR-2):** que el hogar use PR-1 durante dos nóminas y diga que teclear le cuesta, y que aporte el texto de una nómina real con las cifras cambiadas. Entonces: biblioteca *vendida* y no CDN, cargada solo al pulsar, con revisión de NTC-06.

## 3. Lo que se entrega (PR-1)

Tarjeta **Herramientas avanzadas › Fiscal › «Nóminas y retenciones»** (`nominas-ui.js`; motor puro `canonical-payroll.js`), justo encima del estimador de Renta. Almacén `payslips` (en la copia y la nube).

- **Formulario de seis cifras**: titular, mes, pagador (opcional), tipo (ordinaria o paga extra), bruto, líquido, retención en % **o** en euros (si falta una, se calcula de la otra y se marca como calculada) y cotización del trabajador (opcional). Una nómina del mismo titular, pagador, mes y tipo **sustituye** a la anterior; una paga extra del mismo mes es otra nómina.
- **Retenciones acumuladas del año por titular**, con el % efectivo y un botón **«Usar X € en el estimador de Renta»** que rellena el campo del estimador. No lo rellena solo: el hogar decide. Entre enero y junio se mira el año anterior (campaña de la Renta); el resto del año, el actual.
- **Meses que faltan** («marzo, mayo a diciembre de 2025»): un año ya cerrado se espera entero y el año en curso, hasta la última nómina ordinaria. Si faltan nóminas, el acumulado **se dice corto** al usarlo.
- **Aviso de cambio del %**: entre las dos últimas nóminas **ordinarias** del mismo titular y pagador, a partir de **0,5 puntos** («La retención bajó del 15,32 % al 13,1 % en la nómina de abril de 2026»). Una paga extra tributa a otro tipo y otro pagador es otra serie: ninguna se compara. Cruza el cambio de año (diciembre → enero).
- **Lector de texto (opcional)**: se pega el texto de la nómina; la app lee **solo el mes y los importes** (bruto, líquido, % y euros de IRPF, cotización), rellena el formulario y **borra lo pegado**. No guarda nada hasta que el hogar pulsa «Guardar». Lo que no encuentra queda vacío y se dice; un líquido mayor que el bruto o un % absurdo se descartan con aviso. Distingue «Base IRPF» de la retención y «prorrata de pagas extra» de una paga extra.

## 4. Lo que NO hace y por qué

- **No guarda ni lee PDF.** Ni NIF, afiliación, IBAN ni el texto pegado: la prueba de navegador comprueba que el almacén solo contiene cifras.
- **No crea el ingreso real en el plan.** El plan lo pedía («crea el ingreso real»). Se deja fuera a propósito: exige saber a qué partida de ingresos del plan corresponde cada pagador (dato del hogar) y **WP-14 ya pregunta «¿Ha llegado la nómina?» en la bandeja con un toque** y escribe ese real. Hacerlo desde la nómina duplicaría el camino y arriesga contar dos veces. Cuando exista el mapeo pagador → partida (PR-2), el líquido de la nómina puede **prerrellenar** esa respuesta.
- **No toca Hoy** (regla «Hoy congelado hasta leer H-02»): el aviso de cambio del % vive en la tarjeta, no en la bandeja de Hoy.
- **No proyecta el año.** Suma lo registrado. La proyección (última nómina × meses que quedan) queda para WP-23 PR-2, que necesita además los datos fiscales del hogar (H-03).
- **No sabe si la retención es correcta.** Dice cuánto se ha retenido y si cambió; no si el tipo es el que toca.

## 5. Decisiones que conviene cuestionar

1. **«Dato ausente no es cero»**: una nómina sin retención no entra (ni como 0). Una retención de 0 *escrita* sí es un dato.
2. **El % efectivo (retenido/bruto) no es el tipo de la nómina.** El tipo se aplica sobre una base que puede excluir conceptos exentos; la tarjeta enseña el efectivo y avisa si la retención en euros no coincide con el % × bruto (tolerancia 2 €), sin bloquear.
3. **Importes con coma o punto**: `2.100` se lee como 2100 (miles) y `1644.93` como 1644,93; cualquier otra mezcla se rechaza antes que adivinarla.
4. **Titular de texto libre** (con sugerencias de los ya usados) en vez de una lista fija: el hogar tributa por separado (decisión del 3/10) pero WP-23 usa «Persona A/B» hasta tener sus datos; el texto libre no obliga a elegir hoy.
5. **El año por defecto** (anterior hasta junio) puede sorprender en enero-junio si solo hay nóminas del año nuevo: en ese caso se elige el año que tiene datos.

## 6. Riesgos y huecos

- El parseo del texto está probado con nóminas **inventadas**; con una nómina real puede fallar. Por eso nunca guarda por sí solo y lo que no encuentra queda vacío.
- Los datos salariales entran en la copia y la sincronización como el resto del estado (cifras, no documentos). Si el hogar prefiere que no salgan del móvil, se saca el almacén de la lista (decisión suya).
- PR-2 (PDF + mapeo pagador → partida + proyección) espera a la señal de §2.
