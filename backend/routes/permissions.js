const express = require('express');
const router = express.Router();
const { requireRole } = require('../roles');
const { CosmosClient } = require('@azure/cosmos');

// Initialize Cosmos DB client
const client = new CosmosClient({
  endpoint: process.env.COSMOS_DB_ENDPOINT,
  key: process.env.COSMOS_DB_KEY
});

const database = client.database(process.env.COSMOS_DB_DATABASE);
const permissionsContainer = database.container('permissions');

// GET /api/permissions - Get all permissions
router.get('/', requireRole(['system_admin']), async (req, res) => {
  try {
    console.log('[Permissions Route] GET request received');
    
    // Read from database
    const { resource: permissionsDoc } = await permissionsContainer.item('permissions', 'permissions').read();
    
    if (!permissionsDoc) {
      console.log('[Permissions Route] No permissions document found in database');
      return res.status(404).json({ error: 'Permissions not found' });
    }
    
    console.log('[Permissions Route] Successfully retrieved permissions from database');
    console.log('[Permissions Route] Features:', Object.keys(permissionsDoc.features));
    console.log('[Permissions Route] Roles:', Object.keys(permissionsDoc.roles));
    
    res.json(permissionsDoc);
    
  } catch (error) {
    console.error('[Permissions Route] Error reading permissions from database:', error);
    
    // Fallback to file if database fails
    try {
      const fs = require('fs');
      const path = require('path');
      const permissionsPath = path.join(__dirname, '../config/permissions.json');
      
      if (fs.existsSync(permissionsPath)) {
        const filePermissions = JSON.parse(fs.readFileSync(permissionsPath, 'utf8'));
        console.log('[Permissions Route] Fallback to file successful');
        res.json(filePermissions);
      } else {
        res.status(500).json({ error: 'Failed to load permissions from database and file' });
      }
    } catch (fallbackError) {
      console.error('[Permissions Route] Fallback to file also failed:', fallbackError);
      res.status(500).json({ error: 'Failed to load permissions' });
    }
  }
});

// PUT /api/permissions - Update permissions
router.put('/', requireRole(['system_admin']), async (req, res) => {
  try {
    console.log('[Permissions Route] PUT request received');
    const newPermissions = req.body;
    
    if (!newPermissions || !newPermissions.features || !newPermissions.roles) {
      return res.status(400).json({ error: 'Invalid permissions data' });
    }
    
    console.log('[Permissions Route] Updating permissions in database...');
    
    // Create updated permissions document
    const updatedPermissionsDoc = {
      id: 'permissions',
      type: 'permissions',
      features: newPermissions.features,
      roles: newPermissions.roles,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0'
    };
    
    // Update in database
    await permissionsContainer.item('permissions', 'permissions').replace(updatedPermissionsDoc);
    
    console.log('[Permissions Route] Successfully updated permissions in database');
    console.log('[Permissions Route] Features:', Object.keys(newPermissions.features));
    console.log('[Permissions Route] Roles:', Object.keys(newPermissions.roles));
    
    // Also update the file as backup
    try {
      const fs = require('fs');
      const path = require('path');
      const permissionsPath = path.join(__dirname, '../config/permissions.json');
      
      // Create backup
      if (fs.existsSync(permissionsPath)) {
        const backupPath = `${permissionsPath}.backup.${Date.now()}`;
        fs.copyFileSync(permissionsPath, backupPath);
        console.log('[Permissions Route] Backup created:', backupPath);
      }
      
      // Write new permissions
      fs.writeFileSync(permissionsPath, JSON.stringify(newPermissions, null, 2));
      console.log('[Permissions Route] File backup updated successfully');
      
    } catch (fileError) {
      console.warn('[Permissions Route] File backup update failed:', fileError.message);
      // Don't fail the request if file backup fails
    }
    
    res.json({ 
      message: 'Permissions updated successfully',
      timestamp: new Date().toISOString(),
      source: 'database',
      backup: 'file'
    });
    
  } catch (error) {
    console.error('[Permissions Route] Error updating permissions in database:', error);
    
    // Fallback to file update if database fails
    try {
      const fs = require('fs');
      const path = require('path');
      const permissionsPath = path.join(__dirname, '../config/permissions.json');
      
      // Create backup
      if (fs.existsSync(permissionsPath)) {
        const backupPath = `${permissionsPath}.backup.${Date.now()}`;
        fs.copyFileSync(permissionsPath, backupPath);
        console.log('[Permissions Route] Fallback backup created:', backupPath);
      }
      
      // Write new permissions
      fs.writeFileSync(permissionsPath, JSON.stringify(req.body, null, 2));
      console.log('[Permissions Route] Fallback file update successful');
      
      res.json({ 
        message: 'Permissions updated successfully (fallback to file)',
        timestamp: new Date().toISOString(),
        source: 'file',
        warning: 'Database update failed, using file fallback'
      });
      
    } catch (fallbackError) {
      console.error('[Permissions Route] Fallback file update also failed:', fallbackError);
      res.status(500).json({ error: 'Failed to update permissions in database and file' });
    }
  }
});

module.exports = router; 