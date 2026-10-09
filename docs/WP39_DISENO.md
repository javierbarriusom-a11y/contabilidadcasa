# WP-39 · Política de inversión del hogar — diseño

Paquete del plan definitivo (CAR-01, Ola 3, ≈ 2,5 sesiones). **Primera entrega el 9/10/2026**, sin dependencias del hogar para construirla. Estado: **en curso**. Está hecho el documento, su firma y la comparación de la cartera con él; **no** está hecho lo que el plan pide para cerrarlo: que **cada operación** pase por la política y deje nota de motivo (§3). Por eso cuenta al 50 %, no como «hecho».

## 1. Qué hace

La tarjeta **«Política de inversión del hogar»**, al principio de **Inversión › Rebalanceo** (`politica-ui.js`, `politica.css`; motor puro `canonical-investment-policy.js`; almacén `investment-policy`, en la copia). Seis preguntas en lenguaje llano, en un formulario de una pantalla:

1. **¿Para qué es este dinero y para cuándo?** (texto y años; el horizonte se prerrellena con el objetivo declarado más lejano).
2. **¿Cómo repartimos y cuándo rebalanceamos?** Reparto objetivo por tipo (**prerrellenado con el que ya fijaste en Rebalanceo**, con un contador en vivo de que suma 100 %), banda de desvío (10 puntos por defecto: el umbral que ya usa IV6) y «rebalancear primero con aportaciones, sin vender».
3. **¿Cómo aportamos?** Una cantidad fija, lo que sobre tras el colchón, o sin aportación regular.
4. **¿Qué no compramos?** Sin apalancamiento, sin cripto y un texto libre. Si hay un préstamo declarado con la cartera como garantía, avisa antes de marcar «sin apalancamiento» de que la política nacería incumplida.
5. **¿Qué hacemos si la cartera cae un 20 % y un 35 %?** Cuatro respuestas: no vender y esperar · seguir aportando sin vender · rebalancear solo comprando · hablarlo las dos personas antes de tocar nada. **Por defecto, la más prudente (hablarlo)**, no «no hacer nada».
6. **¿Cuándo la revisamos, y quién la firma?** Cada 6, 12 o 24 meses; dos nombres distintos; la fecha es la de hoy.

Una vez firmada, la tarjeta muestra:

- **Las reglas numeradas** («Regla 4. No compramos cripto»), que es a lo que se refieren los avisos.
- **Estado de la firma** (firmada / cambiada después de firmar / borrador / incompleto, con qué pregunta falta) y **«Revisar la política: vence pronto»** a 30 días de la revisión, o vencida.
- **La cartera de hoy frente a la política:** tipos fuera de banda, cripto si no se compra, préstamo si no se admite apalancamiento, cada uno con su regla.
- **«¿Esta operación cumple la política?»:** compra o venta, tipo, importe y, si se sabe, la caída de la cartera. Dice «contradice», «ojo», «no choca con ninguna regla que la app pueda comprobar» o «no se puede comprobar», con la regla.
- «Imprimir una página» (solo la tarjeta) y «Borrar» con «Deshacer».

**Nunca opera** (A11-4): no compra, vende ni rebalancea, y **no escribe** en la cartera ni en el reparto objetivo (una prueba lo impide): solo los lee.

## 2. Reglas que el motor hace cumplir (con prueba)

- **Una pregunta sin responder no se rellena sola:** la política queda incompleta, dice qué pregunta falta y no se puede firmar. Un reparto que no suma 100 % tampoco.
- **«Sin datos» no se lee como «cumple».** Sin cartera registrada, la comparación dice que no hay nada que comparar «y que eso no significa que cumpla»; la comprobación de una operación sin cartera no declara «cumple».
- **«No vender por caídas» se vigila con la caída real, o dice que no la sabe.** Con una caída ≥ 20 % o ≥ 35 %, vender contradice la regla elegida si esa regla dice «sin vender» (las tres primeras); si dice «hablarlo antes», avisa. **Sin dato de caída, avisa** en vez de callar. Con una caída del 40 % manda la regla del 35 %.
- **Comprar lo prohibido contradice.** Una compra o venta que **aleja** un tipo del objetivo y lo deja fuera de banda avisa; una que lo **acerca**, no (comprar lo que falta no es un aviso).
- **La firma tiene huella:** dos personas distintas y fecha; si cambia cualquier respuesta después de firmar, «cambiada» y la revisión deja de contarse (no se inventa una fecha de vencimiento sin firma vigente). Seis meses desde el 31 de agosto vencen el 28 de febrero, no el 3 de marzo.

