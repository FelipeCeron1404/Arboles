class ApiClient {
  async request(url, method = "GET", body = null) {
    const options = { method, headers: { "Content-Type": "application/json" } };
    if (body !== null) {
      options.body = JSON.stringify(body);
    }
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "No se pudo completar la operación");
    }
    return data;
  }

  state() {
    return this.request("/api/state");
  }

  cupLot(form) {
    return this.request("/api/lots", "POST", form);
  }

  grow(decisionId, form) {
    return this.request(`/api/decisions/${decisionId}/grow`, "POST", form);
  }

  prune(decisionId, form) {
    return this.request(`/api/decisions/${decisionId}/prune`, "POST", form);
  }

  edit(decisionId, form) {
    return this.request(`/api/decisions/${decisionId}`, "PUT", form);
  }

  restart() {
    return this.request("/api/restart", "POST", {});
  }
}

class DecisionIndex {
  constructor(tree) {
    this.decisions = new Map();
    this.register(tree);
  }

  register(decision) {
    if (!decision) {
      return;
    }
    this.decisions.set(decision.id, decision);
    this.register(decision.accept);
    this.register(decision.reject);
  }

  get(decisionId) {
    return this.decisions.get(decisionId);
  }

  descendants(decisionId) {
    const decision = this.get(decisionId);
    const count = (node) => (node ? 1 + count(node.accept) + count(node.reject) : 0);
    return decision ? count(decision) - 1 : 0;
  }
}

class TreeCanvas {
  static WIDTH = 140;
  static HEIGHT = 64;
  static SLOT = 152;
  static LEVEL_GAP = 100;
  static PADDING = 28;
  static SVG = "http://www.w3.org/2000/svg";

  constructor(container, onSelect) {
    this.container = container;
    this.onSelect = onSelect;
  }

  render(tree, routeIds, selectedId) {
    const placed = [];
    let leafSlot = 0;
    const place = (decision, depth) => {
      if (!decision) {
        return null;
      }
      const accept = place(decision.accept, depth + 1);
      const reject = place(decision.reject, depth + 1);
      let x;
      if (accept && reject) {
        x = (accept.x + reject.x) / 2;
      } else {
        x = TreeCanvas.PADDING + leafSlot * TreeCanvas.SLOT + TreeCanvas.WIDTH / 2;
        leafSlot += 1;
      }
      const y = TreeCanvas.PADDING + (depth - 1) * TreeCanvas.LEVEL_GAP;
      const spot = { decision, x, y, accept, reject };
      placed.push(spot);
      return spot;
    };
    place(tree, 1);
    const maxDepth = Math.max(...placed.map((spot) => spot.decision.level));
    const width = TreeCanvas.PADDING * 2 + Math.max(leafSlot, 1) * TreeCanvas.SLOT - (TreeCanvas.SLOT - TreeCanvas.WIDTH);
    const height = TreeCanvas.PADDING * 2 + (maxDepth - 1) * TreeCanvas.LEVEL_GAP + TreeCanvas.HEIGHT;
    const svg = this.element("svg", { width, height, viewBox: `0 0 ${width} ${height}`, role: "img" });
    svg.setAttribute("aria-label", "Árbol de decisión de catación");
    svg.style.maxWidth = `${width}px`;
    const route = new Set(routeIds);
    const edges = this.element("g");
    const nodes = this.element("g");
    placed.forEach((spot) => {
      [["accept", "Sí"], ["reject", "No"]].forEach(([side, label]) => {
        const child = spot[side];
        if (child) {
          const onRoute = route.has(spot.decision.id) && route.has(child.decision.id);
          this.drawEdge(edges, spot, child, label, onRoute);
        }
      });
      this.drawDecision(nodes, spot, route.has(spot.decision.id), spot.decision.id === selectedId);
    });
    svg.append(edges, nodes);
    this.container.replaceChildren(svg);
  }

