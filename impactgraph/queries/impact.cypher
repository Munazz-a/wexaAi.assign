// Find all services affected by a component up to 5 hops away.
MATCH path =
  (affected:Component)-[:DEPENDS_ON|CALLS|USES*1..5]->
  (target:Component {id: $componentId})
WHERE affected.id <> target.id
  AND affected.type = "Service"
RETURN affected, min(length(path)) AS distance
ORDER BY distance, affected.name;
