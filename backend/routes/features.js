const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const { requireRole, requireAuth, getUserRole } = require('../roles');

const router = express.Router();
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'features';
const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

// Log endpoint status only in development
if (process.env.NODE_ENV === 'development') {
  console.log('[Features] Endpoint:', endpoint);
  console.log('[Features] Container:', containerId);
}

// GET all features - PUBLIC endpoint for permission service (only requires authentication)
router.get('/public', requireAuth(), async (req, res) => {
  try {
    console.log('[Features] 🔍 PUBLIC GET request received for permission service');
    
    // Test simple query first
    console.log('[Features] 🧪 Testing simple query: SELECT * FROM c');
    const { resources } = await container.items.query('SELECT * FROM c').fetchAll();
    
    console.log('[Features] ✅ PUBLIC Query successful');
    console.log('[Features] 📈 Resources count:', resources.length);
    console.log('[Features] 🎯 First resource sample:', resources[0] ? { id: resources[0].id, name: resources[0].name } : 'No resources');
    
    res.json(resources);
  } catch (err) {
    console.error('[Features] ❌ PUBLIC Error details:');
    console.error('[Features] ❌ Error message:', err.message);
    console.error('[Features] ❌ Error stack:', err.stack);
    console.error('[Features] ❌ Error code:', err.code);
    console.error('[Features] ❌ Error details:', err.details);
    
    res.status(500).json({ 
      error: err.message,
      details: err.details || 'No additional details',
      code: err.code || 'Unknown error code'
    });
  }
});

// GET all features - requires authentication and admin role
router.get('/', requireAuth(), requireRole(['system_admin', 'global_engineer']), async (req, res) => {
  try {
    console.log('[Features] 🔍 GET request received');
    console.log('[Features] 📊 Container ID:', containerId);
    console.log('[Features] 🗄️ Database ID:', databaseId);
    console.log('[Features] 🔑 Endpoint:', endpoint ? 'Set' : 'Not Set');
    
    // Test simple query first
    console.log('[Features] 🧪 Testing simple query: SELECT * FROM c');
    const { resources } = await container.items.query('SELECT * FROM c').fetchAll();
    
    console.log('[Features] ✅ Query successful');
    console.log('[Features] 📈 Resources count:', resources.length);
    console.log('[Features] 🎯 First resource sample:', resources[0] ? { id: resources[0].id, name: resources[0].name } : 'No resources');
    
    res.json(resources);
  } catch (err) {
    console.error('[Features] ❌ Error details:');
    console.error('[Features] ❌ Error message:', err.message);
    console.error('[Features] ❌ Error stack:', err.stack);
    console.error('[Features] ❌ Error code:', err.code);
    console.error('[Features] ❌ Error details:', err.details);
    
    // Check if it's a Cosmos DB specific error
    if (err.message && err.message.includes('composite index')) {
      console.error('[Features] 🚨 COSMOS DB COMPOSITE INDEX ERROR DETECTED');
      console.error('[Features] 🚨 This suggests ORDER BY clauses are still present somewhere');
    }
    
    res.status(500).json({ 
      error: err.message,
      details: err.details || 'No additional details',
      code: err.code || 'Unknown error code'
    });
  }
});

// GET feature by ID - PUBLIC endpoint for permission service
router.get('/public/:id', requireAuth(), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[Features] PUBLIC GET request for feature ID:', id);
    
    try {
      // First try: direct read with single parameter
      const { resource } = await container.item(id).read();
      res.json(resource);
    } catch (directError) {
      // Fallback: query approach
      const { resources } = await container.items.query(
        `SELECT * FROM c WHERE c.id = "${id}"`
      ).fetchAll();
      
      if (resources.length === 0) {
        return res.status(404).json({ error: 'Feature not found' });
      }
      
      res.json(resources[0]);
    }
  } catch (err) {
    console.error('[Features] PUBLIC Error:', err);
    res.status(404).json({ error: 'Feature not found' });
  }
});

// GET feature by ID
router.get('/:id', requireAuth(), requireRole(['system_admin', 'global_engineer']), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[Features] GET request for feature ID:', id);
    
    try {
      // First try: direct read with single parameter
      const { resource } = await container.item(id).read();
      res.json(resource);
    } catch (directError) {
      // Fallback: query approach
      const { resources } = await container.items.query(
        `SELECT * FROM c WHERE c.id = "${id}"`
      ).fetchAll();
      
      if (resources.length === 0) {
        return res.status(404).json({ error: 'Feature not found' });
      }
      
      res.json(resources[0]);
    }
  } catch (err) {
    console.error('[Features] Error:', err);
    res.status(404).json({ error: 'Feature not found' });
  }
});

