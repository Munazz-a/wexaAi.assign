const state = {
  components: [],
  graph: { nodes: [], relationships: [] },
  selected: null,
  filter: "All",
  search: "",
  impact: null,
  path: null,
  simulation: null,
  zoom: null,
  root: null,
  nodeSelection: null,
  linkSelection: null,
  labelSelection: null,
  zoomTransform: null
};

const $ = id => document.getElementById(id);

const palette = {
  Service: "#4f7cff",
  Database: "#22a06b",
  API: "#d99100",
  Library: "#9b59b6",
  Project: "#667085"
};

const softPalette = {
  Service: "#dbe7ff",
  Database: "#d7f5e7",
  API: "#fff0c2",
  Library: "#f1ddf8",
  Project: "#e6e9ef"
};

async function api(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || "Request failed");
  return data;
}

function setDbStatus(ok) {
  $("dbStatus").innerHTML = ok
    ? '<span class="status-dot connected"></span>CognoDB connected'
    : '<span class="status-dot disconnected"></span>CognoDB unavailable';
}

async function init() {
  try {
    const [health, stats, components] = await Promise.all([
      api("/api/health"),
      api("/api/graph/stats"),
      api("/api/graph/components")
    ]);

    setDbStatus(health.database === "connected");
    $("statNodes").textContent = stats.nodes;
    $("statRelationships").textContent = stats.relationships;
    $("componentCount").textContent = components.length;
    $("insightRelationships").textContent = stats.relationships;
    $("graphSummary").textContent = `${stats.nodes} components · ${stats.relationships} relationships`;

    state.components = components;
    populateSelects();
    updateFilterCounts();
    await loadFullGraph();
    renderInsights();
  } catch (error) {
    setDbStatus(false);
    $("graphLoading").textContent = error.message;
    showToast(error.message, true);
  }
}