  drawEdge(group, parent, child, label, onRoute) {
    const startY = parent.y + TreeCanvas.HEIGHT;
    const endY = child.y;
    const middleY = (startY + endY) / 2;
    const path = this.element("path", {
      d: `M ${parent.x} ${startY} C ${parent.x} ${middleY}, ${child.x} ${middleY}, ${child.x} ${endY}`,
      class: onRoute ? "edge is-route" : "edge",
    });
    const text = this.element("text", {
      x: (parent.x + child.x) / 2 + (label === "Sí" ? -14 : 14),
      y: middleY - 4,
      "text-anchor": "middle",
      class: onRoute ? "edge-label is-route" : "edge-label",
    });
    text.textContent = label;
    group.append(path, text);
  }

  drawDecision(group, spot, onRoute, selected) {
    const { decision } = spot;
    const kind = { "Raíz": "root", "Rama": "branch", "Hoja": "leaf" }[decision.kind];
    const classes = ["decision", `decision--${kind}`];
    if (onRoute) classes.push("is-route");
    if (selected) classes.push("is-selected");
    const node = this.element("g", {
      class: classes.join(" "),
      transform: `translate(${spot.x - TreeCanvas.WIDTH / 2}, ${spot.y})`,
      "data-id": decision.id,
      tabindex: 0,
    });
    const rect = this.element("rect", {
      width: TreeCanvas.WIDTH,
      height: TreeCanvas.HEIGHT,
      rx: decision.isCriterion ? 10 : 30,
    });
    const identifier = this.element("text", { x: decision.isCriterion ? 10 : 20, y: 15, class: "decision__id" });
    identifier.textContent = decision.id;
    node.append(rect, identifier);
    if (!decision.isCriterion) {
      const count = this.element("text", { x: TreeCanvas.WIDTH - 20, y: 15, "text-anchor": "end", class: "decision__count" });
      count.textContent = `${decision.lotsReached} lote${decision.lotsReached === 1 ? "" : "s"}`;
      node.append(count);
    }
    const lines = this.wrap(decision.caption, 20).slice(0, 3);
    const firstY = 37 - (lines.length - 1) * 7 + (decision.isCriterion ? 2 : 4);
    lines.forEach((line, position) => {
      const text = this.element("text", {
        x: TreeCanvas.WIDTH / 2,
        y: firstY + position * 14,
        "text-anchor": "middle",
        class: "decision__text",
      });
      text.textContent = line;
      node.append(text);
    });
    const title = this.element("title");
    title.textContent = `${decision.id} · ${decision.kind} · ${decision.caption}`;
    node.append(title);
    node.addEventListener("click", () => this.onSelect(decision.id));
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.onSelect(decision.id);
      }
    });
    group.append(node);
  }

  wrap(caption, limit) {
    const lines = [];
    let current = "";
    caption.split(" ").forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > limit && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    });
    if (current) {
      lines.push(current);
    }
    return lines;
  }

  flash(decisionId, active) {
    const node = this.container.querySelector(`[data-id="${decisionId}"]`);
    if (node) {
      node.classList.toggle("is-flash", active);
    }
  }

  element(tag, attributes = {}) {
    const element = document.createElementNS(TreeCanvas.SVG, tag);
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
    return element;
  }
}