// POST (create new feature) - requires system admin
router.post('/', requireAuth(), requireRole(['system_admin']), async (req, res) => {
  try {
    console.log('[Features] POST request received:', req.body);
    
    // Validate feature data
    const { name, displayName, description, category, permissions, isActive = true } = req.body;
    
    if (!name || !displayName || !category) {
      return res.status(400).json({ error: 'Missing required fields: name, displayName, category' });
    }
    
    // Check if feature name already exists
    const { resources: existingFeatures } = await container.items.query(
      `SELECT * FROM c WHERE c.name = "${name}"`
    ).fetchAll();
    
    if (existingFeatures.length > 0) {
      return res.status(409).json({ error: 'Feature with this name already exists' });
    }
    
    const featureData = {
      id: name, // Use name as ID for consistency
      name,
      displayName,
      description: description || '',
      category: category || 'general',
      permissions: permissions || [],
      isActive,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.user?.id || 'system',
      updatedBy: req.user?.id || 'system'
    };
    
    const { resource } = await container.items.create(featureData);
    res.status(201).json(resource);
  } catch (err) {
    console.error('[Features] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT (update feature) - requires system admin
router.put('/:id', requireAuth(), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 [Features] PUT request for feature ID:', id);
    console.log('📊 [Features] Request body:', JSON.stringify(req.body, null, 2));
    console.log('👤 [Features] User ID:', req.userId);
    console.log('🔑 [Features] User object:', req.user);
    
    // Check authorization (same pattern as users and roles)
    const userId = req.userId;
    console.log('🔍 [Features] Checking authorization for user:', userId);
    
    let userRole;
    try {
      console.log('🔍 [Features] Calling getUserRole...');
      userRole = await getUserRole(userId);
      console.log(`✅ [Features] getUserRole returned: ${userRole}`);
    } catch (roleError) {
      console.error(`❌ [Features] Error getting user role:`, roleError);
      console.error(`❌ [Features] Role error stack:`, roleError.stack);
      // In development, continue with system_admin role
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 [Features] Development mode - setting userRole to system_admin');
        userRole = 'system_admin';
      } else {
        console.log('❌ [Features] Production mode - returning error');
        return res.status(500).json({ error: 'Failed to get user role' });
      }
    }

    // Authorization check - only system_admin can update features
    const isAuthorized = process.env.NODE_ENV === 'development' || userRole === 'system_admin';
    console.log(`🔍 [Features] Authorization check:`, { isAuthorized, userRole, NODE_ENV: process.env.NODE_ENV });
    
    if (!isAuthorized) {
      console.log(`❌ [Features] Authorization failed. User: ${userId}, Role: ${userRole}`);
      return res.status(403).json({ error: 'Forbidden - insufficient permissions' });
    }
    
    console.log('✅ [Features] Authorization passed, proceeding with feature update');
    
    // Get existing feature
    console.log('🔍 [Features] Reading existing feature from database...');
    console.log('🔍 [Features] Container:', containerId);
    console.log('🔍 [Features] Database:', databaseId);
    console.log('🔍 [Features] Using query approach instead of container.item()');
    
    // Try to find the feature using working methods
    let existingFeature;
    
    try {
      // First try: direct read with single parameter (this works!)
      console.log('🔍 [Features] Trying direct read with container.item(id)...');
      const { resource } = await container.item(id).read();
      if (resource) {
        existingFeature = resource;
        console.log('✅ [Features] Feature found using container.item(id)');
      } else {
        console.log('❌ [Features] Direct read returned undefined, falling back to query...');
        throw new Error('Resource is undefined');
      }
    } catch (directError) {
      console.log('❌ [Features] Direct read failed:', directError.message);
      
      // Second try: direct string query (this works!)
      console.log('🔍 [Features] Trying direct string query...');
      let { resources } = await container.items.query(
        `SELECT * FROM c WHERE c.id = "${id}"`
      ).fetchAll();
      
      if (resources.length === 0) {
        console.log('🔍 [Features] Feature not found by ID, trying by name...');
        const { resources: byName } = await container.items.query(
          `SELECT * FROM c WHERE c.name = "${id}"`
        ).fetchAll();
        
        if (byName.length > 0) {
          console.log('✅ [Features] Feature found by name instead of ID');
          resources = byName;
        }
      }
      
      if (resources.length === 0) {
        console.log('❌ [Features] Feature not found in database by ID or name');
        return res.status(404).json({ error: 'Feature not found' });
      }
      
      existingFeature = resources[0];
    }
    
    if (!existingFeature) {
      console.log('❌ [Features] existingFeature is undefined, cannot proceed');
      return res.status(500).json({ error: 'Feature lookup failed' });
    }
    
    console.log('✅ [Features] Existing feature read successfully:', {
      id: existingFeature.id,
      name: existingFeature.name,
      displayName: existingFeature.displayName,
      category: existingFeature.category
    });
    
    // Update feature data
    console.log('🔍 [Features] Preparing updated feature data...');
    const updatedFeature = {
      ...existingFeature,
      ...req.body,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.id || 'system'
    };
    console.log('✅ [Features] Updated feature data prepared:', {
      id: updatedFeature.id,
      name: updatedFeature.name,
      displayName: updatedFeature.displayName,
      category: updatedFeature.category
    });
    
    // Validate required fields
    console.log('🔍 [Features] Validating required fields...');
    if (!updatedFeature.name || !updatedFeature.displayName || !updatedFeature.category) {
      console.log('❌ [Features] Missing required fields:', {
        name: !!updatedFeature.name,
        displayName: !!updatedFeature.displayName,
        category: !!updatedFeature.category
      });
      return res.status(400).json({ error: 'Missing required fields: name, displayName, category' });
    }
    console.log('✅ [Features] Required fields validation passed');
    
    // Perform the update
    console.log('🔍 [Features] Performing database update...');
    console.log('🔍 [Features] Using upsert approach instead of container.item()');
    console.log('🔍 [Features] Update data size:', JSON.stringify(updatedFeature).length, 'characters');
    
    // Use upsert instead of replace which is failing
    const { resource } = await container.items.upsert(updatedFeature);
    console.log('✅ [Features] Feature updated successfully in database:', {
      id: resource.id,
      name: resource.name,
      updatedAt: resource.updatedAt
    });
    
    res.json(resource);
  } catch (err) {
    console.error('❌ [Features] Error occurred during feature update:');
    console.error('❌ [Features] Error message:', err.message);
    console.error('❌ [Features] Error code:', err.code);
    console.error('❌ [Features] Error status code:', err.statusCode);
    console.error('❌ [Features] Error stack:', err.stack);
    console.error('❌ [Features] Error details:', err.details);
    console.error('❌ [Features] Full error object:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    
    res.status(500).json({ 
      error: err.message,
      code: err.code || 'Unknown',
      details: err.details || 'No additional details'
    });
  }
});

// DELETE feature - requires system admin
router.delete('/:id', requireAuth(), requireRole(['system_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[Features] DELETE request for feature ID:', id);
    
    // Check if feature is referenced by any roles
    const rolesContainer = database.container('roles');
    const { resources: rolesWithFeature } = await rolesContainer.items.query(
      `SELECT * FROM c WHERE ARRAY_CONTAINS("${id}", c.permissions)`
    ).fetchAll();
    
    if (rolesWithFeature.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete feature - it is currently assigned to roles',
        rolesCount: rolesWithFeature.length
      });
    }
    
    await container.item(id, id).delete();
    res.status(204).end();
  } catch (err) {
    console.error('[Features] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET features by category - PUBLIC endpoint for permission service
router.get('/public/category/:category', requireAuth(), async (req, res) => {
  try {
    const { category } = req.params;
    console.log('[Features] PUBLIC GET request for category:', category);
    
    const { resources } = await container.items.query(
      `SELECT * FROM c WHERE c.category = "${category}"`
    ).fetchAll();
    
    res.json(resources);
  } catch (err) {
    console.error('[Features] PUBLIC Category Error:', err);
    res.status(500).json({ error: 'Failed to fetch features by category' });
  }
});

// GET features by category
router.get('/category/:category', requireAuth(), requireRole(['system_admin', 'global_engineer']), async (req, res) => {
  try {
    const { category } = req.params;
    console.log('[Features] GET request for category:', category);
    const { resources } = await container.items.query(
      'SELECT * FROM c WHERE c.category = @category AND c.isActive = true',
      [{ name: '@category', value: category }]
    ).fetchAll();
    res.json(resources);
  } catch (err) {
    console.error('[Features] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET all feature categories - PUBLIC endpoint for permission service
router.get('/public/categories/list', requireAuth(), async (req, res) => {
  try {
    console.log('[Features] PUBLIC GET request for categories list');
    
    const { resources } = await container.items.query('SELECT DISTINCT c.category FROM c').fetchAll();
    const categories = resources.map(item => item.category).filter(Boolean);
    
    res.json(categories);
  } catch (err) {
    console.error('[Features] PUBLIC Categories List Error:', err);
    res.status(500).json({ error: 'Failed to fetch feature categories' });
  }
});

// GET all feature categories
router.get('/categories/list', requireAuth(), requireRole(['system_admin', 'global_engineer']), async (req, res) => {
  try {
    console.log('[Features] GET categories request');
    const { resources } = await container.items.query(
      'SELECT DISTINCT c.category FROM c WHERE c.isActive = true'
    ).fetchAll();
    const categories = resources.map(r => r.category);
    res.json(categories);
  } catch (err) {
    console.error('[Features] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
