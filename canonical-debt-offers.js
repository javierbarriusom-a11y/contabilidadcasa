/**
 * canonical-debt-offers.js · TRE-D5a (decimotercera auditoría §2.5b; D-N44; «sí, sigue con Ofertas después de Contratos»).
 *
 * Una oferta es lo que os ofrece (o podéis pedir a) una entidad, medido contra vuestro plan con el mismo motor y la misma salida al
 * mes. Puro: no lee nada de la página. Tres tipos, cada uno traducido a lo que el plan óptimo ya sabe calcular (sin motor nuevo):
 *   - `quita`: «pagad X y cancelamos la deuda» → una quita del plan (`settlements`);
 *   - `traspaso`: pasar una deuda a otra tarjeta al 0 % unos meses → el mismo contrato con la comisión sumada al capital, la TAE de
 *     después y una promoción al 0 % hasta ese mes (`promotions`);
 *   - `reunificacion`: un préstamo nuevo que cancela todas → un único contrato con su cuota; si la cuota baja, la diferencia se pone de
 *     más (para comparar con la misma salida al mes, no con menos esfuerzo).
 * El veredicto compara intereses y comisiones (menos lo que os perdonan) del plan con la oferta frente al plan sin ella:
 * «Os compensa: X € menos» / «No os compensa: X € más» / «Casi igual» (menos de 25 €), con la fecha de cada uno.
 */
