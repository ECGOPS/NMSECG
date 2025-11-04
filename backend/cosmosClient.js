require('dotenv').config();
const { CosmosClient } = require('@azure/cosmos');

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = process.env.COSMOS_DB_CONTAINER;

const client = new CosmosClient({ endpoint, key });

/**
 * Get a Cosmos DB container by name
 * @param {string} [containerName] - Optional container name. If not provided, uses default from env.
 * @returns {Container} Cosmos DB container instance
 */
function getContainer(containerName) {
  const database = client.database(databaseId);
  
  // If no container name provided, use default from env
  if (!containerName) {
    return database.container(containerId);
  }
  
  // Use the provided container name
  return database.container(containerName);
}

/**
 * Ensure a Cosmos DB container exists, creating it if necessary
 * @param {string} containerName - Container name to ensure exists
 * @param {object} [options] - Optional container configuration
 * @returns {Promise<Container>} Cosmos DB container instance
 */
async function ensureContainerExists(containerName, options = {}) {
  const database = client.database(databaseId);
  
  // Default configuration for settings container
  const defaultConfig = {
    id: containerName,
    partitionKey: {
      paths: ['/id'] // Use 'id' as partition key (common for settings/configuration items)
    }
  };
  
  // Merge with provided options
  const containerConfig = {
    ...defaultConfig,
    ...options,
    id: containerName // Ensure ID matches
  };
  
  try {
    const { container } = await database.containers.createIfNotExists(containerConfig);
    console.log(`[CosmosClient] Container '${containerName}' ensured (created or already exists)`);
    return container;
  } catch (error) {
    console.error(`[CosmosClient] Error ensuring container '${containerName}':`, error);
    throw error;
  }
}

module.exports = { client, getContainer, ensureContainerExists }; 