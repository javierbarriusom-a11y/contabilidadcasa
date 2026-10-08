# WP-19 · Camino a deuda cero — diseño

Paquete del plan definitivo (NDB-01, Ola 3, ≈ 3,5 sesiones). Construido el 8/10/2026, **sin dependencias del hogar** y sin tocar Hoy (la regla «Hoy congelado hasta leer H-02» sigue en pie).

## 1. La pregunta

«¿Cuándo acabamos y qué cambia con 200 € más?» en menos de 30 segundos. Hasta ahora Deuda › Ruta contestaba con estrategias completas (avalancha, bola de nieve, consolidar) y calendarios, pero no tenía **un control sencillo de «extra al mes»**.

## 2. Lo que se entrega

Una tarjeta al principio de **Deuda › Ruta** (`camino-deuda-ui.js`; motor puro en `canonical-debt-payoff-path.js`). No borra ni sustituye nada de lo de debajo.

| Qué | Cómo |
|---|---|
| **Un solo control** | «Extra al mes (€)» con caja numérica y deslizador sincronizados. Se recalcula al instante (≈ 0,2 ms por cálculo, medido); por eso no hay estado «recalculando» |
| **Tres cifras** | Libre de deuda (mes y duración) · cuota total al mes (suma de cuotas + extra) · intereses pendientes (y cuánto menos que sin extra) |
| **Una frase** | «Con 200 € más al mes acabáis 14 meses antes (… en vez de …) y pagáis X € menos de intereses. El extra iría primero a …» |
| **Cada 100 €** | «Cada 100 € más al mes (frente a no poner extra): N meses menos y X € menos de intereses. Iría primero a …» |
| **Hitos** | Cuándo acaba cada deuda, con «Hoy» como marca y, con extra, la fecha que tendría sin él |
| **Lo que no entra** | Las deudas sin cuota activa o sin TAE ni plazo salen de la cuenta **y se listan con su capital**; si hay alguna, la cifra se titula «Libre de las deudas con cuota», nunca «Libre de deuda» a secas |

## 3. Qué calcula y qué no

- **Capital, cuota y TAE declarados** de cada contrato (`escenarioMotorDebtOptions`), con el mismo cálculo de interés (TAE/12) que el calendario de amortización de Ruta. Prueba de navegador: con extra 0, intereses y meses de un préstamo coinciden con `debtAmortizationSchedule` al céntimo.
- **El extra va a una deuda cada vez.** Orden de ataque: el de **DEB5** (TAE efectivo tras la deducción fiscal) si se puede calcular; si no, TAE nominal. Al saldar la primera, el mismo extra pasa a la siguiente.
- **Las cuotas liberadas NO se redirigen.** Es una convención deliberada y conservadora: con ella, «extra 0» es exactamente el calendario actual y el efecto mostrado es el del extra y nada más. Si se redirigieran, 0 € y 1 € de extra darían resultados muy distintos y la cifra engañaría. La tarjeta lo dice.
- **Sin TAE pero con plazo** (p. ej. el plan reunificado): se **deduce** el tipo que explica su cuota y su plazo (bisección sobre la anualidad) y se marca «Sin TAE declarada… deducida». Si cuota × plazo no llega ni al capital, no hay tipo posible y la deuda sale de la cuenta.
- **Una cuota que no cubre el interés** no avanza: sin extra no hay fecha («alguna deuda no acaba en 50 años»); con extra suficiente, sí.
- **No incluye** comisiones por amortización anticipada ni cambios de tipo de las variables (WP-20 cubre la revisión de la hipoteca). No dice si el extra **cabe** en el margen del mes: eso es NDB-03 («¿me puedo permitir X?»), que el plan no deja construir antes de que el hogar lea con soltura la cifra de Hoy.

## 4. Lo que había que cuestionar

1. **«Sin matemática nueva» no era cierto.** El plan de la 5.ª auditoría decía que NDB-01 reutiliza los motores actuales. Se revisaron: el motor de escenarios resuelve **decisiones sueltas de amortización** (importe único o fraccionado en un mes), no un extra mensual repartido por orden de ataque, y `debtAmortizationSchedule` calcula una deuda cada vez. Hacía falta una cascada mes a mes. Es pequeña (≈ 150 líneas, puro, con 14 pruebas, una de ellas la recursión del saldo hecha a mano), pero es matemática nueva y se declara.
2. **Dos fechas para la misma pregunta.** Hoy y el título de Ruta cuentan **el plazo declarado** (`remainingInstallments`); esta tarjeta, **capital, cuota y TAE**. Si los datos son coherentes difieren en 0-2 meses por el redondeo de la última cuota. En vez de esconderlo, la tarjeta **avisa cuando la diferencia pasa de 2 meses** («Dos fechas distintas…») y cuando el plazo declarado de un contrato no cuadra con el calculado («Los datos no cuadran entre sí»). El desajuste se mide contra el calendario **sin extra**: acortar el plazo a propósito no es un dato incoherente.
3. **El titular podía mentir por omisión.** Con los contratos de ejemplo, 6.000 € de 12.000 € no tienen cuota activa. Un «Libre de deuda: octubre de 2028» a secas habría sido falso. De ahí el título «Libre de las deudas con cuota» y la lista de lo excluido.
4. **No se guarda el extra.** Vive en memoria mientras la pantalla está abierta. Guardarlo exigiría decidir si es una preferencia (¿por persona?) o un plan, y entraría en la copia y en la nube (ARQ-6). Si el hogar quiere recordarlo, es un PR aparte.
5. **No se mueve el deslizador a ciegas.** Rango 0-1.000 € en pasos de 10; la caja numérica admite hasta 100.000 €. Es un límite de pantalla, no una recomendación: la app no sabe cuánto cabe.

## 5. Un fallo encontrado por el camino (arreglado en el mismo PR)

`homeDebtOutlook()` (la «Deuda pendiente» y el «Libre de deuda» de Hoy, Registrar y Plan) guardaba su resultado con la firma del modelo, que **no incluye los contratos**. Dar de alta, editar o quitar un contrato en Deuda › Contratos no la movía: Hoy seguía contando la deuda anterior hasta recargar. Reproducido en navegador antes de arreglarlo (esperado 17.000 €, recibido 12.000 €). La clave de la caché incluye ahora id, estado, capital, cuota, TAE y plazo de cada contrato activo (+2 líneas en `app.js`). No cambia ningún texto ni diseño de Hoy.

## 6. Riesgos y huecos

- La calidad de la cifra es la de los datos declarados: con contratos sin TAE ni plazo la tarjeta calcula menos y lo dice.
- Un contrato con TAE declarada pero cuota inferior al interés aparece como «no acaba solo»; es correcto, pero el hogar puede leerlo como un error del cálculo. Si ocurre, revisar el dato en Contratos.
- Pendiente de decisión del hogar (no bloquea): ¿se quiere que las cuotas liberadas se redirijan como opción? Sería un segundo control; el plan pide uno solo.
- La prueba de «< 30 s» (¿acaban y qué cambia con 200 € más?) no se ha medido con el hogar; solo se ha comprobado que la respuesta está en pantalla sin navegar.
