const express = require('express');
const router = express.Router();
const { requireRole } = require('../roles');
const dynamicPermissions = require('../middleware/dynamicPermissions');
const { CosmosClient } = require('@azure/cosmos');

// Initialize Cosmos DB client like equipmentFailureReports.js
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'substationStatus';
const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

// GET /api/substation-status - Get all substation statuses
router.get('/', async (req, res) => {
  try {
    console.log('[SubstationStatus] User info:', {
      role: req.user?.role,
      district: req.user?.district,
      region: req.user?.region,
      districtId: req.user?.districtId,
      regionId: req.user?.regionId,
      userId: req.user?.id
    });

    // Build Cosmos DB query with role-based filtering
    let queryStr = 'SELECT * FROM c';
    const filters = [];

    // Get regions and districts to convert names to IDs
    let regions = [];
    let districts = [];
    try {
      const regionsContainer = database.container('regions');
      const { resources: regionsData } = await regionsContainer.items.readAll().fetchAll();
      regions = regionsData || [];
      console.log('[SubstationStatus] Loaded regions:', regions.length);
      console.log('[SubstationStatus] Available regions:', regions.map(r => ({ id: r.id, name: r.name })));
    } catch (error) {
      console.log('[SubstationStatus] Error loading regions:', error.message);
    }

    try {
      const districtsContainer = database.container('districts');
      const { resources: districtsData } = await districtsContainer.items.readAll().fetchAll();
      districts = districtsData || [];
      console.log('[SubstationStatus] Loaded districts:', districts.length);
    } catch (error) {
      console.log('[SubstationStatus] Error loading districts:', error.message);
    }

    // Apply role-based filtering using IDs or names
    if (req.user && req.user.role !== "system_admin" && req.user.role !== "global_engineer") {
      if (req.user.role === "district_engineer" || req.user.role === "district_manager" || req.user.role === "technician") {
        if (req.user.district) {
          // Try to find district by ID first, then by name
          let userDistrict = districts.find(d => d.id === req.user.districtId);
          if (!userDistrict) {
            userDistrict = districts.find(d => d.name === req.user.district);
          }
          
          if (userDistrict) {
            // Use ID, name, and ID-in-name-field filters to cover all data formats
            filters.push(`(c.districtId = "${userDistrict.id}" OR c.district = "${userDistrict.name}" OR c.district = "${userDistrict.id}")`);
            console.log('[SubstationStatus] Added district filter by ID, name, and ID-in-name:', userDistrict.id, userDistrict.name, 'for user district:', req.user.district);
          } else {
            console.log('[SubstationStatus] District not found for user:', req.user.district);
          }
        } else {
          console.log('[SubstationStatus] No district found for user:', req.user.role);
        }
      } else if (req.user.role === "regional_engineer" || req.user.role === "regional_general_manager" || req.user.role === "project_engineer") {
        if (req.user.region) {
          // Try to find region by ID first, then by name
          let userRegion = regions.find(r => r.id === req.user.regionId);
          if (!userRegion) {
            userRegion = regions.find(r => r.name === req.user.region);
          }
          
          if (userRegion) {
            // Use ID, name, and ID-in-name-field filters to cover all data formats
            filters.push(`(c.regionId = "${userRegion.id}" OR c.region = "${userRegion.name}" OR c.region = "${userRegion.id}")`);
            console.log('[SubstationStatus] Added region filter by ID, name, and ID-in-name:', userRegion.id, userRegion.name, 'for user region:', req.user.region);
          } else {
            console.log('[SubstationStatus] Region not found for user:', req.user.region);
          }
        } else {
          console.log('[SubstationStatus] No region found for user:', req.user.role);
        }
      } else if (req.user.role === "ashsubt") {
        // Ashsubt users can see multiple regions: SUBTRANSMISSION ASHANTI, ASHANTI EAST, ASHANTI WEST, ASHANTI SOUTH
        const ashsubtRegionNames = ['SUBTRANSMISSION ASHANTI', 'ASHANTI EAST REGION', 'ASHANTI WEST REGION', 'ASHANTI SOUTH REGION'];
        const ashsubtRegions = regions.filter(r => ashsubtRegionNames.includes(r.name));
        
        if (ashsubtRegions.length > 0) {
          const regionConditions = ashsubtRegions.flatMap(r => [
            `c.regionId = "${r.id}"`,
            `c.region = "${r.name}"`,
            `c.region = "${r.id}"`
          ]);
          filters.push(`(${regionConditions.join(' OR ')})`);
          console.log('[SubstationStatus] Added ashsubt multi-region filter:', ashsubtRegionNames.join(', '));
        } else {
          console.log('[SubstationStatus] No matching regions found for ashsubt');
        }
      } else if (req.user.role === "accsubt") {
        // Accsubt users can see multiple regions: SUBTRANSMISSION ACCRA, ACCRA EAST, ACCRA WEST
        const accsubtRegionNames = ['SUBTRANSMISSION ACCRA', 'ACCRA EAST REGION', 'ACCRA WEST REGION'];
        const accsubtRegions = regions.filter(r => accsubtRegionNames.includes(r.name));
        
        if (accsubtRegions.length > 0) {
          const regionConditions = accsubtRegions.flatMap(r => [
            `c.regionId = "${r.id}"`,
            `c.region = "${r.name}"`,
            `c.region = "${r.id}"`
          ]);
          filters.push(`(${regionConditions.join(' OR ')})`);
          console.log('[SubstationStatus] Added accsubt multi-region filter:', accsubtRegionNames.join(', '));
        } else {
          console.log('[SubstationStatus] No matching regions found for accsubt');
        }
      } else {
        console.log('[SubstationStatus] User role not handled for filtering:', req.user.role);
      }
    } else {
      console.log('[SubstationStatus] Admin/Global engineer - no filtering applied');
    }

    // Add additional filters from query parameters
    if (req.query.filterRegion && req.query.filterRegion !== 'all') {
      // Find region by name
      const filterRegion = regions.find(r => r.name === req.query.filterRegion);
      if (filterRegion) {
        // Use ID, name, and ID-in-name-field filters to cover all data formats
        filters.push(`(c.regionId = "${filterRegion.id}" OR c.region = "${filterRegion.name}" OR c.region = "${filterRegion.id}")`);
        console.log('[SubstationStatus] Added region filter from query by ID, name, and ID-in-name:', filterRegion.id, filterRegion.name, 'for region:', req.query.filterRegion);
      } else {
        console.log('[SubstationStatus] Region not found for filter:', req.query.filterRegion);
      }
    }
    
    if (req.query.filterDistrict && req.query.filterDistrict !== 'all') {
      // Find district by name
      const filterDistrict = districts.find(d => d.name === req.query.filterDistrict);
      if (filterDistrict) {
        // Use ID, name, and ID-in-name-field filters to cover all data formats
        filters.push(`(c.districtId = "${filterDistrict.id}" OR c.district = "${filterDistrict.name}" OR c.district = "${filterDistrict.id}")`);
        console.log('[SubstationStatus] Added district filter from query by ID, name, and ID-in-name:', filterDistrict.id, filterDistrict.name, 'for district:', req.query.filterDistrict);
      } else {
        console.log('[SubstationStatus] District not found for filter:', req.query.filterDistrict);
      }
    }
    
    if (req.query.filterStatus && req.query.filterStatus !== 'all') {
      filters.push(`c.status = "${req.query.filterStatus}"`);
      console.log('[SubstationStatus] Added status filter from query:', req.query.filterStatus);
    }
    
    // Handle date range filtering
    if (req.query.dateFrom || req.query.dateTo) {
      let dateRangeCondition = '';
      
      if (req.query.dateFrom && req.query.dateTo) {
        // Both dates provided - create a range filter
        // Use date range from start of fromDate to end of toDate to include the entire day
        const fromDate = req.query.dateFrom + 'T00:00:00.000Z';
        const toDate = req.query.dateTo + 'T23:59:59.999Z';
        dateRangeCondition = `(c.createdAt >= "${fromDate}" AND c.createdAt <= "${toDate}")`;
        console.log('[SubstationStatus] Processing date range filter:', {
          receivedValues: { dateFrom: req.query.dateFrom, dateTo: req.query.dateTo },
          filterType: 'dateRange',
          filterCondition: dateRangeCondition
        });
      } else if (req.query.dateFrom) {
        // Only start date provided - start from beginning of the day
        const fromDate = req.query.dateFrom + 'T00:00:00.000Z';
        dateRangeCondition = `c.createdAt >= "${fromDate}"`;
        console.log('[SubstationStatus] Processing date from filter:', {
          receivedValue: req.query.dateFrom,
          filterType: 'dateFrom',
          filterCondition: dateRangeCondition
        });
      } else if (req.query.dateTo) {
        // Only end date provided - include the entire day
        const toDate = req.query.dateTo + 'T23:59:59.999Z';
        dateRangeCondition = `c.createdAt <= "${toDate}"`;
        console.log('[SubstationStatus] Processing date to filter:', {
          receivedValue: req.query.dateTo,
          filterType: 'dateTo',
          filterCondition: dateRangeCondition
        });
      }
      
      if (dateRangeCondition) {
        filters.push(dateRangeCondition);
        console.log('[SubstationStatus] Added date range filter condition:', dateRangeCondition);
      }
    }

    // Build final query
    if (filters.length > 0) {
      queryStr += ' WHERE ' + filters.join(' AND ');
    }

    // Add ordering
    queryStr += ' ORDER BY c.createdAt DESC';

    console.log('[SubstationStatus] Final query:', queryStr);

    // Get total count first (before pagination)
    let totalRecords = 0;
    try {
      // Build count query with same filters
      let countQuery = 'SELECT VALUE COUNT(1) FROM c';
      if (filters.length > 0) {
        countQuery += ' WHERE ' + filters.join(' AND ');
      }
      
      console.log('[SubstationStatus] Count query:', countQuery);
      const { resources: countResources } = await container.items.query({
        query: countQuery
      }).fetchAll();
      
      totalRecords = countResources[0] || 0;
      console.log('[SubstationStatus] Total records:', totalRecords);
    } catch (countError) {
      console.error('[SubstationStatus] Error getting count:', countError);
      totalRecords = 0;
    }
    
    // Apply pagination at database level (not client-side)
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const offset = (page - 1) * pageSize;
    
    // Add LIMIT and OFFSET to the query for server-side pagination
    if (queryStr.includes('WHERE')) {
      queryStr += ` OFFSET ${offset} LIMIT ${pageSize}`;
    } else {
      queryStr += ` OFFSET ${offset} LIMIT ${pageSize}`;
    }
    
    console.log('[SubstationStatus] Final paginated query:', queryStr);
    
    // Execute paginated query
    const { resources: paginatedResources } = await container.items.query({
      query: queryStr
    }).fetchAll();
    
    console.log('[SubstationStatus] Returning data:', {
      totalRecords,
      currentPage: page,
      pageSize,
      dataLength: paginatedResources.length,
      offset,
      limit: pageSize
    });
    
    res.json({
      success: true,
      data: paginatedResources,
      totalRecords: totalRecords,
      currentPage: page,
      pageSize: pageSize,
      totalPages: Math.ceil(totalRecords / pageSize)
    });
  } catch (error) {
    console.error('Error fetching substation statuses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch substation statuses'
    });
  }
});

