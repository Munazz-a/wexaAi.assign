const state = {
  components: [],
  graph: { nodes: [], relationships: [] },
  selected: null,
  simulation: null
};

const $ = id => document.getElementById(id);

const typeColor = {
  Service: "#818cf8",
  Database: "#34d399",
  API: "#fbbf24",
  Library: "#e879f9",
  Project: "#94a3b8"
};

async function api(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || "Request failed");
  return data;
}

function setDbStatus(ok) {
  $("dbStatus").innerHTML = ok
    ? '<span class="w-2 h-2 rounded-full bg-emerald-400"></span> CognoDB connected'
    : '<span class="w-2 h-2 rounded-full bg-red-400"></span> CognoDB unavailable';
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

    state.components = components;
    populateSelects();
    await loadFullGraph();
  } catch (error) {
    setDbStatus(false);
    $("graphLoading").textContent = error.message;
  }
}

function populateSelects() {
  const options = state.components
    .map(c => `<option value="${c.id}">${escapeHtml(c.name)} · ${escapeHtml(c.type)}</option>`)
    .join("");

  $("sourceSelect").innerHTML = options;
  $("targetSelect").innerHTML = options;

  if (state.components.length > 1) {
    $("targetSelect").value = state.components[1].id;
  }
}

async function loadFullGraph() {
  const graph = {
    nodes: state.components,
    relationships: []
  };

  const relationships = [];
  for (const component of state.components) {
    try {
      const neighborhood = await api(`/api/graph/components/${component.id}/neighborhood?depth=1`);
      relationships.push(...neighborhood.relationships);
    } catch {}
  }

  const relMap = new Map();
  relationships.forEach(r => relMap.set(r.id, r));

  graph.relationships = [...relMap.values()];
  state.graph = graph;
  renderGraph(graph);
  $("graphLoading").style.display = "none";
}

function renderGraph(graph) {
  const svg = d3.select("#graph");
  svg.selectAll("*").remove();

  const wrap = $("graphWrap");
  const width = wrap.clientWidth;
  const height = wrap.clientHeight;

  const nodes = graph.nodes.map(d => ({ ...d }));
  const links = graph.relationships.map(d => ({ ...d }));

  const defs = svg.append("defs");
  defs.append("marker")
    .attr("id", "arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 22)
    .attr("refY", 0)
    .attr("markerWidth", 5)
    .attr("markerHeight", 5)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "#475569");

  const root = svg.append("g");

  svg.call(
    d3.zoom()
      .scaleExtent([0.35, 3])
      .on("zoom", event => root.attr("transform", event.transform))
  );

  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(95))
    .force("charge", d3.forceManyBody().strength(-250))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(32));

  const link = root.append("g")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("class", "link")
    .attr("marker-end", "url(#arrow)");

  const linkLabel = root.append("g")
    .selectAll("text")
    .data(links)
    .join("text")
    .attr("fill", "#64748b")
    .attr("font-size", 7)
    .attr("text-anchor", "middle")
    .text(d => d.type.replaceAll("_", " "));

  const node = root.append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .attr("class", "node")
    .on("click", async (_, d) => selectComponent(d.id))
    .call(drag(simulation));

  node.append("circle")
    .attr("r", d => d.type === "Service" ? 13 : 10)
    .attr("fill", d => typeColor[d.type] || "#94a3b8");

  node.append("text")
    .attr("x", 17)
    .attr("y", 4)
    .text(d => d.name);

  node.append("title").text(d => `${d.name} · ${d.type}`);

  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    linkLabel
      .attr("x", d => (d.source.x + d.target.x) / 2)
      .attr("y", d => (d.source.y + d.target.y) / 2);

    node.attr("transform", d => `translate(${d.x},${d.y})`);
  });

  state.simulation = simulation;
}