## 3. Dónde se aparta del plan, y por qué

| El plan decía | Lo entregado | Por qué |
|---|---|---|
| «La app avisa cuando una operación la contradice» y «cero operaciones contrarias sin una nota de motivo» | Una **consulta voluntaria** («Comprobar») y la comparación de la cartera. **Ningún aviso sale solo al registrar una compra o venta, ni se guarda una nota de motivo** | Engancharlo a los formularios de alta y venta cambia un flujo que funciona y puede bloquearlo. Es el segundo PR natural, y con él se podría medir el criterio de éxito. **Hoy el criterio no se mide** |
| Valores prerrellenados desde «objetivos E15, umbral INV2, convicción I12 y desapalancamiento LEV11» | Se prerrellenan **el reparto objetivo, el horizonte (desde los objetivos) y la banda por defecto (10)**. **No** se prerrellenan la convicción por posición (I12) ni el desapalancamiento (LEV11) | Son datos por posición o de un préstamo, no preguntas de política; lo único que se lee de LEV11 es si hay préstamo declarado, para señalar el choque con «sin apalancamiento» |
| «Alimenta la siguiente mejor acción de WP-17» | Las reglas están numeradas y estructuradas para que WP-17 las lea, pero **WP-17 no existe todavía** | Es un paquete aparte |
| Vista final imprimible | «Imprimir una página» con una hoja de impresión que deja solo la tarjeta | La regla de impresión se ha comprobado en pantalla emulando el medio `print`, no en una impresora |

## 4. Riesgos y decisiones a cuestionar

1. **La banda de la política no gobierna todavía la herramienta de rebalanceo.** Esa herramienta (IV6) avisa con su propio umbral de 10 puntos. Si el hogar pone una banda de 5, la tarjeta de la política dirá «fuera de banda» y la de abajo, no. La pantalla lo dice. Unificarlo cambiaría el comportamiento de una herramienta existente; queda para un PR con decisión del hogar.
2. **«No vender por caídas» depende de que se teclee la caída.** La app tiene valoraciones por cierre (WP-15), pero hacen falta ≥ 3 y el cálculo de la caída desde el máximo es WP-44. Hasta entonces la regla más importante de la política se vigila a mano.
3. **«Sin apalancamiento» solo ve el préstamo con la cartera como garantía** (el Lombard declarado). Una hipoteca o un préstamo personal usados para invertir son invisibles.
4. **El horizonte se prerrellena con el objetivo declarado más lejano**, que puede no ser un objetivo de inversión (una hucha para un viaje no es la jubilación). Es un punto de partida, y se edita.
5. **La firma son dos nombres tecleados en un mismo dispositivo:** constancia, no prueba. Es la misma convención que el plan B (WP-38).
6. **Una política firmada no es una política seguida.** La app no comprueba la regla de aportación contra lo aportado de verdad, ni la cartera contra la política sin que alguien abra la pantalla (mismo hueco que el plan B: no avisa sola).
7. **El defecto «hablarlo antes de tocar nada» es una opinión mía**, no un dato: es lo menos dañino si el hogar se salta la pregunta, pero obliga a pararse, que es justo lo que buscaba el plan.

## 5. Pendiente

- Enganchar la comprobación a los formularios de compra y venta, con nota de motivo (cierra el criterio de éxito).
- Caída desde el máximo con las valoraciones (WP-44) para que «no vender por caídas» se vigile sola.
- Decidir si la banda de la política sustituye al umbral de 10 puntos de IV6.
- Que el hogar la escriba y firme (H-12, 18/12 según el plan).
- WP-17 leyendo estas reglas.