// GET /api/substation-status/:id - Get specific substation status
router.get('/:id', dynamicPermissions.requireAccess('substation_status'), async (req, res) => {
  try {
    const { resource } = await container.item(req.params.id, req.params.id).read();
    
    if (!resource) {
      return res.status(404).json({
        success: false,
        error: 'Substation status not found'
      });
    }
    
    // Check if user has access to this specific item
    if (req.user?.role !== 'system_admin' && req.user?.role !== 'admin' && req.user?.role !== 'district_manager') {
      if (req.user?.role === 'regional_engineer' || req.user?.role === 'regional_general_manager') {
        // Check region by both name and ID
        const userRegion = req.user.regionId || req.user.region;
        const itemRegion = resource.regionId || resource.region;
        if (itemRegion !== userRegion) {
          console.log('[SubstationStatus] Region mismatch:', { itemRegion, userRegion });
          return res.status(403).json({
            success: false,
            error: 'Access denied'
          });
        }
      } else if (req.user?.role === 'district_engineer' || req.user?.role === 'technician') {
        // Check district by both name and ID
        const userDistrict = req.user.districtId || req.user.district;
        const itemDistrict = resource.districtId || resource.district;
        if (itemDistrict !== userDistrict) {
          console.log('[SubstationStatus] District mismatch:', { itemDistrict, userDistrict });
          return res.status(403).json({
            success: false,
            error: 'Access denied'
          });
        }
      }
    }
    
    res.json({
      success: true,
      data: resource
    });
  } catch (error) {
    console.error('Error fetching substation status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch substation status'
    });
  }
});

