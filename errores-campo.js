// P3 (D-N58, 28/11/2026): el error, en su campo, en todos los formularios. El globo nativo del navegador («Completa este campo»)
// no se puede traducir ni colocar, y en Safari se veía sobre el campo que no era: la captura del hogar lo enseñaba sobre «Bloque»,
// que estaba bien, cuando lo que faltaba era el concepto. La ficha de un movimiento y Clasificar ya decían el error junto al campo
// (3/11); los diálogos y formularios con `required`, no.
//
// Cómo: un solo oyente para toda la app. Cuando el navegador encuentra un campo no válido al enviar, dispara `invalid` en cada uno:
// aquí se cancela el globo, se escribe el error bajo el campo (con `aria-invalid` y `aria-describedby`) y el foco va al primero
// que falla. El formulario sigue sin enviarse, como antes: no cambia qué se valida, solo dónde se dice. Al corregir el campo, el
// error se va. Sirve también para los formularios que se pintan después (Deuda, objetivos, CIRBE…) sin tocar ninguno.
// El error lleva el id `<campo>-campo-error`, distinto del aviso de importe de WP-11 (`<campo>-error`, ux-shell.js), que se quita al salir del
// campo: con el mismo id, se llevaba también este y el formulario se movía bajo el dedo (CI de #704).
// `mostrarError(campo, texto)` es para las comprobaciones propias (un importe que no se entiende), con el mismo aspecto.
(function attachErroresCampo(root) {
  "use strict";
  const doc = root.document;
  const CLASE = "campo-error";
  let primeroDelEnvio = null;

  function etiqueta(campo) {
    const label = campo.closest?.("label") || (campo.id && doc.querySelector(`label[for="${CSS.escape(campo.id)}"]`));
    const texto = (label?.querySelector("span")?.textContent || label?.textContent || campo.getAttribute("aria-label") || "").trim();
    return texto.replace(/\s*\*$/, "").replace(/\s+/g, " ").slice(0, 60);
  }

  // El texto, en lenguaje del hogar. Lo que no se sabe decir mejor, lo dice el navegador.
  function textoDe(campo) {
    const v = campo.validity || {};
    const nombre = etiqueta(campo);
    const que = nombre ? `«${nombre}»` : "este campo";
    if (v.valueMissing) {
      if (campo.tagName === "SELECT") return `Elige ${que}.`;
      if (campo.type === "checkbox" || campo.type === "radio") return `Marca ${que}.`;
      return `Falta ${que}.`;
    }
    if (v.rangeUnderflow) return `${nombre || "El valor"} tiene que ser ${campo.min} o más.`;
    if (v.rangeOverflow) return `${nombre || "El valor"} tiene que ser ${campo.max} como mucho.`;
    if (v.badInput || v.typeMismatch) return `${nombre ? `«${nombre}»` : "El valor"} no se entiende: revisa lo escrito.`;
    if (v.tooShort) return `${nombre || "El texto"} es demasiado corto.`;
    return campo.validationMessage || "Revisa este campo.";
  }

  function idDelError(campo) {
    if (!campo.id) campo.id = `campo-${Math.random().toString(36).slice(2, 9)}`;
    return `${campo.id}-campo-error`;
  }

  function mostrarError(campo, texto) {
    if (!campo) return;
    const id = idDelError(campo);
    let nota = doc.getElementById(id);
    if (!nota) {
      nota = doc.createElement("span");
      nota.id = id;
      nota.className = CLASE;
      campo.insertAdjacentElement("afterend", nota);
    }
    nota.textContent = texto;
    campo.setAttribute("aria-invalid", "true");
    const descrito = (campo.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
    if (!descrito.includes(id)) campo.setAttribute("aria-describedby", [...descrito, id].join(" "));
  }

  function quitarError(campo) {
    if (!campo?.id) return;
    const id = `${campo.id}-campo-error`;
    doc.getElementById(id)?.remove();
    if (campo.getAttribute("aria-invalid") === "true") campo.removeAttribute("aria-invalid");
    const resto = (campo.getAttribute("aria-describedby") || "").split(/\s+/).filter((item) => item && item !== id);
    if (resto.length) campo.setAttribute("aria-describedby", resto.join(" "));
    else campo.removeAttribute("aria-describedby");
  }

  function alInvalido(event) {
    const campo = event.target;
    if (!campo?.validity) return;
    event.preventDefault(); // sin globo: el error va en su campo
    mostrarError(campo, textoDe(campo));
    // El navegador dispara `invalid` en todos los que fallan, en orden: el foco, al primero (una sola vez por envío).
    if (!primeroDelEnvio) {
      primeroDelEnvio = campo;
      campo.focus?.();
      root.setTimeout(() => { primeroDelEnvio = null; }, 0);
    }
  }

  function alCorregir(event) {
    const campo = event.target;
    if (!campo?.id || !doc.getElementById(`${campo.id}-campo-error`)) return; // sin mirar aria-invalid: WP-11 lo quita al salir de un importe
    if (campo.validity?.valid !== false) quitarError(campo);
  }

  if (doc && !doc.__erroresCampo) {
    doc.__erroresCampo = true;
    doc.addEventListener("invalid", alInvalido, true); // `invalid` no burbujea: en captura
    // Solo al escribir o elegir (`input`, que también dan los desplegables y las casillas), nunca al salir del campo (`change`): quitar el
    // error al perder el foco movía el formulario entre apoyar y levantar el dedo, y el toque en «Cancelar» se perdía (CI de #704).
    doc.addEventListener("input", alCorregir, true);
    // Al cerrar un diálogo o vaciar un formulario, los errores de la vez anterior no se quedan para la siguiente.
    const limpiar = (event) => event.target?.querySelectorAll?.(`.${CLASE}`).forEach((nota) => {
      const campo = doc.getElementById(nota.id.replace(/-campo-error$/, ""));
      if (campo) quitarError(campo);
      else nota.remove();
    });
    doc.addEventListener("close", limpiar, true);
    doc.addEventListener("reset", limpiar, true);
  }

  root.FinanceErroresCampo = { mostrarError, quitarError, textoDe };
})(typeof globalThis !== "undefined" ? globalThis : this);
