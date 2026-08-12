# ImpactGraph

> See what breaks before you ship.

ImpactGraph is a graph-based architecture dependency analysis tool built with **CognoDB**, **openCypher**, and the official **Neo4j JavaScript driver**.

It allows developers to explore application architecture, understand component relationships, calculate dependency blast radius, and find multi-hop dependency paths through an interactive graph.

## Demo

- **Live Demo:** `ADD_DEPLOYED_URL_HERE`
- **GitHub:** `ADD_GITHUB_REPO_URL_HERE`

---

## Why ImpactGraph?

Modern applications are made up of interconnected services, APIs, databases, libraries, and external systems.

When one component changes or becomes unavailable, developers often need to manually trace dependencies across multiple services to understand the possible impact.

ImpactGraph models these dependencies as a **graph** and makes those relationships directly explorable.

For example:

```text
Payment Service
       |
       | DEPENDS_ON
       v
Order Service
       |
       | DEPENDS_ON
       v
PostgreSQL
```

If PostgreSQL becomes unavailable, ImpactGraph can identify both the directly and indirectly affected services.

---

## Why a Graph Database?

The interesting part of this problem is not simply storing components. It is understanding the **relationships between components**.

A relational database could store components and dependency records, but recursive dependency analysis would require repeated self-joins or application-side traversal logic.

With a graph database, relationships are first-class entities and multi-hop traversal can be expressed naturally using Cypher.

For example:

```cypher
MATCH (target:Component {id: $id})
MATCH p =
  (affected:Component)-[:DEPENDS_ON|CALLS|USES*1..5]->(target)
WHERE affected.id <> target.id
  AND affected.type = "Service"
RETURN affected, min(length(p)) AS distance
ORDER BY distance, affected.name
```

This allows ImpactGraph to answer questions such as:

- Which services depend directly on this component?
- Which services depend on it indirectly?
- What is the blast radius of a component?
- How many hops away is a dependent service?
- What is the shortest dependency path between two components?

These are relationship-heavy queries where a graph model provides a natural representation of the problem.

---

## Features

### Interactive Architecture Graph

Explore the complete application architecture as an interactive graph.

Components are represented as nodes and dependencies are represented as typed relationships.

### Component Inspection

Select a component to inspect:

- Component type
- Description
- Owner
- Blast radius

### Blast Radius Analysis

Select a component and analyze its downstream impact.

ImpactGraph identifies:

- Total affected services
- Direct dependents
- Indirect dependents
- Dependency distance in hops

### Multi-Hop Dependency Traversal

ImpactGraph can traverse multiple relationships to identify indirect dependencies.

For example:

```text
Payment Service
      |
      | 2 hops
      v
PostgreSQL
```

### Shortest Dependency Path

Find the shortest relationship path between two components.

Example:

```text
API Gateway
     |
    CALLS
     v
User Service
     |
 DEPENDS_ON
     v
PostgreSQL
```

### Search

Search for components directly from the architecture explorer.

### Component Filtering

Filter the graph by component type:

- Services
- APIs
- Databases
- Libraries
- Projects

### Graph Interaction

The graph supports:

- Node selection
- Neighborhood highlighting
- Dependency exploration
- Visual focus
- Zoom controls
- Reset view

---

## Graph Data Model

ImpactGraph uses a component-and-relationship graph model.

### Nodes

Architecture entities are represented as `Component` nodes:

```cypher
(:Component)
```

Each component contains properties such as:

```text
id
name
type
description
owner
```

The `type` property identifies the kind of architecture component.

Examples:

```text
Service
API
Database
Library
Project
```

### Relationships

Dependencies are represented using typed relationships:

```cypher
(:Component)-[:DEPENDS_ON]->(:Component)

(:Component)-[:CALLS]->(:Component)

(:Component)-[:USES]->(:Component)

(:Component)-[:PART_OF]->(:Component)
```

### Example Model

