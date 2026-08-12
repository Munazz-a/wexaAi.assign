export function nodeToJson(node) {
  if (!node) return null;

  return {
    id: String(node.properties.id),
    label: node.labels?.[0] || "Component",
    labels: node.labels || [],
    ...node.properties
  };
}

export function pathToGraph(path) {
  const nodes = [];
  const relationships = [];

  const seenNodes = new Set();
  const seenRelationships = new Set();

  for (const node of path.segments.flatMap(s => [s.start, s.end])) {
    const id = String(node.properties.id);
    if (!seenNodes.has(id)) {
      seenNodes.add(id);
      nodes.push(nodeToJson(node));
    }
  }

  for (const segment of path.segments) {
    const relId = String(segment.relationship.elementId || segment.relationship.identity);
    if (!seenRelationships.has(relId)) {
      seenRelationships.add(relId);
      relationships.push({
        id: relId,
        source: String(segment.start.properties.id),
        target: String(segment.end.properties.id),
        type: segment.relationship.type,
        ...segment.relationship.properties
      });
    }
  }

  return { nodes, relationships };
}