class LotForm {
  constructor(form, fieldsContainer, sampleButton, verdict, onSubmit) {
    this.form = form;
    this.fieldsContainer = fieldsContainer;
    this.verdict = verdict;
    this.onSubmit = onSubmit;
    this.attributes = [];
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.onSubmit(this.values());
    });
    sampleButton.addEventListener("click", () => this.fillSample());
  }

  buildMeasures(attributes) {
    if (this.attributes.length) {
      return;
    }
    this.attributes = attributes;
    const title = document.createElement("div");
    title.className = "measures__title";
    title.textContent = "Ficha de cata";
    this.fieldsContainer.append(title);
    attributes.forEach((attribute) => {
      const label = document.createElement("label");
      label.className = "field";
      label.innerHTML = `
        <span>${attribute.label}</span>
        <input name="${attribute.key}" type="number" required
          min="${attribute.minimum}" max="${attribute.maximum}" step="${attribute.step}">
        <small>${attribute.minimum} – ${attribute.maximum} ${attribute.unit}</small>`;
      this.fieldsContainer.append(label);
    });
  }

  values() {
    const data = Object.fromEntries(new FormData(this.form).entries());
    this.attributes.forEach((attribute) => {
      data[attribute.key] = Number(data[attribute.key]);
    });
    return data;
  }

  fillSample() {
    const towns = [
      ["BUE", "Buesaco"], ["SAN", "Sandoná"], ["LAU", "La Unión"], ["CON", "Consacá"],
      ["TAB", "El Tablón de Gómez"], ["FLO", "La Florida"], ["SLO", "San Lorenzo"], ["ARB", "Arboleda"],
    ];
    const farms = ["La Esperanza", "El Recuerdo", "Santa Rita", "Las Brisas", "El Porvenir", "Monteverde", "La Palma", "Buenos Aires"];
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    const between = (minimum, maximum, step) => {
      const steps = Math.round((maximum - minimum) / step);
      return Number((minimum + Math.floor(Math.random() * (steps + 1)) * step).toFixed(2));
    };
    const [prefix, town] = pick(towns);
    const sample = {
      code: `${prefix}-${String(between(100, 999, 1))}`,
      farm: pick(farms),
      municipality: town,
      moisture: between(10.4, 13.2, 0.1),
      defects: between(0, 20, 1),
      aroma: between(7, 9, 0.25),
      acidity: between(7, 9, 0.25),
      body: between(7, 9, 0.25),
      altitude: between(1500, 2250, 10),
    };
    Object.entries(sample).forEach(([name, value]) => {
      this.form.elements[name].value = value;
    });
  }

  showVerdict(record) {
    const steps = record.route
      .filter((step) => step.accepted !== null)
      .map((step) => `<li><code>${step.id}</code> ${step.caption} → <b>${step.measure}</b> · ${step.accepted ? "Sí" : "No"}</li>`)
      .join("");
    this.verdict.innerHTML = `
      <div class="verdict__label">Lote ${record.lot.code} · ${record.lot.farm}, ${record.lot.municipality}</div>
      <div class="verdict__grade">${record.grade}</div>
      <ol>${steps}</ol>`;
    this.verdict.hidden = false;
  }

  reset() {
    this.form.reset();
  }
}

class Inspector {
  constructor(container, handlers) {
    this.container = container;
    this.handlers = handlers;
    this.placeholder = container.innerHTML;
  }

  clear() {
    this.container.innerHTML = this.placeholder;
  }

  show(decision, index, attributes) {
    const kind = { "Raíz": "root", "Rama": "branch", "Hoja": "leaf" }[decision.kind];
    const link = (decisionId) => (decisionId ? `<button type="button" data-go="${decisionId}">${decisionId}</button>` : "—");
    const facts = [
      ["Nivel", decision.level],
      ["Grado", `${decision.degree} hijo${decision.degree === 1 ? "" : "s"}`],
      ["Padre", link(decision.parent)],
      ["Hermano", link(decision.sibling)],
    ];
    if (decision.isCriterion) {
      facts.push(["Si cumple", link(decision.accept.id)], ["Si no cumple", link(decision.reject.id)]);
      facts.push(["Descendientes", index.descendants(decision.id)]);
    } else {
      facts.push(["Lotes que llegaron", decision.lotsReached]);
    }
    this.container.innerHTML = `
      <span class="inspector__kind inspector__kind--${kind}">${decision.kind} · ${decision.id}</span>
      <h2>${decision.caption}</h2>
      <dl class="facts">${facts.map(([term, value]) => `<dt>${term}</dt><dd>${value}</dd>`).join("")}</dl>
      ${decision.isCriterion ? this.criterionActions(decision, index, attributes) : this.leafActions(decision, attributes)}`;
    this.container.querySelectorAll("[data-go]").forEach((button) => {
      button.addEventListener("click", () => this.handlers.select(button.dataset.go));
    });
    this.bindCriterionFields(attributes);
    this.bind("growForm", (data) => this.handlers.grow(decision.id, data));
    this.bind("gradeForm", (data) => this.handlers.edit(decision.id, data));
    this.bind("criterionForm", (data) => this.handlers.edit(decision.id, data));
    this.bind("pruneForm", (data) => this.handlers.prune(decision.id, data));
  }