function populateSelects() {
  const options = state.components
    .map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)} · ${escapeHtml(c.type)}</option>`)
    .join("");

  $("sourceSelect").innerHTML = options;
  $("targetSelect").innerHTML = options;
  if (state.components.length > 1) $("targetSelect").value = state.components[1].id;
}

function updateFilterCounts() {
  const counts = { All: state.components.length };
  state.components.forEach(c => counts[c.type] = (counts[c.type] || 0) + 1);
  Object.entries(counts).forEach(([key, value]) => {
    const el = $(key === "All" ? "filterAll" : `filter${key}`);
    if (el) el.textContent = value;
  });
}

function visibleNodes() {
  const q = state.search.trim().toLowerCase();
  return state.graph.nodes.filter(node => {
    const typeOk = state.filter === "All" || node.type === state.filter;
    const textOk = !q || `${node.name} ${node.type} ${node.owner || ""} ${node.description || ""}`.toLowerCase().includes(q);
    return typeOk && textOk;
  });
}

async function loadFullGraph() {
  setGraphLoading(true, "Loading architecture…");
  const relationships = [];

  // The current backend exposes neighborhoods rather than a dedicated edge endpoint.
  // A small graph makes this simple and keeps the UI compatible with the existing API.
  const results = await Promise.all(state.components.map(component =>
    api(`/api/graph/components/${encodeURIComponent(component.id)}/neighborhood?depth=1`).catch(() => null)
  ));

  const relMap = new Map();
  results.filter(Boolean).forEach(result => result.relationships.forEach(rel => relMap.set(rel.id, rel)));

  state.graph = {
    nodes: state.components.map(c => ({ ...c })),
    relationships: [...relMap.values()]
  };

  renderGraph();
  setGraphLoading(false);
}

function renderGraph() {
  const svg = d3.select("#graph");
  svg.selectAll("*").remove();

  const wrap = $("graphWrap");
  const width = Math.max(wrap.clientWidth, 500);
  const height = Math.max(wrap.clientHeight, 520);
  const visible = new Set(visibleNodes().map(n => n.id));
  const nodes = state.graph.nodes.filter(n => visible.has(n.id)).map(n => ({ ...n }));
  const nodeIds = new Set(nodes.map(n => n.id));
  const links = state.graph.relationships
    .filter(r => nodeIds.has(r.source?.id || r.source) && nodeIds.has(r.target?.id || r.target))
    .map(r => ({ ...r }));

  $("graphEmpty").classList.toggle("hidden", nodes.length > 0);
  if (!nodes.length) return;

  const defs = svg.append("defs");
  defs.append("marker")
    .attr("id", "arrow-default")
    .attr("viewBox", "0 -4 8 8")
    .attr("refX", 20)
    .attr("markerWidth", 5)
    .attr("markerHeight", 5)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-4L8,0L0,4")
    .attr("fill", "#a7afbf");

  defs.append("marker")
    .attr("id", "arrow-impact")
    .attr("viewBox", "0 -4 8 8")
    .attr("refX", 20)
    .attr("markerWidth", 5)
    .attr("markerHeight", 5)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-4L8,0L0,4")
    .attr("fill", "#c75c3c");

  const root = svg.append("g");
  state.root = root;

  const zoom = d3.zoom()
    .scaleExtent([0.45, 3.2])
    .on("zoom", event => root.attr("transform", event.transform));
  svg.call(zoom);
  state.zoom = zoom;

  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(d => d.type === "PART_OF" ? 125 : 105).strength(.55))
    .force("charge", d3.forceManyBody().strength(-390))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(34))
    .force("x", d3.forceX(width / 2).strength(.035))
    .force("y", d3.forceY(height / 2).strength(.035));

  const link = root.append("g")
    .attr("class", "links")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("class", "link")
    .attr("marker-end", "url(#arrow-default)");

  const linkLabel = root.append("g")
    .attr("class", "link-labels")
    .selectAll("text")
    .data(links)
    .join("text")
    .attr("class", "link-label")
    .text(d => String(d.type || "").replaceAll("_", " "));

  const node = root.append("g")
    .attr("class", "nodes")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .attr("class", "node")
    .on("click", (event, d) => {
      event.stopPropagation();
      selectComponent(d.id);
    })
    .on("mouseenter", (_, d) => previewNode(d.id, true))
    .on("mouseleave", () => previewNode(null, false))
    .call(drag(simulation));

  node.append("circle")
    .attr("class", "node-halo")
    .attr("r", d => d.type === "Service" ? 18 : 15)
    .attr("fill", "none");

  node.append("circle")
    .attr("class", "node-circle")
    .attr("r", d => d.type === "Service" ? 10 : 8)
    .attr("fill", d => palette[d.type] || palette.Project);

  node.append("text")
    .attr("class", "node-label")
    .attr("x", 15)
    .attr("y", 4)
    .text(d => d.name);

  node.append("title").text(d => `${d.name} · ${d.type}`);

  simulation.on("tick", () => {
    nodes.forEach(n => {
      n.x = Math.max(28, Math.min(width - 28, n.x));
      n.y = Math.max(28, Math.min(height - 28, n.y));
    });

    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    linkLabel
      .attr("x", d => (d.source.x + d.target.x) / 2)
      .attr("y", d => (d.source.y + d.target.y) / 2 - 5);

    node.attr("transform", d => `translate(${d.x},${d.y})`);
  });

  state.simulation = simulation;
  state.nodeSelection = node;
  state.linkSelection = link;
  state.labelSelection = linkLabel;

  svg.on("click", () => {
    if (state.selected) focusSelection(null);
  });

  applyVisualState();
}

function drag(simulation) {
  return d3.drag()
    .on("start", (event, d) => {
      if (!event.active) simulation.alphaTarget(.25).restart();
      d.fx = d.x;
      d.fy = d.y;
    })
    .on("drag", (event, d) => {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on("end", (event, d) => {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    });
}

async function selectComponent(id) {
  try {
    const component = await api(`/api/graph/components/${encodeURIComponent(id)}`);
    state.selected = component;
    state.impact = null;
    state.path = null;

    $("statNodes").textContent = state.graph.nodes.length;
    $("componentName").textContent = component.name;
    $("componentType").textContent = component.type;
    $("componentType").dataset.type = component.type;
    $("componentDescription").textContent = component.description || "No description available.";
    $("componentOwner").textContent = component.owner || "Unassigned";
    $("componentBlast").textContent = "—";
    $("sourceSelect").value = component.id;
    $("graphMode").textContent = `Inspecting ${component.name}`;
    $("impactBadge").textContent = "READY";
    $("impactBadge").className = "risk-pill neutral";
    $("impactContent").innerHTML = `<div class="empty-panel compact-empty"><strong>Ready to analyze</strong><span>Run impact analysis to calculate the component's blast radius.</span></div>`;
    $("pathResult").innerHTML = "";
    $("statRisk").textContent = "—";

    focusSelection(id);
  } catch (error) {
    showToast(error.message, true);
  }
}

