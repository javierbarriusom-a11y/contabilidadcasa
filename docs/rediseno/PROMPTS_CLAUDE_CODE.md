# Prompts para Claude Code · rediseño (versión 2, 19/10/2026)

Sustituye a la versión del 17/10. Las fases A1, A2, A1b y A3 ya están hechas (PR #514 a #517); los prompts de abajo
empiezan donde se quedó el trabajo. Pega **uno cada vez**, en orden, y no pases al siguiente hasta que su PR esté
fusionado y lo hayas visto en `https://javierbarriusom-a11y.github.io/contabilidadcasa/?tema=v2`.

Todos empiezan igual a propósito: así no dependen de la memoria de la sesión anterior.

---

## Prompt 0 · Ponerse al día (no toca código)

```
Lee CLAUDE.md, después docs/rediseno/ESTADO.md entero (manda sobre el resto), docs/rediseno/HANDOFF.md y
docs/PROPUESTA_SEPTIMA_AUDITORIA_2026-10-17.md (secciones 1 a 4). Mira las entradas 317 a 320 de PROJECT_STATE.md
y los ficheros tema-v2.css, tema-v2.js y views/hoy-v2.js para ver cómo se hicieron las fases ya publicadas.

No cambies nada. Devuélveme:
1. En tus palabras, las decisiones vigentes del §3 de ESTADO.md y las desviaciones del §4.
2. Si ves alguna contradicción entre ESTADO.md, HANDOFF.md, la auditoría y el código.
3. Cuántas líneas le quedan a app.js frente al techo del CI.
4. Tu plan para los pasos 1 a 4 del §8 de ESTADO.md, con el tamaño de cada PR.
```

## Prompt 1 · El cobro caducado (tarea de datos, no de diseño)

```
Lee docs/rediseno/ESTADO.md §6. Rama datos/cobro-caducado.
1. Confirma o descarta la hipótesis: ¿la tarjeta «Hasta el siguiente ingreso» dice «0 días · hasta 31 ago · Dato
   observado» porque hay un ajuste manual guardado en scenarioSettings.e6Coverage (nextIncomeDate y/o dailyOutflow)?
   Enséñame cómo lo has comprobado. No uses ni copies cifras reales del hogar en el código, las pruebas ni los PR.
2. Si se confirma: un nextIncomeDate manual anterior a la fecha de saldos deja de aplicarse (se usa lo que diga el
   calendario) y la tarjeta avisa «Tu fecha de cobro manual caducó el dd/mm: ponla al día», con un botón que abre su
   editor. No toques canonical-daily-engine.js ni ningún otro canonical-*.
3. Prueba nueva y npm run verify en verde. PROJECT_STATE.md con cifras reales de la validación. PR, y fusión con el
   CI en verde, como dice CLAUDE.md.
```

## Prompt 2 · Desalojo de app.js (XGO-01, fase 0 del handoff)

```
Lee docs/rediseno/ESTADO.md §4 y §8 y HANDOFF.md §0 y §6. Rama rediseno/fase-0-desalojo.
Saca de app.js a módulos (views/*.js o el patrón de módulos que ya use el repo) unas 3.000 líneas, empezando por los
bloques más grandes y autocontenidos, sin ningún cambio visible ni de comportamiento.
Comprueba que los ficheros nuevos están en tools/build-public-site.mjs (una entrada por línea, terminada en ",) y en
service-worker.js. npm run verify y las e2e en verde, con las mismas cifras que antes. PR con líneas de app.js antes
y después y la lista de módulos.
```

## Prompt 3 · Laboratorio con el tema v2 como primer interruptor (XGO-03)

```
Lee docs/rediseno/ESTADO.md §4 (fila de los flags) y la ficha XGO-03 de docs/PROPUESTA_SEPTIMA_AUDITORIA_2026-10-17.md.
Rama rediseno/laboratorio.
1. Ajustes › Laboratorio: lista de interruptores, todos apagados por defecto, con role="switch", su métrica y su
   fecha de revisión.
2. Primer interruptor: «Diseño nuevo (v2)». Encenderlo equivale a ?tema=v2. Los enlaces con ?tema=v2 y ?tema=clasico
   siguen funcionando y mueven el interruptor. Respeta que el script en línea de <head> solo lee (prueba t7) y que no
   puede haber cargadores dinámicos de scripts nuevos (tests/ntc6-conexiones-externas.test.cjs).
3. Pruebas, npm run verify, PROJECT_STATE.md, PR y fusión con el CI en verde.
```

## Prompt 4 · A4 · Movimientos e Importar

```
Lee docs/rediseno/ESTADO.md (todo), HANDOFF.md §5 «B3 · Movimientos», «E1 · Importar» y §5b, y reproduce
docs/rediseno/referencias/png/Movimientos.png, MovimientosDesktop.png, Importar.png e ImportarDesktop.png, con los
valores exactos de referencias/html/. Copia el diseño, nunca las cifras. Rama rediseno/fase-a4-movimientos, detrás del
interruptor del tema v2, siguiendo el patrón de A3 (views/*-v2.js, contenedor oculto, la vista antigua sigue entera
detrás de «Ver todo el detalle», estilos en tema-v2.css colgando de :root[data-tema="v2"]).
- Reutiliza la importación, los perfiles de extracto, el control de duplicados y las reglas que ya existen. No toques
  ningún canonical-*.
- Importar en 3 pasos: elegir fichero, revisar (con cuadre: saldo inicial + movimientos = saldo final; si no cuadra,
  no se importa) y confirmar con deshacer.
- Con 0 movimientos, la pantalla no puede parecer rota: un solo bloque que lleva a Importar.
- Lo que dependa de funciones aún no construidas (buzón por Compartir XDA-02, PDF XDA-03, cobertura XDA-04): plegado
  en una línea y dímelo en el PR; no lo construyas en esta fase.
- Decisiones del §3 de ESTADO.md: verde sólido solo en acciones, conclusiones en tarjeta clara, máximo una acción
  principal por bloque, cifras con money().
Prueba tests/redis-a4-*.test.cjs, capturas 390×844 y 1440×900 en claro y oscuro junto a la referencia,
npm run verify y e2e en verde, PROJECT_STATE.md y ESTADO.md §2 actualizados. PR y fusión con el CI en verde.
```

## Prompt 5 · A5 · Clasificar

```
Igual que el prompt 4, para HANDOFF.md §5 «B4 · Clasificar por lotes» y referencias/png/Clasificar.png: hoja
inferior en móvil, panel lateral derecho en escritorio, grupos por comercio, como mucho 5 seguidos, deshacer en cada
regla. Rama rediseno/fase-a5-clasificar. Si el motor de reglas no da la confianza por grupo, píntala plegada y
ábreme una tarea aparte.
```

## Siguientes (preparar cuando lleguemos)

Plan (C1-C2), Cierre (C3), Patrimonio e Inversión (D1-D2), navegación de 5 destinos, Deuda (D3, solo tras NTC-05),
Taller (D4) y E2. El prompt de cada una sale de la conversación de diseño y se añade aquí.

---

## Revisión de cada PR (tú, 5 minutos)

- Abre las capturas del PR junto a la PNG de referencia. Si falta algo: `Compara tu captura con
  docs/rediseno/referencias/png/X.png y corrige espaciado, color y jerarquía.`
- Con `?tema=clasico` la app debe estar exactamente como antes.
- ¿Algún botón de conclusión en verde sólido, alguna tarjeta «Sin datos» o algún «0.9» con punto? Devuélvelo.
- Graduar una pantalla (quitar la vista antigua) solo tras dos semanas de uso sin problemas:
  `Gradúa <pantalla> v2: hazla la vista por defecto y elimina la antigua y su código.`
