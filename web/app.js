const $ = (selector) => document.querySelector(selector);

let source = null; // JSON subido por el usuario (null = muestra incluida)
let lastResult = null;

const esc = (value) =>
  String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);

const num = (value) => new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 }).format(value);

const plural = (count, one, many) => `${num(count)} ${count === 1 ? one : many}`;

const slug = (text) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "material";

function download(filename, content, type) {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function setStatus(text, isError = false) {
  const status = $("#status");
  status.textContent = text;
  status.classList.toggle("error", isError);
}

async function run() {
  const kerf = Math.max(0, Number($("#kerf").value) || 0);
  const allowRotation = $("#rotate").checked;
  setStatus("Optimizando…");

  try {
    const response = source
      ? await fetch("/api/optimize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: source, kerf, allow_rotation: allowRotation }),
        })
      : await fetch(`/api/demo?kerf=${kerf}&allow_rotation=${allowRotation}`);

    if (!response.ok) {
      let detail = `Error ${response.status}`;
      try {
        const body = await response.json();
        detail = body.detail || detail;
      } catch (_) {
        /* respuesta sin JSON */
      }
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }

    const result = await response.json();
    lastResult = result;
    render(result);
    setStatus(
      `${plural(result.summary.parts, "pieza", "piezas")} · ${plural(
        result.summary.sheets,
        "tablero",
        "tableros",
      )} · ${result.summary.yield_pct} % aprovechamiento`,
    );
  } catch (error) {
    setStatus(error.message, true);
  }
}

function render(result) {
  renderSummary(result.summary);
  renderWarnings(result.warnings || []);
  renderGroups(result.groups || []);
}

function renderSummary(summary) {
  const cards = [
    { label: "Piezas", value: num(summary.parts) },
    { label: "Tableros", value: num(summary.sheets) },
    { label: "Aprovechamiento", value: `${summary.yield_pct} %`, accent: true },
    { label: "Sin ubicar", value: num(summary.unplaced) },
  ];
  $("#summary").innerHTML = cards
    .map(
      (card) =>
        `<div class="card${card.accent ? " accent" : ""}"><span>${card.label}</span><strong>${esc(card.value)}</strong></div>`,
    )
    .join("");
}

function renderWarnings(warnings) {
  const box = $("#warnings");
  if (!warnings.length) {
    box.innerHTML = "";
    return;
  }
  box.innerHTML = `<strong>Notas</strong><ul>${warnings.map((text) => `<li>${esc(text)}</li>`).join("")}</ul>`;
}

function renderGroups(groups) {
  $("#groups").innerHTML = groups
    .map((group, groupIndex) => {
      const sheets = group.sheets
        .map(
          (sheet) => `
        <figure class="sheet">
          <figcaption>
            <span>Hoja ${sheet.index} · ${sheet.used_pct} %</span>
            <button class="mini" type="button" data-svg="${groupIndex}:${sheet.index}">Descargar SVG</button>
          </figcaption>
          <div class="svgbox">${sheet.svg}</div>
        </figure>`,
        )
        .join("");

      const parts = group.parts
        .map((part) => {
          const edges = ["c1", "c2", "l1", "l2"].filter((key) => part.edges[key]);
          const edgeText = edges.length
            ? edges.map((key) => `${key}: ${part.edges[key]}`).join(" · ")
            : "—";
          return `<tr>
            <td>${esc(part.ref)}</td>
            <td>${esc(part.name)}</td>
            <td class="num">${num(part.length)} × ${num(part.width)}</td>
            <td class="num">${num(part.qty)}</td>
            <td><span title="${esc(edgeText)}">${edges.length ? esc(edges.join(", ")) : "—"}</span></td>
          </tr>`;
        })
        .join("");

      return `<section class="group">
        <div class="group-head">
          <h2>${esc(group.material)}</h2>
          <div class="chips">
            <span class="chip">Tablero ${num(group.stock.length)} × ${num(group.stock.width)} × ${num(group.stock.thickness)}</span>
            <span class="chip">${plural(group.sheets.length, "hoja", "hojas")}</span>
            <span class="chip">Kerf ${num(group.kerf)} mm</span>
            <span class="chip green">${group.yield_pct} % aprovechamiento</span>
          </div>
        </div>
        <div class="sheets">${sheets}</div>
        <details>
          <summary>Lista de corte (${plural(
            group.parts.reduce((total, part) => total + part.qty, 0),
            "pieza",
            "piezas",
          )})</summary>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Ref.</th><th>Pieza</th><th>Medidas (mm)</th><th>Cant.</th><th>Cantos</th></tr>
              </thead>
              <tbody>${parts}</tbody>
            </table>
          </div>
        </details>
        <div class="group-actions">
          <button class="solid" type="button" data-csv="${groupIndex}">Descargar CSV</button>
        </div>
      </section>`;
    })
    .join("");
}

document.addEventListener("click", (event) => {
  const csvButton = event.target.closest("[data-csv]");
  if (csvButton && lastResult) {
    const group = lastResult.groups[Number(csvButton.dataset.csv)];
    download(`lista-corte-${slug(group.material)}.csv`, group.csv, "text/csv");
    return;
  }

  const svgButton = event.target.closest("[data-svg]");
  if (svgButton && lastResult) {
    const [groupIndex, sheetIndex] = svgButton.dataset.svg.split(":").map(Number);
    const group = lastResult.groups[groupIndex];
    const sheet = group.sheets.find((item) => item.index === sheetIndex);
    download(`layout-${slug(group.material)}-hoja-${sheetIndex}.svg`, sheet.svg, "image/svg+xml");
  }
});

$("#reload").addEventListener("click", () => {
  source = null;
  $("#file").value = "";
  run();
});

$("#kerf").addEventListener("change", run);
$("#rotate").addEventListener("change", run);

$("#file").addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  try {
    source = JSON.parse(await file.text());
    setStatus(`Archivo cargado: ${file.name}`);
    run();
  } catch (error) {
    source = null;
    setStatus(`No se pudo leer el JSON: ${error.message}`, true);
  }
});

run();
