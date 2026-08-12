import neo4j from "neo4j-driver";
import { config } from "./config/env.js";

let driver;

export function getDriver() {
  if (!driver) {
    if (!config.uri || !config.password) {
      throw new Error("CognoDB connection variables are missing.");
    }

    driver = neo4j.driver(
      config.uri,
      neo4j.auth.basic(config.username, config.password),
      {
        maxConnectionPoolSize: 20,
        connectionAcquisitionTimeout: 5000
      }
    );
  }

  return driver;
}

export async function verifyDatabase() {
  const d = getDriver();
  await d.verifyConnectivity();
  return true;
}

export async function runQuery(cypher, params = {}) {
  const session = getDriver().session();
  try {
    const result = await session.run(cypher, params);
    return result.records;
  } finally {
    await session.close();
  }
}

export async function closeDatabase() {
  if (driver) {
    await driver.close();
    driver = undefined;
  }
}
