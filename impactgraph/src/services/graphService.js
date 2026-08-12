import { runQuery } from "../db.js";
import { nodeToJson, pathToGraph } from "../utils/neo4j.js";

const REL_TYPES = "DEPENDS_ON|CALLS|USES|OWNED_BY|PART_OF";

export async function getStats() {
  const records = await runQuery(`
    MATCH (n)
    WITH count(n) AS nodes
    OPTIONAL MATCH ()-[r]->()
    RETURN nodes, count(r) AS relationships
  `);

  const record = records[0];
  return {
    nodes: record.get("nodes").toNumber(),
    relationships: record.get("relationships").toNumber()
  };
}

export async function getComponents() {
  const records = await runQuery(`
    MATCH (c:Component)
    RETURN c
    ORDER BY c.type, c.name
  `);

  return records.map(r => nodeToJson(r.get("c")));
}

export async function getComponent(id) {
  const records = await runQuery(`
    MATCH (c:Component {id: $id})
    RETURN c
  `, { id });

  return records.length ? nodeToJson(records[0].get("c")) : null;
}

export async function getNeighborhood(id, depth = 2) {
  const safeDepth = Math.min(Math.max(Number(depth) || 2, 1), 3);

  const records = await runQuery(`
    MATCH (target:Component {id: $id})
    MATCH p = (target)-[:${REL_TYPES}*1..${safeDepth}]-(neighbor:Component)
    RETURN p
  `, { id });

  const graph = {
    nodes: [],
    relationships: []
  };

  const nodeMap = new Map();
  const relMap = new Map();

  for (const record of records) {
    const partial = pathToGraph(record.get("p"));
    for (const node of partial.nodes) nodeMap.set(node.id, node);
    for (const rel of partial.relationships) relMap.set(rel.id, rel);
  }

  graph.nodes = [...nodeMap.values()];
  graph.relationships = [...relMap.values()];
  return graph;
}

export async function getImpact(id, maxDepth = 5) {
  const safeDepth = Math.min(Math.max(Number(maxDepth) || 5, 1), 5);

  const records = await runQuery(`
    MATCH (target:Component {id: $id})
    MATCH p = (affected:Component)-[:DEPENDS_ON|CALLS|USES*1..${safeDepth}]->(target)
    WHERE affected.id <> target.id
      AND affected.type = "Service"
    RETURN affected, min(length(p)) AS distance
    ORDER BY distance, affected.name
  `, { id });

  const affected = records.map(r => ({
    ...nodeToJson(r.get("affected")),
    distance: r.get("distance").toNumber()
  }));

  const grouped = affected.reduce((acc, item) => {
    const key = String(item.distance);
    acc[key] ||= 0;
    acc[key]++;
    return acc;
  }, {});

  return {
    target: await getComponent(id),
    affected,
    summary: {
      totalAffected: affected.length,
      direct: affected.filter(x => x.distance === 1).length,
      indirect: affected.filter(x => x.distance > 1).length,
      maxDepth: affected.length ? Math.max(...affected.map(x => x.distance)) : 0,
      byDistance: grouped
    }
  };
}

export async function findPath(sourceId, targetId) {
  const records = await runQuery(`
    MATCH (source:Component {id: $sourceId})
    MATCH (target:Component {id: $targetId})
    MATCH p = shortestPath(
      (source)-[:DEPENDS_ON|CALLS|USES|OWNED_BY|PART_OF*..8]-(target)
    )
    RETURN p
  `, { sourceId, targetId });

  if (!records.length) return null;
  return pathToGraph(records[0].get("p"));
}