function focusSelection(id) {
  state.selected = id ? state.selected : null;
  if (!id) {
    $("graphMode").textContent = "Full architecture";
  }
  applyVisualState();
}

function previewNode(id, active) {
  if (!state.nodeSelection || state.impact) return;
  if (!active) {
    applyVisualState();
    return;
  }
  const connected = connectedNodeIds(id);
  state.nodeSelection.classed("is-dim", d => !connected.has(d.id));
  state.linkSelection.classed("is-dim", d => !connected.has(d.source.id || d.source) || !connected.has(d.target.id || d.target));
}

function connectedNodeIds(id) {
  const ids = new Set([id]);
  state.graph.relationships.forEach(r => {
    const s = r.source?.id || r.source;
    const t = r.target?.id || r.target;
    if (s === id) ids.add(t);
    if (t === id) ids.add(s);
  });
  return ids;
}

function applyVisualState() {
  if (!state.nodeSelection || !state.linkSelection) return;

  const selectedId = state.selected?.id || null;
  const impactMap = new Map((state.impact?.affected || []).map(item => [item.id, item.distance]));
  if (selectedId && state.impact?.target?.id) impactMap.set(state.impact.target.id, 0);

  state.nodeSelection
    .classed("is-selected", d => d.id === selectedId)
    .classed("is-direct", d => impactMap.get(d.id) === 1)
    .classed("is-indirect", d => (impactMap.get(d.id) || 0) > 1)
    .classed("is-dim", d => {
      if (!selectedId) return false;
      if (state.impact) return !impactMap.has(d.id);
      return !connectedNodeIds(selectedId).has(d.id);
    });

  state.linkSelection
    .classed("is-impact", d => {
      if (!state.impact) return false;
      const s = d.source.id || d.source;
      const t = d.target.id || d.target;
      return impactMap.has(s) && impactMap.has(t);
    })
    .classed("is-dim", d => {
      if (!selectedId) return false;
      const s = d.source.id || d.source;
      const t = d.target.id || d.target;
      if (state.impact) return !(impactMap.has(s) && impactMap.has(t));
      return !(connectedNodeIds(selectedId).has(s) && connectedNodeIds(selectedId).has(t));
    });

  state.labelSelection.classed("is-dim", d => {
    const s = d.source.id || d.source;
    const t = d.target.id || d.target;
    if (!selectedId) return false;
    if (state.impact) return !(impactMap.has(s) && impactMap.has(t));
    return !(connectedNodeIds(selectedId).has(s) && connectedNodeIds(selectedId).has(t));
  });
}