// POST /api/substation-status - Create new substation status
router.post('/', dynamicPermissions.requireCreate('substation_status'), async (req, res) => {
  try {
    // Log the request body and user object for debugging
    console.log('[SubstationStatus] Creating new status:', {
      body: req.body,
      user: req.user,
      userId: req.user?.id || req.user?.oid || 'unknown'
    });

    // Validate required fields
    if (!req.body.region || !req.body.district || !req.body.substationNumber || !req.body.substationName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: region, district, substationNumber, substationName'
      });
    }

    // Check for duplicate submission if submissionId is provided
    if (req.body.submissionId) {
      try {
        console.log('[SubstationStatus] Checking for duplicate submissionId:', req.body.submissionId);
        
        const existingSubmission = await container.items
          .query({
            query: 'SELECT * FROM c WHERE c.submissionId = @submissionId',
            parameters: [{ name: '@submissionId', value: req.body.submissionId }]
          })
          .fetchAll();
        
        if (existingSubmission.resources.length > 0) {
          console.log('[SubstationStatus] Duplicate submission detected:', req.body.submissionId);
          return res.status(409).json({
            success: false,
            error: 'Duplicate submission detected',
            details: 'This form has already been submitted'
          });
        } else {
          console.log('[SubstationStatus] No duplicate found, proceeding with submission');
        }
      } catch (duplicateCheckError) {
        console.warn('[SubstationStatus] Could not check for duplicates:', duplicateCheckError.message);
        // Continue with submission even if duplicate check fails
      }
    } else {
      console.log('[SubstationStatus] No submissionId provided, skipping duplicate check');
    }

    // Check if container is accessible
    try {
      await container.read();
      console.log('[SubstationStatus] Container is accessible');
    } catch (containerError) {
      console.error('[SubstationStatus] Container access error:', containerError);
      return res.status(500).json({
        success: false,
        error: 'Database container not accessible',
        details: containerError.message
      });
    }

    const newStatus = {
      id: `substation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...req.body,
      submissionId: req.body.submissionId || `submission_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      createdBy: req.user?.id || req.user?.oid || 'unknown',
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.id || req.user?.oid || 'unknown'
    };
    
    console.log('[SubstationStatus] Attempting to create:', newStatus);
    
    const { resource } = await container.items.create(newStatus);
    
    console.log('[SubstationStatus] Created successfully:', resource);
    
    res.status(201).json({
      success: true,
      data: resource,
      message: 'Substation status created successfully'
    });
  } catch (error) {
    console.error('[SubstationStatus] Error creating substation status:', error);
    console.error('[SubstationStatus] Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to create substation status',
      details: error.message
    });
  }
});