function drag(simulation) {
  return d3.drag()
    .on("start", (event, d) => {
      if (!event.active) simulation.alphaTarget(.3).restart();
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
    const component = await api(`/api/graph/components/${id}`);
    state.selected = component;

    $("statSelected").textContent = component.name;
    $("componentName").textContent = component.name;
    $("componentType").textContent = component.type;
    $("componentDescription").textContent = component.description;
    $("componentOwner").textContent = component.owner || "—";

    $("sourceSelect").value = id;
    $("statRisk").textContent = "Ready";

    const neighborhood = await api(`/api/graph/components/${id}/neighborhood?depth=2`);
    renderGraph(neighborhood);
    focusGraph(id, neighborhood);
  } catch (error) {
    showError(error.message);
  }
}

function focusGraph(selectedId, graph) {
  const connected = new Set(graph.nodes.map(n => n.id));

  d3.selectAll(".node")
    .classed("selected", d => d.id === selectedId)
    .classed("dim", d => !connected.has(d.id));

  d3.selectAll(".link")
    .classed("dim", d => !connected.has(d.source.id || d.source) || !connected.has(d.target.id || d.target));
}

async function analyzeImpact() {
  if (!state.selected) {
    showError("Select a component first.");
    return;
  }

  try {
    $("impactBadge").textContent = "Analyzing...";
    const result = await api(`/api/graph/components/${state.selected.id}/impact?depth=5`);

    const total = result.summary.totalAffected;
    const risk = total >= 5 ? "HIGH" : total >= 3 ? "MEDIUM" : total > 0 ? "LOW" : "MINIMAL";

    $("componentBlast").textContent = total;
    $("statRisk").textContent = risk;
    $("impactBadge").textContent = risk;

    $("impactContent").innerHTML = `
      <div class="grid grid-cols-3 gap-2 mb-4">
        <div class="mini-card"><span>Affected</span><strong>${total}</strong></div>
        <div class="mini-card"><span>Direct</span><strong>${result.summary.direct}</strong></div>
        <div class="mini-card"><span>Indirect</span><strong>${result.summary.indirect}</strong></div>
      </div>
      <p class="text-xs text-slate-400 leading-5 mb-3">
        ${escapeHtml(state.selected.name)} has a ${risk.toLowerCase()} blast radius across the modeled architecture.
      </p>
      <div class="space-y-2 max-h-48 overflow-auto pr-1">
        ${result.affected.map(item => `
          <button class="w-full text-left bg-slate-900 border border-slate-800 rounded-lg p-3 hover:border-slate-600"
            onclick="selectComponent('${item.id}')">
            <div class="flex justify-between gap-3">
              <span class="text-xs text-slate-200">${escapeHtml(item.name)}</span>
              <span class="text-[10px] text-slate-500">${item.distance} hop${item.distance === 1 ? "" : "s"}</span>
            </div>
          </button>
        `).join("") || '<p class="text-xs text-slate-500">No dependent services found.</p>'}
      </div>
    `;
  } catch (error) {
    showError(error.message);
  }
}

async function findPath() {
  const source = $("sourceSelect").value;
  const target = $("targetSelect").value;

  if (source === target) {
    $("pathResult").innerHTML = '<p class="text-xs text-amber-300">Choose two different components.</p>';
    return;
  }

  try {
    const graph = await api(`/api/graph/path?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}`);
    renderGraph(graph);

    const names = graph.nodes.map(n => n.name);
    $("pathResult").innerHTML = `
      <div class="rounded-xl bg-slate-900 border border-slate-800 p-3">
        <p class="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Shortest path · ${Math.max(names.length - 1, 0)} hops</p>
        <div class="flex flex-wrap items-center gap-1">
          ${names.map((name, i) => `
            <span class="text-xs text-slate-200">${escapeHtml(name)}</span>
            ${i < names.length - 1 ? '<span class="text-slate-600">→</span>' : ""}
          `).join("")}
        </div>
      </div>
    `;
  } catch (error) {
    $("pathResult").innerHTML = `<p class="text-xs text-red-300">${escapeHtml(error.message)}</p>`;
  }
}

function resetGraph() {
  state.selected = null;
  $("statSelected").textContent = "None";
  $("statRisk").textContent = "—";
  $("componentName").textContent = "Select a node";
  $("componentType").textContent = "—";
  $("componentDescription").textContent = "Click any node in the graph to inspect it.";
  $("componentOwner").textContent = "—";
  $("componentBlast").textContent = "—";
  $("impactBadge").textContent = "Ready";
  $("impactContent").textContent = "Select a component and run impact analysis.";
  $("pathResult").innerHTML = "";
  loadFullGraph();
}

function showError(message) {
  $("impactContent").innerHTML = `<p class="text-xs text-red-300">${escapeHtml(message)}</p>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

$("resetBtn").addEventListener("click", resetGraph);
$("impactBtn").addEventListener("click", analyzeImpact);
$("pathBtn").addEventListener("click", findPath);

init();
