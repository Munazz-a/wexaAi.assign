// Explore a component's 1–3 hop neighborhood.
MATCH (target:Component {id: $componentId})
MATCH p = (target)-[:DEPENDS_ON|CALLS|USES|OWNED_BY|PART_OF*1..2]-(neighbor:Component)
RETURN p;