```text
                  ┌──────────────┐
                  │   ShopFlow   │
                  │   Project    │
                  └──────┬───────┘
                         │ PART_OF
                         │
             ┌───────────┴───────────┐
             │                       │
             v                       v
      ┌─────────────┐         ┌─────────────┐
      │ User Service│         │Order Service│
      └──────┬──────┘         └──────┬──────┘
             │                       │
             │ DEPENDS_ON            │ DEPENDS_ON
             v                       v
       ┌────────────┐          ┌────────────┐
       │ PostgreSQL │          │   Redis    │
       └────────────┘          └────────────┘
```

---

## Example Architecture

The seeded dataset represents a realistic e-commerce-style application called **ShopFlow**.

It contains components such as:

- API Gateway
- User Service
- Order Service
- Payment Service
- Product Service
- Notification Service
- Recommendation Service
- PostgreSQL
- MongoDB
- Redis
- Stripe API
- Email API
- Node.js
- Python
- ShopFlow

The seed dataset contains:

- **16 components**
- **26 relationships**

---

## Example: Blast Radius

Suppose PostgreSQL becomes unavailable.

ImpactGraph can identify the services affected by the dependency.

Example:

```text
PostgreSQL

Affected:  3
Direct:    2
Indirect:  1
```

Example dependency distances:

```text
Order Service       1 hop
User Service        1 hop
Payment Service     2 hops
```

This demonstrates how graph traversal can identify both direct and indirect dependencies.

---

## Example: Shortest Path

ImpactGraph can find the shortest relationship path between two components.

For example:

```text
API Gateway
     |
   CALLS
     v
User Service
     |
 DEPENDS_ON
     v
PostgreSQL
```

The path is calculated directly from the graph using Cypher.

---

# Technology Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Graph Visualization | D3.js |
| Backend | Node.js, Express.js |
| Database | CognoDB |
| Query Language | openCypher |
| Database Driver | Official Neo4j JavaScript Driver |
| Protocol | Bolt |

### Architecture

```text
┌──────────────────────┐
│      Browser         │
│  ImpactGraph UI      │
└──────────┬───────────┘
           │ HTTP
           ▼
┌──────────────────────┐
│   Node.js / Express  │
│       Backend        │
└──────────┬───────────┘
           │
           │ Neo4j JS Driver
           │ Bolt
           ▼
┌──────────────────────┐
│       CognoDB        │
│    Graph Database    │
└──────────────────────┘
```

---

## Project Structure

```text
impactgraph/
│
├── public/
│   ├── index.html
│   └── app.js
│
├── src/
│   ├── config/
│   │   └── env.js
│   │
│   ├── routes/
│   │   └── graph.js
│   │
│   ├── services/
│   │   └── graphService.js
│   │
│   ├── utils/
│   │   └── neo4j.js
│   │
│   ├── db.js
│   └── server.js
│
├── scripts/
│   └── seed.js
│
├── queries/
│   ├── impact.cypher
│   ├── neighborhood.cypher
│   └── shortest-path.cypher
│
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

---

## Key Cypher Queries

### 1. Component Neighborhood

Retrieves components directly connected to a selected component.

```cypher
MATCH (n:Component {id: $id})-[r]-(neighbor:Component)
RETURN n, r, neighbor
```

This powers component exploration in the graph interface.

---

### 2. Blast Radius

Impact analysis uses a variable-length graph traversal:

```cypher
MATCH (target:Component {id: $id})
MATCH p =
  (affected:Component)-[:DEPENDS_ON|CALLS|USES*1..5]->(target)
WHERE affected.id <> target.id
  AND affected.type = "Service"
RETURN affected, min(length(p)) AS distance
ORDER BY distance, affected.name
```

The path length is used to distinguish direct and indirect impact.

---

### 3. Shortest Dependency Path

The application uses a shortest-path traversal to find the minimum relationship path between two components.

```cypher
MATCH (source:Component {id: $sourceId}),
      (target:Component {id: $targetId}),
      p = shortestPath(
        (source)-[:DEPENDS_ON|CALLS|USES|PART_OF*..10]-(target)
      )
