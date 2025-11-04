const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const { requireRole, requireAuth, getUserRole } = require('../roles');

const router = express.Router();
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'roles';
const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

// Log endpoint status only in development
if (process.env.NODE_ENV === 'development') {
  console.log('[Roles] Endpoint:', endpoint);
  console.log('[Roles] Container:', containerId);
}

// GET all roles - PUBLIC endpoint for permission service (only requires authentication)
router.get('/public', requireAuth(), async (req, res) => {
  try {
    console.log('[Roles] 🔍 PUBLIC GET request received for permission service');
    console.log('[Roles] 📊 Container ID:', containerId);
    console.log('[Roles] 🗄️ Database ID:', databaseId);
    console.log('[Roles] 🔑 Endpoint:', endpoint ? 'Set' : 'Not Set');
    
    // Test simple query first
    console.log('[Roles] 🧪 Testing simple query: SELECT * FROM c');
    const { resources } = await container.items.query('SELECT * FROM c').fetchAll();
    
    console.log('[Roles] ✅ PUBLIC Query successful');
    console.log('[Roles] 📈 Resources count:', resources.length);
    console.log('[Roles] 🎯 First resource sample:', resources[0] ? { id: resources[0].id, name: resources[0].name } : 'No resources');
    
    res.json(resources);
  } catch (err) {
    console.error('[Roles] ❌ PUBLIC Error details:');
    console.error('[Roles] ❌ Error message:', err.message);
    console.error('[Roles] ❌ Error stack:', err.stack);
    console.error('[Roles] ❌ Error code:', err.code);
    console.error('[Roles] ❌ Error details:', err.details);
    
    res.status(500).json({ 
      error: err.message,
      details: err.details || 'No additional details',
      code: err.code || 'Unknown error code'
    });
  }
});

// GET all roles - requires authentication and admin role
router.get('/', requireAuth(), requireRole(['system_admin', 'global_engineer']), async (req, res) => {
  try {
    console.log('[Roles] 🔍 GET request received');
    console.log('[Roles] 📊 Container ID:', containerId);
    console.log('[Roles] 🗄️ Database ID:', databaseId);
    console.log('[Roles] 🔑 Endpoint:', endpoint ? 'Set' : 'Not Set');
    
    // Test simple query first
    console.log('[Roles] 🧪 Testing simple query: SELECT * FROM c');
    const { resources } = await container.items.query('SELECT * FROM c').fetchAll();
    
    console.log('[Roles] ✅ Query successful');
    console.log('[Roles] 📈 Resources count:', resources.length);
    console.log('[Roles] 🎯 First resource sample:', resources[0] ? { id: resources[0].id, name: resources[0].name } : 'No resources');
    
    res.json(resources);
  } catch (err) {
    console.error('[Roles] ❌ Error details:');
    console.error('[Roles] ❌ Error message:', err.message);
    console.error('[Roles] ❌ Error stack:', err.stack);
    console.error('[Roles] ❌ Error code:', err.code);
    console.error('[Roles] ❌ Error details:', err.details);
    
    // Check if it's a Cosmos DB specific error
    if (err.message && err.message.includes('composite index')) {
      console.error('[Roles] 🚨 COSMOS DB COMPOSITE INDEX ERROR DETECTED');
      console.error('[Roles] 🚨 This suggests ORDER BY clauses are still present somewhere');
    }
    
    res.status(500).json({ 
      error: err.message,
      details: err.details || 'No additional details',
      code: err.code || 'Unknown error code'
    });
  }
});