async function analyzeImpact() {
  if (!state.selected) {
    showToast("Select a component first.", true);
    return;
  }

  try {
    $("impactBadge").textContent = "ANALYZING";
    const result = await api(`/api/graph/components/${encodeURIComponent(state.selected.id)}/impact?depth=5`);
    state.impact = result;

    const total = result.summary.totalAffected;
    const risk = total >= 5 ? "HIGH" : total >= 3 ? "MEDIUM" : total > 0 ? "LOW" : "MINIMAL";
    const riskClass = risk.toLowerCase();

    $("componentBlast").textContent = total;
    $("insightBlast").textContent = total;
    $("impactBadge").textContent = risk;
    $("impactBadge").className = `risk-pill ${riskClass}`;
    $("statRisk").textContent = risk;
    $("graphMode").textContent = `Impact view · ${state.selected.name}`;

    $("impactContent").innerHTML = `
      <div class="impact-metrics">
        <div><strong>${total}</strong><span>Affected</span></div>
        <div><strong>${result.summary.direct}</strong><span>Direct</span></div>
        <div><strong>${result.summary.indirect}</strong><span>Indirect</span></div>
      </div>
      <div class="impact-summary">
        <strong>${escapeHtml(state.selected.name)}</strong> has a ${risk.toLowerCase()} blast radius in the modeled architecture.
      </div>
      <div class="impact-list">
        ${result.affected.map(item => `
          <button class="impact-item" data-component-id="${escapeHtml(item.id)}">
            <span class="impact-dot ${item.distance === 1 ? "direct" : "indirect"}"></span>
            <span class="impact-name">${escapeHtml(item.name)}</span>
            <span class="hop-count">${item.distance} hop${item.distance === 1 ? "" : "s"}</span>
          </button>
        `).join("") || '<div class="no-results">No dependent services found.</div>'}
      </div>
    `;

    document.querySelectorAll(".impact-item").forEach(button => {
      button.addEventListener("click", () => selectComponent(button.dataset.componentId));
    });

    applyVisualState();
  } catch (error) {
    $("impactBadge").textContent = "ERROR";
    $("impactBadge").className = "risk-pill high";
    showToast(error.message, true);
  }
}

async function findPath() {
  const source = $("sourceSelect").value;
  const target = $("targetSelect").value;

  if (!source || !target || source === target) {
    $("pathResult").innerHTML = '<div class="path-message warning">Choose two different components.</div>';
    return;
  }

  try {
    const graph = await api(`/api/graph/path?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}`);
    if (!graph || !graph.nodes?.length) {
      $("pathResult").innerHTML = '<div class="path-message">No relationship path found.</div>';
      return;
    }

    state.path = graph;
    state.impact = null;
    state.selected = graph.nodes[0];
    $("componentName").textContent = graph.nodes[0].name;
    $("componentType").textContent = graph.nodes[0].type;
    $("componentDescription").textContent = graph.nodes[0].description || "Path source.";
    $("componentOwner").textContent = graph.nodes[0].owner || "Unassigned";
    $("componentBlast").textContent = "—";
    $("impactBadge").textContent = "PATH";
    $("impactBadge").className = "risk-pill neutral";
    $("statRisk").textContent = "—";
    $("graphMode").textContent = `Shortest path · ${graph.nodes[0].name} → ${graph.nodes.at(-1).name}`;

    const names = graph.nodes.map(n => n.name);
    $("pathResult").innerHTML = `
      <div class="path-message path-found">
        <div class="path-meta">Shortest path · ${Math.max(names.length - 1, 0)} hops</div>
        <div class="path-chain">
          ${names.map((name, i) => `<span>${escapeHtml(name)}</span>${i < names.length - 1 ? '<b>→</b>' : ''}`).join("")}
        </div>
      </div>
    `;

    highlightPath(graph);
  } catch (error) {
    $("pathResult").innerHTML = `<div class="path-message error">${escapeHtml(error.message)}</div>`;
  }
}

