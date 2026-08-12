import { runQuery, closeDatabase } from "../src/db.js";

const components = [
  { id: "api-gateway", name: "API Gateway", type: "API", description: "Public entry point for ShopFlow clients.", owner: "Platform Team" },
  { id: "user-service", name: "User Service", type: "Service", description: "Handles identity, profiles and account data.", owner: "Core Team" },
  { id: "product-service", name: "Product Service", type: "Service", description: "Manages products, inventory and catalog search.", owner: "Commerce Team" },
  { id: "order-service", name: "Order Service", type: "Service", description: "Creates and manages customer orders.", owner: "Commerce Team" },
  { id: "payment-service", name: "Payment Service", type: "Service", description: "Processes checkout payments.", owner: "Payments Team" },
  { id: "notification-service", name: "Notification Service", type: "Service", description: "Sends transactional email and notifications.", owner: "Platform Team" },
  { id: "recommendation-service", name: "Recommendation Service", type: "Service", description: "Generates personalized product recommendations.", owner: "AI Team" },
  { id: "postgres", name: "PostgreSQL", type: "Database", description: "Primary relational store for users and orders.", owner: "Data Team" },
  { id: "mongodb", name: "MongoDB", type: "Database", description: "Document store for the product catalog.", owner: "Data Team" },
  { id: "redis", name: "Redis", type: "Database", description: "Cache and short-lived state store.", owner: "Platform Team" },
  { id: "vector-db", name: "Vector Database", type: "Database", description: "Stores embeddings for recommendations.", owner: "AI Team" },
  { id: "stripe-api", name: "Stripe API", type: "API", description: "External payment provider.", owner: "Payments Team" },
  { id: "email-api", name: "Email API", type: "API", description: "External transactional email provider.", owner: "Platform Team" },
  { id: "nodejs", name: "Node.js", type: "Library", description: "JavaScript runtime used by backend services.", owner: "Platform Team" },
  { id: "python", name: "Python", type: "Library", description: "Runtime used by the recommendation service.", owner: "AI Team" },
  { id: "shopflow", name: "ShopFlow", type: "Project", description: "Fictional e-commerce platform.", owner: "Engineering" }
];

const relationships = [
  ["api-gateway", "CALLS", "user-service"],
  ["api-gateway", "CALLS", "product-service"],
  ["api-gateway", "CALLS", "order-service"],
  ["api-gateway", "CALLS", "payment-service"],

  ["user-service", "DEPENDS_ON", "postgres"],
  ["user-service", "USES", "nodejs"],

  ["product-service", "DEPENDS_ON", "mongodb"],
  ["product-service", "USES", "nodejs"],

  ["order-service", "DEPENDS_ON", "postgres"],
  ["order-service", "DEPENDS_ON", "redis"],
  ["order-service", "USES", "nodejs"],

  ["payment-service", "CALLS", "stripe-api"],
  ["payment-service", "DEPENDS_ON", "order-service"],
  ["payment-service", "USES", "nodejs"],

  ["notification-service", "DEPENDS_ON", "redis"],
  ["notification-service", "CALLS", "email-api"],
  ["notification-service", "USES", "nodejs"],

  ["recommendation-service", "DEPENDS_ON", "vector-db"],
  ["recommendation-service", "CALLS", "product-service"],
  ["recommendation-service", "USES", "python"],

  ["user-service", "PART_OF", "shopflow"],
  ["product-service", "PART_OF", "shopflow"],
  ["order-service", "PART_OF", "shopflow"],
  ["payment-service", "PART_OF", "shopflow"],
  ["notification-service", "PART_OF", "shopflow"],
  ["recommendation-service", "PART_OF", "shopflow"]
];

async function seed() {
  console.log("Clearing existing ImpactGraph data...");
  await runQuery(`MATCH (n) DETACH DELETE n`);

  console.log("Creating constraints...");
  await runQuery(`
    CREATE CONSTRAINT component_id_unique IF NOT EXISTS
    FOR (c:Component) REQUIRE c.id IS UNIQUE
  `);

  console.log(`Creating ${components.length} components...`);

  await runQuery(`
    UNWIND $components AS item
    CREATE (c:Component {
      id: item.id,
      name: item.name,
      type: item.type,
      description: item.description,
      owner: item.owner
    })
  `, { components });

  console.log(`Creating ${relationships.length} relationships...`);

  for (const [source, type, target] of relationships) {
    await runQuery(`
      MATCH (a:Component {id: $source})
      MATCH (b:Component {id: $target})
      CREATE (a)-[r:${type}]->(b)
      SET r.createdAt = datetime()
    `, { source, target });
  }

  console.log("Seed complete.");
  await closeDatabase();
}

seed().catch(async error => {
  console.error("Seed failed:", error);
  await closeDatabase();
  process.exit(1);
});