  criterionFields(attributes, selected = {}) {
    const options = attributes
      .map((attribute) => `<option value="${attribute.key}" ${attribute.key === selected.attribute ? "selected" : ""}>${attribute.label}</option>`)
      .join("");
    const comparators = ["<=", ">="]
      .map((comparator) => `<option ${comparator === selected.comparator ? "selected" : ""}>${comparator}</option>`)
      .join("");
    return `
      <label class="field"><span>Atributo</span><select name="attribute" data-attribute>${options}</select></label>
      <div class="field-row">
        <label class="field"><span>Compara</span><select name="comparator">${comparators}</select></label>
        <label class="field"><span>Umbral</span><input name="threshold" type="number" required data-threshold value="${selected.threshold ?? ""}"></label>
      </div>`;
  }

  leafActions(decision, attributes) {
    return `
      <form class="action" id="growForm">
        <h3>Crecer el árbol desde esta hoja</h3>
        <p>La hoja se convierte en una rama con una nueva pregunta y dos hojas hijas.</p>
        ${this.criterionFields(attributes)}
        <label class="field"><span>Clasificación si cumple</span><input name="acceptGrade" list="gradeOptions" required value="${decision.grade}"></label>
        <label class="field"><span>Clasificación si no cumple</span><input name="rejectGrade" list="gradeOptions" required></label>
        <button class="button" type="submit">Agregar regla</button>
      </form>
      <form class="action" id="gradeForm">
        <h3>Cambiar la clasificación</h3>
        <label class="field"><span>Clasificación</span><input name="grade" list="gradeOptions" required value="${decision.grade}"></label>
        <button class="button button--ghost" type="submit">Guardar</button>
      </form>`;
  }

  criterionActions(decision, index, attributes) {
    const removed = index.descendants(decision.id);
    return `
      <form class="action" id="criterionForm">
        <h3>Editar el criterio</h3>
        <p>Cambia la pregunta sin alterar la forma del árbol.</p>
        ${this.criterionFields(attributes, decision)}
        <button class="button button--ghost" type="submit">Guardar criterio</button>
      </form>
      <form class="action" id="pruneForm">
        <h3>Podar desde aquí</h3>
        <p>Se eliminan sus ${removed} descendientes y el nodo queda como hoja.</p>
        <label class="field"><span>Clasificación de la nueva hoja</span><input name="grade" list="gradeOptions" required></label>
        <button class="button button--danger" type="submit">Podar rama</button>
      </form>`;
  }

  bindCriterionFields(attributes) {
    const select = this.container.querySelector("[data-attribute]");
    const threshold = this.container.querySelector("[data-threshold]");
    if (!select || !threshold) {
      return;
    }
    const sync = () => {
      const attribute = attributes.find((item) => item.key === select.value);
      threshold.min = attribute.minimum;
      threshold.max = attribute.maximum;
      threshold.step = attribute.step;
      threshold.placeholder = `${attribute.minimum} – ${attribute.maximum} ${attribute.unit}`;
    };
    select.addEventListener("change", () => {
      threshold.value = "";
      sync();
    });
    sync();
  }

  bind(formId, action) {
    const form = this.container.querySelector(`#${formId}`);
    if (!form) {
      return;
    }
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      if (data.threshold !== undefined) {
        data.threshold = Number(data.threshold);
      }
      action(data);
    });
  }
}

class MetricsBoard {
  constructor(metricsContainer, levelsContainer) {
    this.metricsContainer = metricsContainer;
    this.levelsContainer = levelsContainer;
  }

  render(metrics) {
    const cards = [
      ["Altura", metrics.height, "camino más largo raíz → hoja"],
      ["Peso", metrics.weight, "total de nodos"],
      ["Orden", metrics.order, "máximo de hijos permitidos"],
      ["Grado", metrics.degree, "mayor número de hijos"],
      ["Hojas", metrics.leaves, "clasificaciones finales"],
      ["Ramas", metrics.branches, "preguntas intermedias"],
    ];
    this.metricsContainer.innerHTML = cards
      .map(([label, value, note]) => `<div class="metric"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`)
      .join("");
    const widest = Math.max(...metrics.levels.map((level) => level.count));
    this.levelsContainer.innerHTML = metrics.levels
      .map((level) => `
        <div class="level">
          <span>Nivel ${level.level}</span>
          <div class="level__bar"><i style="width:${(level.count / widest) * 100}%"></i></div>
          <b>${level.count}</b>
        </div>`)
      .join("");
  }
}