function highlightPath(graph) {
  if (!state.nodeSelection || !state.linkSelection) return;
  const ids = new Set(graph.nodes.map(n => n.id));
  const relIds = new Set(graph.relationships.map(r => r.id));

  state.nodeSelection
    .classed("is-selected", d => ids.has(d.id))
    .classed("is-dim", d => !ids.has(d.id));
  state.linkSelection
    .classed("is-impact", d => relIds.has(d.id))
    .classed("is-dim", d => !relIds.has(d.id));
  state.labelSelection.classed("is-dim", d => !relIds.has(d.id));
}

function resetGraph() {
  state.selected = null;
  state.impact = null;
  state.path = null;
  state.filter = "All";
  state.search = "";
  $("searchInput").value = "";
  document.querySelectorAll(".filter").forEach(button => button.classList.toggle("active", button.dataset.filter === "All"));
  $("statRisk").textContent = "—";
  $("componentName").textContent = "Select a node";
  $("componentType").textContent = "—";
  $("componentDescription").textContent = "Click any node in the graph to inspect its role in the architecture.";
  $("componentOwner").textContent = "—";
  $("componentBlast").textContent = "—";
  $("insightBlast").textContent = "—";
  $("impactBadge").textContent = "READY";
  $("impactBadge").className = "risk-pill neutral";
  $("impactContent").innerHTML = `<div class="empty-panel"><div class="empty-icon">◎</div><strong>Nothing analyzed yet</strong><span>Select a component and run impact analysis to see what depends on it.</span></div>`;
  $("pathResult").innerHTML = "";
  $("graphMode").textContent = "Full architecture";
  renderGraph();
}

function setGraphLoading(visible, text) {
  $("graphLoading").textContent = text || "Loading…";
  $("graphLoading").classList.toggle("hidden", !visible);
}

function renderInsights() {
  const degree = new Map(state.components.map(c => [c.id, 0]));
  state.graph.relationships?.forEach(r => {
    const s = r.source?.id || r.source;
    const t = r.target?.id || r.target;
    degree.set(s, (degree.get(s) || 0) + 1);
    degree.set(t, (degree.get(t) || 0) + 1);
  });
  const most = [...degree.entries()].sort((a, b) => b[1] - a[1])[0];
  const component = most ? state.components.find(c => c.id === most[0]) : null;
  const row = document.querySelector("#insightList .insight-row");
  if (row) row.innerHTML = `<span>Most connected</span><strong>${component ? escapeHtml(component.name) : "—"}</strong>`;
}

function showToast(message, error = false) {
  const toast = $("toast");
  toast.textContent = message;
  toast.className = `toast visible ${error ? "error" : ""}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.className = "toast", 2800);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function bindEvents() {
  $("resetBtn").addEventListener("click", resetGraph);
  $("impactBtn").addEventListener("click", analyzeImpact);
  $("pathBtn").addEventListener("click", findPath);

  $("searchInput").addEventListener("input", event => {
    state.search = event.target.value;
    renderGraph();
  });

  document.querySelectorAll(".filter").forEach(button => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      document.querySelectorAll(".filter").forEach(item => item.classList.toggle("active", item === button));
      renderGraph();
    });
  });

  window.addEventListener("keydown", event => {
    if (event.key === "/" && document.activeElement !== $("searchInput")) {
      event.preventDefault();
      $("searchInput").focus();
    }
    if (event.key === "Escape") {
      $("searchInput").value = "";
      state.search = "";
      renderGraph();
    }
  });

  $("zoomInBtn").addEventListener("click", () => zoomBy(1.25));
  $("zoomOutBtn").addEventListener("click", () => zoomBy(.8));
  $("zoomResetBtn").addEventListener("click", () => {
    const svg = d3.select("#graph");
    svg.transition().duration(220).call(state.zoom.transform, d3.zoomIdentity);
  });
}

function zoomBy(factor) {
  if (!state.zoom) return;
  d3.select("#graph").transition().duration(180).call(state.zoom.scaleBy, factor);
}

bindEvents();
init();