// PUT /api/substation-status/:id - Update substation status
router.put('/:id', dynamicPermissions.requireUpdate('substation_status'), async (req, res) => {
  try {
    const { resource: existingItem } = await container.item(req.params.id, req.params.id).read();
    
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        error: 'Substation status not found'
      });
    }
    
    // Check if user has access to this specific item
    if (req.user?.role !== 'system_admin' && req.user?.role !== 'admin' && req.user?.role !== 'global_engineer' && req.user?.role !== 'project_engineer') {
      if (req.user?.role === 'regional_engineer' || req.user?.role === 'regional_general_manager') {
        // Check region by both name and ID
        const userRegion = req.user.regionId || req.user.region;
        const itemRegion = existingItem.regionId || existingItem.region;
        if (itemRegion !== userRegion) {
          console.log('[SubstationStatus] Region mismatch:', { itemRegion, userRegion });
          return res.status(403).json({
            success: false,
            error: 'Access denied'
          });
        }
      } else if (req.user?.role === 'district_engineer' || req.user?.role === 'district_manager' || req.user?.role === 'technician' || req.user?.role === 'senior_technician') {
        // Check district by both name and ID
        const userDistrict = req.user.districtId || req.user.district;
        const itemDistrict = existingItem.districtId || existingItem.district;
        if (itemDistrict !== userDistrict) {
          console.log('[SubstationStatus] District mismatch:', { itemDistrict, userDistrict });
          return res.status(403).json({
            success: false,
            error: 'Access denied'
          });
        }
      }
    }
    
    const updatedStatus = {
      ...existingItem,
      ...req.body,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.name || req.user.id // Store user name if available, otherwise ID
    };
    
    const { resource } = await container.item(req.params.id, req.params.id).replace(updatedStatus);
    
    res.json({
      success: true,
      data: resource,
      message: 'Substation status updated successfully'
    });
  } catch (error) {
    console.error('Error updating substation status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update substation status'
    });
  }
});