class TraversalBoard {
  static HINTS = {
    preorder: "Raíz, luego subárbol izquierdo (Sí) y después el derecho (No). Es el orden en que un catador lee la ficha completa.",
    inorder: "Subárbol izquierdo, raíz y subárbol derecho. Deja cada pregunta entre sus dos posibles salidas.",
    postorder: "Primero los dos hijos y al final el padre. Es el orden en que se poda: de las hojas hacia la raíz.",
    levelorder: "Nivel por nivel, de izquierda a derecha. Coincide con la numeración inicial de los nodos.",
  };

  constructor(tabs, hint, chips, canvas, onSelect) {
    this.tabs = tabs;
    this.hint = hint;
    this.chips = chips;
    this.canvas = canvas;
    this.onSelect = onSelect;
    this.order = "preorder";
    this.traversals = null;
    this.index = null;
    tabs.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        this.order = button.dataset.order;
        tabs.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
        this.draw();
      });
    });
  }

  render(traversals, index) {
    this.traversals = traversals;
    this.index = index;
    this.draw();
  }

  draw() {
    this.hint.textContent = TraversalBoard.HINTS[this.order];
    this.chips.replaceChildren(
      ...this.traversals[this.order].map((decisionId) => {
        const decision = this.index.get(decisionId);
        const chip = document.createElement("li");
        chip.textContent = decisionId;
        chip.title = decision.caption;
        chip.classList.toggle("is-leaf", !decision.isCriterion);
        chip.addEventListener("mouseenter", () => this.canvas.flash(decisionId, true));
        chip.addEventListener("mouseleave", () => this.canvas.flash(decisionId, false));
        chip.addEventListener("click", () => this.onSelect(decisionId));
        return chip;
      })
    );
  }
}

class RecordsTable {
  static LOW_GRADES = ["Pasilla", "Rechazado"];

  constructor(body, summary, onPick) {
    this.body = body;
    this.summary = summary;
    this.onPick = onPick;
  }

  render(records, summary) {
    if (!records.length) {
      this.body.innerHTML = `<tr><td colspan="11">Aún no hay lotes catados.</td></tr>`;
    } else {
      this.body.replaceChildren(...records.map((record) => this.row(record)));
    }
    this.summary.innerHTML = summary.map((item) => `<span>${item.grade}<b>${item.lots}</b></span>`).join("");
  }

  row(record) {
    const measures = record.lot.measures;
    const low = RecordsTable.LOW_GRADES.some((grade) => record.grade.startsWith(grade));
    const row = document.createElement("tr");
    row.title = `Catado el ${record.cuppedAt}. Clic para ver su recorrido en el árbol.`;
    row.innerHTML = `
      <td class="num">${record.lot.code}</td>
      <td>${record.lot.farm}</td>
      <td>${record.lot.municipality}</td>
      <td class="num">${measures.moisture} %</td>
      <td class="num">${measures.defects}</td>
      <td class="num">${measures.aroma}</td>
      <td class="num">${measures.acidity}</td>
      <td class="num">${measures.body}</td>
      <td class="num">${measures.altitude}</td>
      <td><span class="grade-tag ${low ? "is-low" : ""}">${record.grade}</span></td>
      <td class="num">${record.leafId}</td>`;
    row.addEventListener("click", () => this.onPick(record));
    return row;
  }
}

class Toast {
  constructor(element) {
    this.element = element;
    this.timer = null;
  }

  show(message, error = false) {
    this.element.textContent = message;
    this.element.classList.toggle("is-error", error);
    this.element.hidden = false;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.element.hidden = true;
    }, 3200);
  }
}