(function attachDebtOffers(root) {
  "use strict";

  const TIPOS = {
    quita: { nombre: "Quita", trampa: "Una quita deja huella en los ficheros de morosos y solo suele ofrecerse con la deuda ya en impago. Pedidla por escrito, con el importe, la fecha límite y que la entidad comunique la deuda como cancelada." },
    traspaso: { nombre: "Traspaso al 0 %", trampa: "Al acabar los meses al 0 % se aplica la TAE de después a lo que quede. Cancelad la tarjeta de origen: si se vuelve a usar, la deuda se duplica." },
    reunificacion: { nombre: "Reunificación", trampa: "Una cuota más baja suele venir con un plazo más largo y más intereses en total. La comisión de apertura se financia y paga intereses." },
  };
  const CASI_IGUAL = 25;

  const n = (v) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  };
  const r2 = (v) => Math.round(n(v) * 100) / 100;

  function sumarMeses(key, meses) {
    const [y, m] = String(key).split("-").map(Number);
    const i = y * 12 + (m - 1) + Math.max(0, Math.floor(meses));
    return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
  }

  /** Cuota de un préstamo francés: capital, TIN anual (%) y meses. */
  function cuotaPrestamo(capital, tinPct, meses) {
    const p = n(capital);
    const k = Math.max(1, Math.floor(n(meses)));
    const r = n(tinPct) / 1200;
    if (!(p > 0)) return 0;
    if (r === 0) return r2(p / k);
    return r2((p * r) / (1 - (1 + r) ** -k));
  }

  /**
   * Lo que cambia en el plan con la oferta. `contratos`: los del motor (escenarioMotorDebtOptions).
   * @returns {{ok:boolean, motivo?:string, contratos?:Array, settlements?:Array, promotions?:Array, extra?:number, comision?:number, quitaId?:string, cuota?:number, cuotasHoy?:number, saldos?:number}}
   */
  function aplicar(oferta, contratos = [], startMonthKey) {
    const vivos = contratos.filter((c) => n(c.currentPrincipal) > 0);
    if (oferta?.tipo === "quita") {
      const c = vivos.find((x) => String(x.id) === String(oferta.contratoId));
      if (!c) return { ok: false, motivo: "La deuda de esta quita ya no está viva." };
      if (!(n(oferta.importe) > 0)) return { ok: false, motivo: "Falta el importe de la quita." };
      return { ok: true, contratos: vivos, settlements: [{ id: String(c.id), amount: r2(oferta.importe) }], promotions: [], extra: 0, comision: 0, quitaId: String(c.id) };
    }
    if (oferta?.tipo === "traspaso") {
      const c = vivos.find((x) => String(x.id) === String(oferta.contratoId));
      if (!c) return { ok: false, motivo: "La deuda de este traspaso ya no está viva." };
      if (!(n(oferta.meses) > 0)) return { ok: false, motivo: "Faltan los meses al 0 %." };
      const comision = r2((n(c.currentPrincipal) * n(oferta.comisionPct)) / 100);
      const nuevo = { ...c, currentPrincipal: r2(n(c.currentPrincipal) + comision), apr: n(oferta.taeDespues) };
      return {
        ok: true,
        contratos: vivos.map((x) => (String(x.id) === String(c.id) ? nuevo : x)),
        settlements: [],
        promotions: [{ id: String(c.id), untilMonth: sumarMeses(startMonthKey, oferta.meses), aprPct: 0 }],
        extra: 0,
        comision,
      };
    }
    if (oferta?.tipo === "reunificacion") {
      if (vivos.length < 2) return { ok: false, motivo: "Con una sola deuda no hay nada que juntar." };
      if (!(n(oferta.plazo) > 0) || oferta.tin === null || oferta.tin === undefined || oferta.tin === "") return { ok: false, motivo: "Faltan el tipo o el plazo del préstamo." };
      const saldos = r2(vivos.reduce((s, c) => s + n(c.currentPrincipal), 0));
      const comision = r2(oferta.comision);
      const capital = r2(saldos + comision);
      const cuota = cuotaPrestamo(capital, oferta.tin, oferta.plazo);
      const cuotasHoy = r2(vivos.filter((c) => c.paymentStatus === "active").reduce((s, c) => s + n(c.currentPayment), 0));
      const prestamo = { id: "oferta-reunificacion", entity: oferta.entidad || "Préstamo nuevo", type: "Préstamo", label: oferta.entidad || "Préstamo nuevo", currentPrincipal: capital, currentPayment: cuota, apr: n(oferta.tin), remainingInstallments: Math.floor(n(oferta.plazo)), paymentStatus: "active" };
      return { ok: true, contratos: [prestamo], settlements: [], promotions: [], extra: Math.max(0, r2(cuotasHoy - cuota)), comision, cuota, cuotasHoy, saldos };
    }
    return { ok: false, motivo: "Tipo de oferta desconocido." };
  }

  /** Intereses y comisiones, menos lo que os perdonan: lo que se compara. */
  function coste(summary, comisionExtra = 0) {
    const s = summary || {};
    if (!Number.isFinite(s.totalInterest)) return null;
    return r2(s.totalInterest + n(s.commissionCost) + n(comisionExtra) - n(s.forgiven));
  }

  /**
   * @param {object} oferta
   * @param {object} e
   * @param {object} e.Plan canonical-debt-optimal-plan
   * @param {object} e.Path canonical-debt-payoff-path
   * @param {Array} e.contratos los del motor
   * @param {object} e.opciones las del plan de ahora (planOptimoCalcular().opciones)
   */
  /**
   * @param {any} oferta
   * @param {{Plan:any, Path:any, contratos?:Array<any>, opciones?:any, disponible?:number|null}} e
   */
  function veredicto(oferta, { Plan, Path, contratos = [], opciones = {}, disponible = null }) {
    const v = comparar(oferta, { Plan, Path, contratos, opciones });
    if (!v.ok || oferta?.tipo !== "quita") return v;
    // Una quita sin pago inicial obliga a juntar el importe con lo de cada mes, y mientras la deuda sigue con su cuota e intereses: a
    // menudo baja antes de llegar y no compensa. La pregunta del hogar es otra: ¿y pagándola de golpe con la caja? Se compara con la
    // misma salida de caja en los dos lados (el plan con ese pago inicial frente a ese pago para la quita).
    const golpe = comparar(oferta, { Plan, Path, contratos, opciones: { ...opciones, lump: n(opciones.lump) + n(oferta.importe) } });
    return { ...v, deGolpe: golpe.ok ? { ...golpe, alcanza: disponible === null ? null : n(disponible) >= n(oferta.importe), disponible } : null };
  }

  /**
   * La comparación de una oferta con el plan sin ella, con las opciones dadas.
   * @param {any} oferta
   * @param {{Plan:any, Path:any, contratos?:Array<any>, opciones?:any}} e
   */
  function comparar(oferta, { Plan, Path, contratos = [], opciones = {} }) {
    const start = opciones.startMonthKey;
    const a = aplicar(oferta, contratos, start);
    if (!a.ok) return { ok: false, motivo: a.motivo };
    // La base es el plan sin esta oferta: una quita que ya está en el plan se quita para compararla.
    const sinEsta = (opciones.settlements || []).filter((x) => !a.quitaId || String(x.id) !== a.quitaId);
    const base = Plan.plan(Path, contratos, { ...opciones, settlements: sinEsta });
    const conExtra = (o) => {
      if (!(a.extra > 0)) return o;
      return { ...o, monthly: n(o.monthly) + a.extra, monthlyByMonth: Array.isArray(o.monthlyByMonth) ? o.monthlyByMonth.map((v) => n(v) + a.extra) : o.monthlyByMonth };
    };
    // Las comisiones por amortizar y las promociones de los contratos que la reunificación cancela no aplican al préstamo nuevo.
    const conOferta = Plan.plan(Path, a.contratos, conExtra({
      ...opciones,
      settlements: [...sinEsta, ...a.settlements],
      promotions: [...(oferta.tipo === "reunificacion" ? [] : opciones.promotions || []), ...a.promotions],
      commissions: oferta.tipo === "reunificacion" ? [] : opciones.commissions,
      order: oferta.tipo === "reunificacion" ? undefined : opciones.order,
    }));
    if (!base?.ok || !conOferta?.ok || base.nothing || conOferta.nothing) return { ok: false, motivo: "No se puede calcular con estos datos." };
    const sb = base.recommended?.summary || {};
    const so = conOferta.recommended?.summary || {};
    const costeBase = coste(sb);
    const costeOferta = coste(so, a.comision);
    if (costeBase === null || costeOferta === null) return { ok: false, motivo: "Alguna deuda no acaba dentro del horizonte: no hay coste total que comparar." };
    const diferencia = r2(costeBase - costeOferta);
    const tono = Math.abs(diferencia) < CASI_IGUAL ? "igual" : diferencia > 0 ? "compensa" : "no";
    // Un traspaso que el plan salda antes de que acabe el 0 %: la TAE de después no llega a aplicarse (y cambiarla no mueve nada).
    const promoSaldada = oferta.tipo === "traspaso" && (conOferta.warnings || []).some((w) => w.id === "promocion" && w.saldada && String(w.deuda) === String(oferta.contratoId));
    return {
      ok: true,
      tono,
      diferencia,
      promoSaldada,
      libresBase: sb.debtFreeMonthKey || null,
      libresOferta: so.debtFreeMonthKey || null,
      costeBase,
      costeOferta,
      perdonado: r2(so.forgiven),
      comision: a.comision,
      cuota: a.cuota ?? null,
      cuotasHoy: a.cuotasHoy ?? null,
      extra: a.extra,
    };
  }

  /** Para una quita: la recomendación con las dos formas de pagarla. */
  function quitaFrase(v, euros = (x) => `${Math.round(x)} €`) {
    if (!v?.ok || !v.deGolpe) return "";
    const g = v.deGolpe;
    const golpe = g.tono === "compensa" ? `pagándola de golpe con la caja, os compensa: ${euros(g.diferencia)} menos` : g.tono === "no" ? `ni pagándola de golpe os compensa (${euros(-g.diferencia)} más)` : "pagándola de golpe, casi igual";
    const caja = g.alcanza === false ? ` Por encima del suelo tenéis unos ${euros(g.disponible)} en los próximos 12 meses: no llega.` : g.alcanza ? " Os llega sin bajar del suelo." : "";
    const juntando = v.tono === "compensa" ? "Juntándola con lo de cada mes también compensa" : "Juntándola con lo de cada mes no compensa: la deuda baja antes de llegar al importe";
    return `${juntando}; ${golpe}.${caja}`;
  }

  /** Lo que se dice en grande: «Os compensa: 210 € menos» / «No os compensa: 80 € más» / «Casi igual». */
  function titular(v, euros = (x) => `${Math.round(x)} €`) {
    if (!v?.ok) return "";
    if (v.tono === "igual") return `Casi igual: ${euros(Math.abs(v.diferencia))} de diferencia`;
    return v.tono === "compensa" ? `Os compensa: ${euros(v.diferencia)} menos` : `No os compensa: ${euros(-v.diferencia)} más`;
  }

  /** Días hasta que vence (con la fecha AAAA-MM-DD), o null. */
  function diasHasta(vence, hoy) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(vence || "")) || !/^\d{4}-\d{2}-\d{2}$/.test(String(hoy || ""))) return null;
    return Math.round((Date.parse(`${vence}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / 86400000);
  }

  /** Normaliza lo guardado: solo lo que tiene tipo conocido; estado abierta | en-plan | rechazada | vencida (por fecha). */
  function normalizar(lista, hoy) {
    return (Array.isArray(lista) ? lista : [])
      .filter((o) => o && TIPOS[o.tipo] && o.id)
      .map((o) => {
        const dias = diasHasta(o.vence, hoy);
        const estado = o.estado === "rechazada" || o.estado === "en-plan" ? o.estado : dias !== null && dias < 0 ? "vencida" : "abierta";
        return { ...o, estado, dias };
      });
  }

  const api = { TIPOS, CASI_IGUAL, cuotaPrestamo, aplicar, coste, veredicto, comparar, titular, quitaFrase, diasHasta, normalizar, sumarMeses };
  root.FinanceCanonicalDebtOffers = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
