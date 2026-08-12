(function (root) {
  const enc = new TextEncoder();

  function safe(value) {
    return String(value ?? "").replace(/[()\\]/g, (match) => `\\${match}`).replace(/[^\x20-\x7E]/g, "?");
  }

  function pdfBlob(lines) {
    const pages = [];
    for (let index = 0; index < lines.length; index += 42) pages.push(lines.slice(index, index + 42));
    if (!pages.length) pages.push(["Informe financiero"]);
    const objects = [];
    const pageIds = [];
    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
    pages.forEach((page, pageIndex) => {
      const pageId = 4 + pageIndex * 2;
      const contentId = pageId + 1;
      pageIds.push(pageId);
      const commands = ["BT", "/F1 10 Tf", "48 790 Td"];
      page.forEach((line, lineIndex) => {
        if (lineIndex) commands.push("0 -17 Td");
        commands.push(`(${safe(line)}) Tj`);
      });
      commands.push("ET");
      const stream = commands.join("\n");
      objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
      objects[contentId] = `<< /Length ${enc.encode(stream).length} >>\nstream\n${stream}\nendstream`;
    });
    objects[2] = `<< /Type /Pages /Kids [${pageIds.map((value) => `${value} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
    let output = "%PDF-1.4\n";
    const offsets = [0];
    for (let index = 1; index < objects.length; index += 1) {
      offsets[index] = enc.encode(output).length;
      output += `${index} 0 obj\n${objects[index]}\nendobj\n`;
    }
    const xref = enc.encode(output).length;
    output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let index = 1; index < objects.length; index += 1) output += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
    output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return new Blob([output], { type: "application/pdf" });
  }

  function download(blob, name) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function workbook(model) {
    if (!root.XLSX) throw new Error("La librería Excel no está disponible");
    const book = root.XLSX.utils.book_new();
    const sheets = {
      Resumen: model.summary,
      Cuentas: model.accounts,
      Deudas: model.debts,
      Objetivos: model.goals,
      Movimientos: model.movements,
      Alertas: model.alerts,
      Documentos: model.documents,
      Procedencia: model.provenance,
    };
    Object.entries(sheets).forEach(([name, rows]) => root.XLSX.utils.book_append_sheet(book, root.XLSX.utils.json_to_sheet(rows || []), name));
    return book;
  }

  root.P2Export = {
    downloadPdf(model, fileName) {
      const lines = [
        `INFORME FINANCIERO PARA ASESOR - VERSION ${model.version}`,
        `Generado: ${model.generatedAt}`,
        "",
        ...model.pdfLines,
        "",
        "ADVERTENCIAS Y PROCEDENCIA",
        ...model.provenance.map((row) => `${row.elemento}: ${row.fuente} | ${row.confianza}`),
      ];
      download(pdfBlob(lines), fileName);
    },
    downloadPlainPdf(lines, fileName) {
      download(pdfBlob(lines), fileName);
    },
    downloadExcel(model, fileName) {
      root.XLSX.writeFile(workbook(model), fileName);
    },
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