RETURN p
```

---

## Parameterized Queries

All user-provided values are passed to Cypher as parameters rather than concatenated into query strings.

Example:

```javascript
const result = await session.run(query, {
  id: componentId
});
```

This keeps queries safer and easier to maintain.

---

## Seed Data

The repository includes a seed script that creates the example architecture.

Run:

```bash
npm run seed
```

The seed script:

1. Clears the existing ImpactGraph dataset
2. Creates constraints
3. Creates architecture components
4. Creates typed relationships
5. Reports the seed status

The dataset is intentionally small enough to run comfortably on the CognoDB free tier while still demonstrating meaningful graph traversal.

---

## Getting Started

### Prerequisites

You need:

- Node.js 18+
- A CognoDB Cloud account
- A CognoDB free C0 instance

---

### 1. Clone the Repository

```bash
git clone YOUR_REPOSITORY_URL
cd impactgraph
```

---

### 2. Install Dependencies

```bash
npm install
```

---

### 3. Create a CognoDB Instance

Create a free instance from:

https://console.cognodb.com/

The CognoDB C0 free tier does not require a credit card.

After creating the instance, save the generated:

- Bolt URI
- Username
- Password

**Important:** CognoDB displays the generated password only once, so save it immediately.

---

### 4. Configure Environment Variables

Create your `.env` file from the example:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Configure:

```env
PORT=3000

COGNODB_URI=bolt+s://YOUR-INSTANCE-ID.databases.cognodb.cloud
COGNODB_USERNAME=cognodb
COGNODB_PASSWORD=YOUR_PASSWORD
```

Never commit `.env` to GitHub.

---

### 5. Seed the Database

```bash
npm run seed
```

Expected output:

```text
Clearing existing ImpactGraph data...
Creating constraints...
Creating 16 components...
Creating 26 relationships...
Seed complete.
```

---

### 6. Start the Application

```bash
npm start
```

Open:

```text
http://localhost:3000
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Port used by the Express server |
| `COGNODB_URI` | CognoDB Bolt connection URI |
| `COGNODB_USERNAME` | CognoDB username |
| `COGNODB_PASSWORD` | CognoDB password |

Database credentials are loaded from environment variables and are never stored in the source code.

---

## Error Handling

ImpactGraph handles database connectivity failures through the application UI.

If CognoDB becomes unavailable, the application displays a user-friendly connection error instead of exposing raw database errors.

The application also verifies the graph database connection during startup.

---

## Screenshots

### Architecture Overview

Add your architecture screenshot here:

```markdown
![ImpactGraph Architecture](screenshots/architecture.png)
```

### Impact Analysis

Add your PostgreSQL impact-analysis screenshot here:

```markdown
![Impact Analysis](screenshots/impact-analysis.png)
```

### Dependency Path

Add your shortest-path screenshot here:

```markdown
![Dependency Path](screenshots/dependency-path.png)
```

---

## Design Decisions

### Simple Component Model

ImpactGraph uses a common `Component` node with a `type` property.

This keeps the graph model simple while allowing different architecture entities such as services, APIs, databases, libraries, and projects to be represented consistently.

### Typed Relationships

Different relationship types represent different architectural meanings:

| Relationship | Meaning |
|---|---|
| `DEPENDS_ON` | One component depends on another |
| `CALLS` | One component invokes another |
| `USES` | One component uses another |
| `PART_OF` | A component belongs to a larger project/component |

Keeping these relationships explicit makes graph traversal more meaningful.

### Why Multi-Hop Traversal?

The main purpose of ImpactGraph is to understand indirect dependencies.

For example:

```text
Payment Service
       |
       | DEPENDS_ON
       v
Order Service
       |
       | DEPENDS_ON
       v
PostgreSQL
```

Payment Service is not directly connected to PostgreSQL, but a graph traversal can discover the two-hop dependency.

This is the core reason a graph database is useful for the application.

---

## Author

**Munazza Sultana**

Built for the **WEXA AI CognoDB Take-Home Assignment**.

**ImpactGraph — See what breaks before you ship.**