// GET role by ID
router.get('/:id', requireAuth(), requireRole(['system_admin', 'global_engineer']), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[Roles] GET request for role ID:', id);
    
    let resource;
    try {
      // First try: direct read with single parameter
      const result = await container.item(id).read();
      resource = result.resource;
    } catch (directError) {
      console.log('[Roles] Direct read failed, trying query approach...');
      // Fallback: query approach
      const { resources } = await container.items.query(
        `SELECT * FROM c WHERE c.id = "${id}"`
      ).fetchAll();
      resource = resources[0];
    }
    
    if (!resource) {
      console.log('[Roles] Role not found:', id);
      return res.status(404).json({ error: 'Role not found' });
    }
    
    console.log('[Roles] Role found:', resource.name);
    res.json(resource);
  } catch (err) {
    console.error('[Roles] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST (create new role) - requires system admin
router.post('/', requireAuth(), requireRole(['system_admin']), async (req, res) => {
  try {
    console.log('[Roles] POST request received:', req.body);
    
    // Validate role data
    const { name, displayName, description, priority, permissions, allowedRegions, allowedDistricts, accessLevel, isActive = true } = req.body;
    
    if (!name || !displayName || !priority || !accessLevel) {
      return res.status(400).json({ error: 'Missing required fields: name, displayName, priority, accessLevel' });
    }
    
    // Validate access level and regions/districts
    if (accessLevel === 'global') {
      // Global roles can access everything
      if (allowedRegions && allowedRegions.length > 0) {
        console.log('[Roles] Warning: Global role with specific regions specified');
      }
      if (allowedDistricts && allowedDistricts.length > 0) {
        console.log('[Roles] Warning: Global role with specific districts specified');
      }
    } else if (accessLevel === 'regional') {
      // Regional roles must have at least one region
      if (!allowedRegions || allowedRegions.length === 0) {
        return res.status(400).json({ error: 'Regional roles must specify at least one allowed region' });
      }
    } else if (accessLevel === 'district') {
      // District roles can work at district level without specifying exact districts
      // This allows roles like 'technician' to work in any district they're assigned to
      if (allowedDistricts && allowedDistricts.length > 0) {
        console.log('[Roles] District role with specific districts:', allowedDistricts);
      } else {
        console.log('[Roles] District role without specific districts - will work in assigned districts');
      }
    } else {
      return res.status(400).json({ error: 'Invalid accessLevel. Must be global, regional, or district' });
    }
    
    // Check if role name already exists
    const { resources: existingRoles } = await container.items.query(
      `SELECT * FROM c WHERE c.name = "${name}"`
    ).fetchAll();
    
    if (existingRoles.length > 0) {
      return res.status(409).json({ error: 'Role with this name already exists' });
    }
    
    const roleData = {
      id: name, // Use name as ID for consistency
      name,
      displayName,
      description: description || '',
      priority: parseInt(priority),
      permissions: permissions || [],
      allowedRegions: allowedRegions || [],
      allowedDistricts: allowedDistricts || [],
      accessLevel,
      isActive,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.user?.id || 'system',
      updatedBy: req.user?.id || 'system'
    };
    
    const { resource } = await container.items.create(roleData);
    res.status(201).json(resource);
  } catch (err) {
    console.error('[Roles] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT (update role) - requires system admin
router.put('/:id', requireAuth(), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 [Roles] PUT request for role ID:', id);
    console.log('📊 [Roles] Request body:', JSON.stringify(req.body, null, 2));
    console.log('👤 [Roles] User ID:', req.userId);
    console.log('🔑 [Roles] User object:', req.user);
    
    // Check authorization (same pattern as users)
    const userId = req.userId;
    console.log('🔍 [Roles] Checking authorization for user:', userId);
    
    let userRole;
    try {
      console.log('🔍 [Roles] Calling getUserRole...');
      userRole = await getUserRole(userId);
      console.log(`✅ [Roles] getUserRole returned: ${userRole}`);
    } catch (roleError) {
      console.error(`❌ [Roles] Error getting user role:`, roleError);
      console.error(`❌ [Roles] Role error stack:`, roleError.stack);
      // In development, continue with system_admin role
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 [Roles] Development mode - setting userRole to system_admin');
        userRole = 'system_admin';
      } else {
        console.log('❌ [Roles] Production mode - returning error');
        return res.status(500).json({ error: 'Failed to get user role' });
      }
    }

    // Authorization check - only system_admin can update roles
    const isAuthorized = process.env.NODE_ENV === 'development' || userRole === 'system_admin';
    console.log(`🔍 [Roles] Authorization check:`, { isAuthorized, userRole, NODE_ENV: process.env.NODE_ENV });
    
    if (!isAuthorized) {
      console.log(`❌ [Roles] Authorization failed. User: ${userId}, Role: ${userRole}`);
      return res.status(403).json({ error: 'Forbidden - insufficient permissions' });
    }
    
    console.log('✅ [Roles] Authorization passed, proceeding with role update');
    
    // Get existing role
    console.log('🔍 [Roles] Reading existing role from database...');
    console.log('🔍 [Roles] Role ID to update:', id);
    console.log('🔍 [Roles] Container:', containerId);
    console.log('🔍 [Roles] Database:', databaseId);
    console.log('🔍 [Roles] Using query approach instead of container.item()');
    
    // Try to find the role using the same pattern as users container
    let existingRole;
    
    try {
      // First try: direct read with single parameter
      console.log('🔍 [Roles] Trying direct read with container.item(id)...');
      const { resource } = await container.item(id).read();
      console.log('🔍 [Roles] Direct read result:', resource ? 'Found' : 'Not found');
      
      if (resource) {
        existingRole = resource;
        console.log('✅ [Roles] Role found using container.item(id)');
      } else {
        throw new Error('Resource is undefined');
      }
    } catch (directError) {
      console.log('❌ [Roles] Direct read failed:', directError.message);
      
      // Second try: direct string query
      console.log('🔍 [Roles] Trying direct string query...');
      let { resources } = await container.items.query(
        `SELECT * FROM c WHERE c.id = "${id}"`
      ).fetchAll();
      
      console.log('🔍 [Roles] Query result count:', resources.length);
      
      if (resources.length === 0) {
        console.log('🔍 [Roles] Role not found by ID, trying by name...');
        const { resources: byName } = await container.items.query(
          `SELECT * FROM c WHERE c.name = "${id}"`
        ).fetchAll();
        
        console.log('🔍 [Roles] Name query result count:', byName.length);
        
        if (byName.length > 0) {
          console.log('✅ [Roles] Role found by name instead of ID');
          resources = byName;
        }
      }
      
      if (resources.length === 0) {
        console.log('❌ [Roles] Role not found in database by ID or name');
        return res.status(404).json({ error: 'Role not found' });
      }
      
      existingRole = resources[0];
      console.log('✅ [Roles] Role found using query method');
    }
    
    // Safety check for existingRole
    if (!existingRole) {
      console.log('❌ [Roles] existingRole is undefined, cannot proceed with update');
      return res.status(500).json({ error: 'Role lookup failed - role not found' });
    }
    
    console.log('✅ [Roles] Existing role read successfully:', {
      id: existingRole.id,
      name: existingRole.name,
      displayName: existingRole.displayName,
      priority: existingRole.priority,
      accessLevel: existingRole.accessLevel
    });
    
    // Update role data
    console.log('🔍 [Roles] Preparing updated role data...');
    const updatedRole = {
      ...existingRole,
      ...req.body,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.id || 'system'
    };
    console.log('✅ [Roles] Updated role data prepared:', {
      id: updatedRole.id,
      name: updatedRole.name,
      displayName: updatedRole.displayName,
      priority: updatedRole.priority,
      accessLevel: updatedRole.accessLevel,
      allowedRegions: updatedRole.allowedRegions,
      allowedDistricts: updatedRole.allowedDistricts
    });
    
    // Validate required fields
    console.log('🔍 [Roles] Validating required fields...');
    if (!updatedRole.name || !updatedRole.displayName || !updatedRole.priority || !updatedRole.accessLevel) {
      console.log('❌ [Roles] Missing required fields:', {
        name: !!updatedRole.name,
        displayName: !!updatedRole.displayName,
        priority: !!updatedRole.priority,
        accessLevel: !!updatedRole.accessLevel
      });
      return res.status(400).json({ error: 'Missing required fields: name, displayName, priority, accessLevel' });
    }
    console.log('✅ [Roles] Required fields validation passed');
    
    // Validate access level and regions/districts
    console.log('🔍 [Roles] Validating access level and regions/districts...');
    if (updatedRole.accessLevel === 'global') {
      // Global roles can access everything
      if (updatedRole.allowedRegions && updatedRole.allowedRegions.length > 0) {
        console.log('⚠️ [Roles] Warning: Global role with specific regions specified');
      }
      if (updatedRole.allowedDistricts && updatedRole.allowedDistricts.length > 0) {
        console.log('⚠️ [Roles] Warning: Global role with specific districts specified');
      }
    } else if (updatedRole.accessLevel === 'regional') {
      // Regional roles must have at least one region
      if (!updatedRole.allowedRegions || updatedRole.allowedRegions.length === 0) {
        console.log('❌ [Roles] Regional role missing allowed regions');
        return res.status(400).json({ error: 'Regional roles must specify at least one allowed region' });
      }
    } else if (updatedRole.accessLevel === 'district') {
      // District roles can work at district level without specifying exact districts
      // This allows roles like 'technician' to work in any district they're assigned to
      if (updatedRole.allowedDistricts && updatedRole.allowedDistricts.length > 0) {
        console.log('✅ [Roles] District role with specific districts:', updatedRole.allowedDistricts);
      } else {
        console.log('ℹ️ [Roles] District role without specific districts - will work in assigned districts');
      }
    } else {
      console.log('❌ [Roles] Invalid access level:', updatedRole.accessLevel);
      return res.status(400).json({ error: 'Invalid accessLevel. Must be global, regional, or district' });
    }
    console.log('✅ [Roles] Access level validation passed');
    
    // Perform the update
    console.log('🔍 [Roles] Performing database update...');
    console.log('🔍 [Roles] Using upsert approach instead of container.item()');
    console.log('🔍 [Roles] Update data size:', JSON.stringify(updatedRole).length, 'characters');
    
    // Use upsert instead of replace which is failing
    const { resource } = await container.items.upsert(updatedRole);
    console.log('✅ [Roles] Role updated successfully in database:', {
      id: resource.id,
      name: resource.name,
      updatedAt: resource.updatedAt
    });
    
    res.json(resource);
  } catch (err) {
    console.error('❌ [Roles] Error occurred during role update:');
    console.error('❌ [Roles] Error message:', err.message);
    console.error('❌ [Roles] Error code:', err.code);
    console.error('❌ [Roles] Error status code:', err.statusCode);
    console.error('❌ [Roles] Error stack:', err.stack);
    console.error('❌ [Roles] Error details:', err.details);
    console.error('❌ [Roles] Full error object:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    
    res.status(500).json({ 
      error: err.message,
      code: err.code || 'Unknown',
      details: err.details || 'No additional details'
    });
  }
});

// DELETE role - requires system admin
router.delete('/:id', requireAuth(), requireRole(['system_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[Roles] DELETE request for role ID:', id);
    
    // Check if role is in use by any users
    const usersContainer = database.container('users');
    const { resources: usersWithRole } = await usersContainer.items.query(
      'SELECT * FROM c WHERE c.role = @role',
      [{ name: '@role', value: id }]
    ).fetchAll();
    
    if (usersWithRole.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete role - it is currently assigned to users',
        usersCount: usersWithRole.length
      });
    }
    
    await container.item(id, id).delete();
    res.status(204).end();
  } catch (err) {
    console.error('[Roles] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET role permissions
router.get('/:id/permissions', requireAuth(), requireRole(['system_admin', 'global_engineer']), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[Roles] GET permissions for role ID:', id);
    const { resource } = await container.item(id, id).read();
    res.json({ roleId: id, permissions: resource.permissions || [] });
  } catch (err) {
    console.error('[Roles] Error:', err);
    res.status(404).json({ error: 'Role not found' });
  }
});

// PUT role permissions - requires system admin
router.put('/:id/permissions', requireAuth(), requireRole(['system_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;
    console.log('[Roles] PUT permissions for role ID:', id, 'Permissions:', permissions);
    
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Permissions must be an array' });
    }
    
    // Get existing role
    const { resource: existingRole } = await container.item(id, id).read();
    
    // Update permissions
    const updatedRole = {
      ...existingRole,
      permissions,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.id || 'system'
    };
    
    const { resource } = await container.item(id, id).replace(updatedRole);
    res.json({ roleId: id, permissions: resource.permissions });
  } catch (err) {
    console.error('[Roles] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
