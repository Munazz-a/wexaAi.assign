// Find the shortest relationship path between two components.
MATCH (source:Component {id: $sourceId})
MATCH (target:Component {id: $targetId})
MATCH p = shortestPath(
  (source)-[:DEPENDS_ON|CALLS|USES|OWNED_BY|PART_OF*..8]-(target)
)
RETURN p;