// DELETE /api/substation-status/:id - Delete substation status
router.delete('/:id', dynamicPermissions.requireDelete('substation_status'), async (req, res) => {
  try {
    // First check if the item exists and user has access
    const { resource: existingItem } = await container.item(req.params.id, req.params.id).read();
    
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        error: 'Substation status not found'
      });
    }
    
    // Check if user has access to this specific item
    if (req.user?.role !== 'system_admin' && req.user?.role !== 'admin' && req.user?.role !== 'global_engineer' && req.user?.role !== 'project_engineer') {
      if (req.user?.role === 'regional_engineer' || req.user?.role === 'regional_general_manager') {
        // Check region by both name and ID
        const userRegion = req.user.regionId || req.user.region;
        const itemRegion = existingItem.regionId || existingItem.region;
        if (itemRegion !== userRegion) {
          console.log('[SubstationStatus] Region mismatch:', { itemRegion, userRegion });
          return res.status(403).json({
            success: false,
            error: 'Access denied'
          });
        }
      } else if (req.user?.role === 'district_engineer' || req.user?.role === 'district_manager' || req.user?.role === 'technician' || req.user?.role === 'senior_technician') {
        // Check district by both name and ID
        const userDistrict = req.user.districtId || req.user.district;
        const itemDistrict = existingItem.districtId || existingItem.district;
        if (itemDistrict !== userDistrict) {
          console.log('[SubstationStatus] District mismatch:', { itemDistrict, userDistrict });
          return res.status(403).json({
            success: false,
            error: 'Access denied'
          });
        }
      }
    }
    
    await container.item(req.params.id, req.params.id).delete();
    
    res.json({
      success: true,
      message: 'Substation status deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting substation status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete substation status'
    });
  }
});

module.exports = router;
