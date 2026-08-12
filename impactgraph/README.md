# ImpactGraph

> **See what breaks before you ship.**

ImpactGraph is a graph-powered software dependency explorer. It models services, APIs, databases, libraries and projects as connected components, then uses graph traversal to answer questions such as:

- What services could be affected if this component changes?
- How many hops away are the affected services?
- What is the shortest dependency path between two components?
- Which components are directly or indirectly connected?

The application uses **CognoDB** as the managed graph database and the official **Neo4j JavaScript driver** over Bolt.

## Why a graph database?

Software architecture is naturally a network of relationships. A service can call another service, depend on a database, use a library, belong to a project and be owned by a team.

The important questions are often about **paths**, not rows:

> "What could be affected if Redis changes?"

That requires traversing an unknown number of dependency relationships. A relational database can represent these relationships, but variable-depth dependency analysis generally requires recursive CTEs or repeated joins. In a graph database, variable-length traversal is a native Cypher operation.

ImpactGraph therefore keeps the relationships as first-class graph edges and uses Cypher to calculate dependency paths and blast radius.

## Architecture

```text
Browser
  │
  │ REST / JSON
  ▼
Node.js + Express
  │
  │ Neo4j JavaScript Driver
  ▼
CognoDB
  │
  └── openCypher over Bolt
```

## Data model

```text
(:Component)
   │
   ├── DEPENDS_ON ──> (:Component)
   ├── CALLS ───────> (:Component)
   ├── USES ────────> (:Component)
   ├── OWNED_BY ────> (:Component)
   └── PART_OF ─────> (:Component)
```

The `Component` label is shared so the graph can traverse heterogeneous architecture components while each node has a `type` property such as `Service`, `Database`, `API`, `Library`, or `Project`.

### Example

```text
API Gateway
    │ CALLS
    ▼
Order Service
    │ DEPENDS_ON
    ▼
Redis
```

## Main graph queries

### 1. Multi-hop blast-radius analysis

```cypher
MATCH path =
  (affected:Service)-[:DEPENDS_ON|CALLS|USES*1..5]->
  (target:Component {id: $componentId})
WHERE affected.id <> target.id
RETURN affected, min(length(path)) AS distance
ORDER BY distance, affected.name;
```

This finds services that can reach the selected component through one or more dependency relationships.

### 2. Shortest dependency path

```cypher
MATCH (source:Component {id: $sourceId})
MATCH (target:Component {id: $targetId})
MATCH p = shortestPath(
  (source)-[:DEPENDS_ON|CALLS|USES|OWNED_BY|PART_OF*..8]-(target)
)
RETURN p;
```

This demonstrates a variable-length graph traversal that would be awkward to express as a fixed set of relational joins.

### 3. Neighborhood exploration

```cypher
MATCH (target:Component {id: $componentId})
MATCH p = (target)-[:DEPENDS_ON|CALLS|USES|OWNED_BY|PART_OF*1..2]-(neighbor:Component)
RETURN p;
```

The UI uses this to focus the interactive D3 graph around the selected component.

## Project structure

```text
impactgraph/
├── public/
│   ├── index.html
│   └── app.js
├── src/
│   ├── config/
│   │   └── env.js
│   ├── services/
│   │   └── graphService.js
│   ├── utils/
│   │   └── neo4j.js
│   ├── db.js
│   ├── routes/
│   │   └── graph.js
│   └── server.js
├── scripts/
│   └── seed.js
├── queries/
│   ├── impact.cypher
│   ├── neighborhood.cypher
│   └── shortest-path.cypher
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Setup

### 1. Create a CognoDB instance

Create a free C0 instance from the CognoDB Cloud console.

Copy the Bolt URI and generated `cognodb` password. The password is shown only once.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Then fill in:

```env
PORT=3000
COGNODB_URI=bolt+s://your-instance-id.databases.cognodb.cloud
COGNODB_USERNAME=cognodb
COGNODB_PASSWORD=your-password
```

Never commit `.env`.

### 4. Seed the graph

```bash
npm run seed
```

The seed script creates a fictional e-commerce architecture called **ShopFlow**.

### 5. Run

```bash
npm start
```

Open:

```text
http://localhost:3000
```

For development:

```bash
npm run dev
```

## Demo flow

1. Open the Architecture Graph.
2. Click **Redis**.
3. The graph focuses on Redis and its neighborhood.
4. Click **Analyze impact**.
5. Inspect direct and indirect affected services.
6. Select two components in the dependency-path controls.
7. Click **Find path** to display the shortest graph path.

## Error handling

The backend checks CognoDB connectivity through `/api/health`. Database failures return a controlled `503` response instead of exposing driver errors to the user.

## Security

Connection credentials are loaded exclusively from environment variables. No credentials are included in source code.

All Cypher queries use parameters through the official Neo4j driver.

## Screenshots

Add screenshots here before submission, for example:

```text
docs/
├── dashboard.png
├── impact-analysis.png
└── dependency-path.png
```

## Technology

- Node.js
- Express
- Neo4j JavaScript Driver
- CognoDB
- openCypher
- D3.js
- Tailwind CSS

## Assignment

Built as a take-home project demonstrating graph data modeling, multi-hop traversal, parameterized Cypher, backend architecture, error handling and an interactive graph-oriented UI.
