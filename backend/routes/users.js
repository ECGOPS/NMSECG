const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const { requireRole, getUserRole, requireAuth } = require('../roles');

const router = express.Router();
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'users';
const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

// GET current user profile
router.get('/me', requireAuth(), async (req, res) => {
  try {
    const userId = req.userId;
    const authPayload = req.auth?.payload;
    
    console.log(`[ME] ========================================`);
    console.log(`[ME] GET /api/users/me called`);
    console.log(`[ME] req.userId: ${userId}`);
    console.log(`[ME] req.userRole: ${req.userRole}`);
    console.log(`[ME] req.user: ${req.user ? JSON.stringify({ id: req.user.id, email: req.user.email, role: req.user.role }) : 'null'}`);
    console.log(`[ME] JWT payload oid: ${authPayload?.oid}`);
    console.log(`[ME] JWT payload sub: ${authPayload?.sub}`);
    console.log(`[ME] JWT payload email: ${authPayload?.email}`);
    console.log(`[ME] ========================================`);
    
    if (!userId) {
      console.log(`[ME] ❌ No userId found in request`);
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    console.log(`[ME] Looking for user with userId: ${userId}`);
    
    // First try to find user by UID (most reliable - matches Azure AD oid)
    console.log(`[ME] Step 1: Querying by UID: ${userId}`);
    let { resources } = await container.items.query({
      query: 'SELECT * FROM c WHERE c.uid = @uid',
      parameters: [{ name: '@uid', value: userId }]
    }).fetchAll();
    
    console.log(`[ME] Step 1 result: Found ${resources.length} user(s) by UID`);
    
    if (resources.length > 0) {
      console.log(`[ME] ✅ Found user by UID: ${resources[0].email} (role: ${resources[0].role}, status: ${resources[0].status})`);
      return res.json(resources[0]);
    }
    
    // If not found by UID, try to find by document ID
    console.log(`[ME] Step 2: Querying by document ID: ${userId}`);
    const { resources: idUsers } = await container.items.query({
      query: 'SELECT * FROM c WHERE c.id = @id',
      parameters: [{ name: '@id', value: userId }]
    }).fetchAll();
    
    console.log(`[ME] Step 2 result: Found ${idUsers.length} user(s) by ID`);
    
    if (idUsers.length > 0) {
      console.log(`[ME] ✅ Found user by ID: ${idUsers[0].email} (role: ${idUsers[0].role}, status: ${idUsers[0].status})`);
      return res.json(idUsers[0]);
      }
      
    // If still not found, try to find by email (for existing users with different UID)
    const userEmail = authPayload?.email || authPayload?.preferred_username;
      if (userEmail) {
      console.log(`[ME] Step 3: Querying by email: ${userEmail}`);
      // Use case-insensitive email matching (same as auth.js)
      const { resources: emailUsers } = await container.items.query({
        query: 'SELECT * FROM c WHERE LOWER(c.email) = @email',
        parameters: [{ name: '@email', value: userEmail.toLowerCase() }]
      }).fetchAll();
      
      console.log(`[ME] Step 3 result: Found ${emailUsers.length} user(s) by email`);
        
        if (emailUsers.length > 0) {
          // Found existing user by email - return the existing user data
        console.log(`[ME] ✅ Found user by email: ${emailUsers[0].email} (role: ${emailUsers[0].role}, status: ${emailUsers[0].status})`);
          return res.json(emailUsers[0]);
        }
      }
      
    console.log(`[ME] ❌ User not found with userId: ${userId}, email: ${userEmail || 'N/A'}`);
    console.log(`[ME] All lookup methods failed`);
      return res.status(404).json({ error: 'User not found' });
  } catch (err) {
    console.error('Error in /me endpoint:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET all (read) with filtering, sorting, pagination, and count
router.get('/', requireAuth(), async (req, res) => {
  try {
    console.log('[Users] GET request received:', {
      query: req.query,
      userId: req.userId,
      userRole: req.userRole
    });
    
    let queryStr = 'SELECT * FROM c';
    const filters = [];
    for (const key in req.query) {
      if (["sort", "order", "limit", "offset", "countOnly"].includes(key)) continue;
      filters.push(`c.${key} = "${req.query[key]}"`);
    }
    if (filters.length) queryStr += ' WHERE ' + filters.join(' AND ');
    
    // Add ORDER BY for consistent pagination (required for TOP)
    if (req.query.sort) {
      queryStr += ` ORDER BY c.${req.query.sort} ${req.query.order === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      // Default ordering by id for consistent pagination
      queryStr += ' ORDER BY c.id';
    }
    
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    console.log('[Users] Final query before pagination:', queryStr);
    
    if (req.query.countOnly === 'true') {
      // Remove ORDER BY and pagination for count query
      const countQuery = queryStr.replace(/ORDER BY.*$/, '').replace(/SELECT \* FROM c/, 'SELECT VALUE COUNT(1) FROM c');
      console.log('[Users] Count query:', countQuery);
      const { resources: countResources } = await container.items.query(countQuery).fetchAll();
      const count = countResources[0] ?? 0;
      console.log('[Users] Count result:', count);
      return res.json({ count });
    }
    
    // Cosmos DB SQL API: Use TOP for limiting (LIMIT is not supported)
    // For offset > 0, fetch offset + limit records, then slice client-side
    const fetchLimit = offset > 0 ? offset + limit : limit;
    queryStr = queryStr.replace('SELECT * FROM c', `SELECT TOP ${fetchLimit} * FROM c`);
    
    console.log('[Users] Final query with TOP:', queryStr);
    
    const { resources } = await container.items.query(queryStr).fetchAll();
    
    // Handle offset client-side
    let paginatedResources = resources;
    if (offset > 0) {
      paginatedResources = resources.slice(offset, offset + limit);
    } else if (resources.length > limit) {
      // Safety check: if we got more than requested, trim to limit
      paginatedResources = resources.slice(0, limit);
    }
    
    // Log user details for debugging (including pending users)
    console.log('[Users] Query result:', {
      totalFetched: resources.length,
      totalReturned: paginatedResources.length,
      requestedLimit: limit,
      requestedOffset: offset,
      users: paginatedResources.map(u => ({ id: u.id, name: u.name, email: u.email, status: u.status, role: u.role }))
    });
    
    res.json(paginatedResources);
  } catch (err) {
    console.error('[Users] Error in GET /:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST (create) - only system_admin can create users
router.post('/', requireRole(['system_admin']), async (req, res) => {
  try {
    const { resource } = await container.items.create(req.body);
    res.status(201).json(resource);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET by ID
router.get('/:id', requireAuth(), async (req, res) => {
  try {
    const { id } = req.params;
    const { resource } = await container.item(id, id).read();
    if (!resource) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(resource);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT (update) - role checks as per Firestore rules
router.put('/:id', requireAuth(), async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[PUT /users/${id}] Update request received:`, {
      userId: req.userId,
      body: req.body,
      bodyKeys: Object.keys(req.body),
      bodyValues: Object.values(req.body),
      headers: req.headers
    });

    // Check if user exists first
    let existingUser;
    try {
      const { resource } = await container.item(id, id).read();
      existingUser = resource;
      console.log(`[PUT /users/${id}] Existing user found:`, existingUser);
    } catch (readError) {
      console.error(`[PUT /users/${id}] Error reading existing user:`, readError);
      return res.status(404).json({ error: 'User not found' });
    }

    // Check authorization
    const userId = req.userId;
    let userRole;
    try {
      userRole = await getUserRole(userId);
      console.log(`[PUT /users/${id}] User role:`, userRole);
    } catch (roleError) {
      console.error(`[PUT /users/${id}] Error getting user role:`, roleError);
      // In development, continue with system_admin role
      if (process.env.NODE_ENV === 'development') {
        userRole = 'system_admin';
      } else {
        return res.status(500).json({ error: 'Failed to get user role' });
      }
    }

    // Authorization check - in production, enforce proper permissions
    const isAuthorized = process.env.NODE_ENV === 'development' || 
                        userRole === 'system_admin' || 
                        userRole === 'global_engineer' || 
                        userId === id;
    
    if (!isAuthorized) {
      console.log(`[PUT /users/${id}] Authorization failed. User: ${userId}, Role: ${userRole}, Target: ${id}`);
      return res.status(403).json({ error: 'Forbidden - insufficient permissions' });
    }

    // Prepare update data - ensure id is included
    const updateData = {
      ...existingUser,
      ...req.body,
      id: id, // Ensure id is always present
      updatedAt: new Date().toISOString()
    };
    
    // Remove any undefined values that might cause issues
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    console.log(`[PUT /users/${id}] Updating user with data:`, updateData);

    // Perform the update
    const { resource } = await container.item(id, id).replace(updateData);
    console.log(`[PUT /users/${id}] Update successful:`, resource);
    
    res.json(resource);
  } catch (err) {
    console.error(`[PUT /users/${id}] Error updating user:`, err);
    res.status(500).json({ 
      error: err.message,
      details: err.code || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// DELETE - only system_admin
router.delete('/:id', requireRole(['system_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    await container.item(id, id).delete();
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User status endpoints for security monitoring
router.get('/status/online', requireAuth(), async (req, res) => {
  try {
    console.log('[UserStatus] Online users request received');
    
    // Get real online users (active in last 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { resources } = await container.items.query(
      'SELECT VALUE COUNT(1) FROM c WHERE c.lastActivity > @timestamp',
      {
        parameters: [{ name: '@timestamp', value: fifteenMinutesAgo }]
      }
    ).fetchAll();
    
    const onlineCount = resources[0] || 0;
    console.log(`[UserStatus] Real online users count: ${onlineCount}`);
    res.json(onlineCount);
  } catch (err) {
    console.error('Error getting online users count:', err);
    // Fallback to 1 if query fails (assuming current user is online)
    res.json(1);
  }
});

router.get('/status/idle', requireAuth(), async (req, res) => {
  try {
    console.log('[UserStatus] Idle users request received');
    
    // Get real idle users (active 15-30 minutes ago)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    
    const { resources } = await container.items.query(
      'SELECT VALUE COUNT(1) FROM c WHERE c.lastActivity BETWEEN @idleStart AND @idleEnd',
      {
        parameters: [
          { name: '@idleStart', value: thirtyMinutesAgo },
          { name: '@idleEnd', value: fifteenMinutesAgo }
        ]
      }
    ).fetchAll();
    
    const idleCount = resources[0] || 0;
    console.log(`[UserStatus] Real idle users count: ${idleCount}`);
    res.json(idleCount);
  } catch (err) {
    console.error('Error getting idle users count:', err);
    res.json(0);
  }
});

router.get('/status/offline', requireAuth(), async (req, res) => {
  try {
    console.log('[UserStatus] Offline users request received');
    
    // Get real offline users (inactive for 30+ minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { resources } = await container.items.query(
      'SELECT VALUE COUNT(1) FROM c WHERE c.lastActivity < @timestamp',
      {
        parameters: [{ name: '@timestamp', value: thirtyMinutesAgo }]
      }
    ).fetchAll();
    
    const offlineCount = resources[0] || 0;
    console.log(`[UserStatus] Real offline users count: ${offlineCount}`);
    res.json(offlineCount);
  } catch (err) {
    console.error('Error getting offline users count:', err);
    res.json(0);
  }
});

// Add user activity tracking endpoint
router.post('/activity', requireAuth(), async (req, res) => {
  try {
    const { userId, activity } = req.body;
    const now = new Date().toISOString();
    
    // Create or update user activity record
    const userActivity = {
      id: userId,
      userId,
      lastActivity: now,
      activity,
      updatedAt: now
    };
    
    try {
      // Try to replace existing record
      await container.item(userId, userId).replace(userActivity);
    } catch (replaceError) {
      // If replace fails, create new record
      await container.items.create(userActivity);
    }
    
    console.log(`[UserStatus] Updated activity for user: ${userId}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating user activity:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 