class CuppingApp {
  constructor() {
    this.api = new ApiClient();
    this.toast = new Toast(document.getElementById("toast"));
    this.state = null;
    this.index = null;
    this.routeIds = [];
    this.selectedId = null;
    this.canvas = new TreeCanvas(document.getElementById("treeCanvas"), (decisionId) => this.select(decisionId));
    this.lotForm = new LotForm(
      document.getElementById("lotForm"),
      document.getElementById("measureFields"),
      document.getElementById("sampleButton"),
      document.getElementById("verdict"),
      (form) => this.cupLot(form)
    );
    this.inspector = new Inspector(document.getElementById("inspector"), {
      select: (decisionId) => this.select(decisionId),
      grow: (decisionId, form) => this.mutate(() => this.api.grow(decisionId, form), "Regla agregada: el árbol creció"),
      prune: (decisionId, form) => this.mutate(() => this.api.prune(decisionId, form), "Rama podada"),
      edit: (decisionId, form) => this.mutate(() => this.api.edit(decisionId, form), "Nodo actualizado"),
    });
    this.metrics = new MetricsBoard(document.getElementById("metrics"), document.getElementById("levels"));
    this.traversals = new TraversalBoard(
      document.getElementById("traversalTabs"),
      document.getElementById("traversalHint"),
      document.getElementById("traversalChips"),
      this.canvas,
      (decisionId) => this.select(decisionId)
    );
    this.records = new RecordsTable(
      document.getElementById("recordsBody"),
      document.getElementById("summary"),
      (record) => this.showRecord(record)
    );
    document.getElementById("restartButton").addEventListener("click", () => this.restart());
  }

  async start() {
    try {
      this.apply(await this.api.state());
      if (this.state.records.length) {
        this.routeIds = this.state.records[0].route.map((step) => step.id);
        this.drawTree();
      }
    } catch (error) {
      this.toast.show(error.message, true);
    }
  }

  apply(state) {
    this.state = state;
    this.index = new DecisionIndex(state.tree);
    if (this.selectedId && !this.index.get(this.selectedId)) {
      this.selectedId = null;
    }
    this.routeIds = this.routeIds.filter((decisionId) => this.index.get(decisionId));
    this.lotForm.buildMeasures(state.attributes);
    document.getElementById("gradeOptions").innerHTML = state.grades.map((grade) => `<option value="${grade}">`).join("");
    this.drawTree();
    this.metrics.render(state.metrics);
    this.traversals.render(state.traversals, this.index);
    this.records.render(state.records, state.summary);
    if (this.selectedId) {
      this.inspector.show(this.index.get(this.selectedId), this.index, state.attributes);
    } else {
      this.inspector.clear();
    }
  }

  drawTree() {
    this.canvas.render(this.state.tree, this.routeIds, this.selectedId);
  }

  select(decisionId) {
    this.selectedId = decisionId;
    this.drawTree();
    this.inspector.show(this.index.get(decisionId), this.index, this.state.attributes);
  }

  showRecord(record) {
    this.routeIds = record.route.map((step) => step.id);
    this.lotForm.showVerdict(record);
    this.drawTree();
    document.getElementById("treeCanvas").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async cupLot(form) {
    try {
      const { record, state } = await this.api.cupLot(form);
      this.routeIds = record.route.map((step) => step.id);
      this.apply(state);
      this.lotForm.showVerdict(record);
      this.lotForm.reset();
      this.toast.show(`Lote ${record.lot.code}: ${record.grade}`);
    } catch (error) {
      this.toast.show(error.message, true);
    }
  }

  async mutate(operation, message) {
    try {
      const { state } = await operation();
      this.apply(state);
      this.toast.show(message);
    } catch (error) {
      this.toast.show(error.message, true);
    }
  }

  async restart() {
    if (!confirm("¿Reiniciar el árbol y el registro de lotes a su estado inicial?")) {
      return;
    }
    this.selectedId = null;
    this.routeIds = [];
    document.getElementById("verdict").hidden = true;
    await this.mutate(() => this.api.restart(), "Laboratorio reiniciado");
    if (this.state.records.length) {
      this.routeIds = this.state.records[0].route.map((step) => step.id);
      this.drawTree();
    }
  }
}

document.addEventListener("DOMContentLoaded", () => new CuppingApp().start());
