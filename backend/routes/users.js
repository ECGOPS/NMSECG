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
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // First try to find user by JWT UID (current user ID)
    let { resources } = await container.items.query(
      `SELECT * FROM c WHERE c.id = "${userId}"`
    ).fetchAll();
    
    if (resources.length === 0) {
      // If not found by JWT UID, try to find by email (for existing users with different UID)
      const userEmail = req.auth?.payload?.email || req.auth?.payload?.preferred_username;
      if (userEmail) {
        const { resources: emailUsers } = await container.items.query(
          `SELECT * FROM c WHERE c.email = "${userEmail}"`
        ).fetchAll();
        
        if (emailUsers.length > 0) {
          // Found existing user by email - return the existing user data
          console.log(`[ME] Found user by email: ${emailUsers[0].email} (role: ${emailUsers[0].role})`);
          return res.json(emailUsers[0]);
        }
      }
      
      // If still not found, try to find by UID (for users that were updated by auth middleware)
      const { resources: uidUsers } = await container.items.query(
        `SELECT * FROM c WHERE c.uid = "${userId}"`
      ).fetchAll();
      
      if (uidUsers.length > 0) {
        console.log(`[ME] Found user by UID: ${uidUsers[0].email} (role: ${uidUsers[0].role})`);
        return res.json(uidUsers[0]);
      }
      
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(resources[0]);
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
    if (req.query.sort) {
      queryStr += ` ORDER BY c.${req.query.sort} ${req.query.order === 'desc' ? 'DESC' : 'ASC'}`;
    }
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    queryStr += ` OFFSET ${offset} LIMIT ${limit}`;
    
    console.log('[Users] Final query:', queryStr);
    
    if (req.query.countOnly === 'true') {
      const countQuery = queryStr.replace(/SELECT \* FROM c/, 'SELECT VALUE COUNT(1) FROM c');
      console.log('[Users] Count query:', countQuery);
      const { resources: countResources } = await container.items.query(countQuery).fetchAll();
      console.log('[Users] Count result:', countResources[0]);
      return res.json({ count: countResources[0] });
    }
    
    const { resources } = await container.items.query(queryStr).fetchAll();
    
    // Log user details for debugging
    console.log('[Users] Query result:', {
      totalUsers: resources.length,
      users: resources.map(u => ({ id: u.id, name: u.name, email: u.email, status: u.status, role: u.role }))
    });
    
    res.json(resources);
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