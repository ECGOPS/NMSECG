const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const { requireRole, requireAuth } = require('../roles');

const router = express.Router();
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'controlOutages';
const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

// Log endpoint status only in development
if (process.env.NODE_ENV === 'development') {
  console.log('[ControlOutages] Endpoint:', endpoint);
}

// GET all - requires authentication and appropriate role
router.get('/', requireAuth(), requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    console.log('[ControlOutages] GET request received with query:', req.query);
    console.log('[ControlOutages] Database:', databaseId);
    console.log('[ControlOutages] Container:', containerId);
    console.log('[ControlOutages] User info:', {
      role: req.user?.role,
      district: req.user?.district,
      region: req.user?.region,
      userId: req.user?.id
    });
    
    let queryStr = 'SELECT * FROM c';
    const filters = [];
    
    // Apply role-based filtering if no regionId is provided (for all non-admin/global roles)
    if (!req.query.regionId && !req.query.districtId && req.user && req.user.role !== "system_admin" && req.user.role !== "global_engineer") {
      console.log('[ControlOutages] Applying role-based filtering for role:', req.user.role);
      
      if (req.user.role === "district_engineer" || req.user.role === "district_manager" || req.user.role === "technician") {
        // District-level roles - filter by district
        if (req.user.district) {
          filters.push(`c.district = "${req.user.district}"`);
          console.log('[ControlOutages] Filtering by district:', req.user.district);
        }
      } else if (req.user.role === "regional_engineer" || req.user.role === "regional_general_manager" || req.user.role === "project_engineer") {
        // Regional-level roles - filter by region
        if (req.user.region) {
          filters.push(`c.region = "${req.user.region}"`);
          console.log('[ControlOutages] Filtering by region:', req.user.region);
        }
      } else if (req.user.role === "ashsubt") {
        // Ashsubt users can see multiple regions: SUBTRANSMISSION ASHANTI, ASHANTI EAST, ASHANTI WEST, ASHANTI SOUTH
        const ashsubtRegions = ['SUBTRANSMISSION ASHANTI', 'ASHANTI EAST REGION', 'ASHANTI WEST REGION', 'ASHANTI SOUTH REGION'];
        const regionConditions = ashsubtRegions.map(r => `c.region = "${r}"`);
        filters.push(`(${regionConditions.join(' OR ')})`);
        console.log('[ControlOutages] Added ashsubt multi-region filter:', ashsubtRegions.join(', '));
      } else if (req.user.role === "accsubt") {
        // Accsubt users can see multiple regions: SUBTRANSMISSION ACCRA, ACCRA EAST, ACCRA WEST
        const accsubtRegions = ['SUBTRANSMISSION ACCRA', 'ACCRA EAST REGION', 'ACCRA WEST REGION'];
        const regionConditions = accsubtRegions.map(r => `c.region = "${r}"`);
        filters.push(`(${regionConditions.join(' OR ')})`);
        console.log('[ControlOutages] Added accsubt multi-region filter:', accsubtRegions.join(', '));
      }
    }
    
    // Apply filters
    for (const key in req.query) {
      if (["sort", "order", "limit", "offset", "countOnly"].includes(key)) continue;
      if (req.query[key] && req.query[key] !== 'all') {
        // Handle date range filtering specially
        if (key === 'startDate') {
          filters.push(`c.occurrenceDate >= "${req.query[key]}"`);
          console.log('[ControlOutages] Added startDate filter:', `c.occurrenceDate >= "${req.query[key]}"`);
        } else if (key === 'endDate') {
          filters.push(`c.occurrenceDate <= "${req.query[key]}"`);
          console.log('[ControlOutages] Added endDate filter:', `c.occurrenceDate <= "${req.query[key]}"`);
        } else if (key === 'date') {
          // Handle date filtering for occurrenceDate field
          const dateValue = req.query[key];
          filters.push(`c.occurrenceDate >= "${dateValue}T00:00:00.000Z" AND c.occurrenceDate <= "${dateValue}T23:59:59.999Z"`);
          console.log('[ControlOutages] Added date filter:', `c.occurrenceDate >= "${dateValue}T00:00:00.000Z" AND c.occurrenceDate <= "${dateValue}T23:59:59.999Z"`);
        } else if (key === 'outageType') {
          // Handle outage type filtering with a different approach for large datasets
          const outageType = req.query[key];
          console.log('[ControlOutages] Processing outage type filter:', outageType);
          
          if (outageType === 'sustained' || outageType === 'momentary') {
            // For large datasets, we need to fetch more records to ensure we have enough after filtering
            // This is a compromise between performance and accuracy
            console.log('[ControlOutages] Outage type filtering - will fetch more records to ensure adequate results');
          }
        } else {
          // Handle array parameters (e.g., regionId: ['central', 'central'])
          let value = req.query[key];
          if (Array.isArray(value)) {
            // Take the first unique value from the array
            value = [...new Set(value)][0];
            console.log('[ControlOutages] Array parameter detected, using first unique value:', { key, original: req.query[key], final: value });
          }
          // Regular equality filter for other parameters
          filters.push(`c.${key} = "${value}"`);
        }
      }
    }
    
    if (filters.length > 0) {
      queryStr += ' WHERE ' + filters.join(' AND ');
      console.log('[ControlOutages] Applied filters:', filters);
      console.log('[ControlOutages] Complete query:', queryStr);
    } else {
      console.log('[ControlOutages] No filters applied');
    }
    
    // Add sorting
    if (req.query.sort) {
      queryStr += ` ORDER BY c.${req.query.sort} ${req.query.order === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      queryStr += ' ORDER BY c.occurrenceDate DESC';
    }
    
    // Extract pagination parameters
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const countOnly = req.query.countOnly === 'true';
    
    // Validate and cap limit to prevent performance issues
    const maxLimit = 1000; // Maximum limit to prevent excessive memory usage
    const finalLimit = Math.min(limit, maxLimit);
    
    // Performance warning for large queries
    if (limit > 500) {
      console.warn('[ControlOutages] Large query requested:', {
        requestedLimit: limit,
        finalLimit,
        warning: 'Large queries may impact performance'
      });
    }
    
    console.log('[ControlOutages] Pagination params:', {
      requestedLimit: limit,
      finalLimit,
      offset,
      countOnly
    });
    
    // Count-only shortcut for better performance
    if (countOnly) {
      const countQuery = queryStr.replace(/SELECT \* FROM c/, 'SELECT VALUE COUNT(1) FROM c');
      const { resources: countResources } = await container.items.query(countQuery).fetchAll();
      const totalCount = countResources[0] ?? 0;
      
      console.log('[ControlOutages] Count query result:', totalCount);
      return res.json({ total: totalCount });
    }
    
    // Check if we need outage type filtering
    const needsOutageTypeFilter = req.query.outageType && req.query.outageType !== 'all';
    
    let resources = [];
    let executionTime = 0;
    
    if (needsOutageTypeFilter) {
      // For outage type filtering, fetch more records to ensure we have enough after filtering
      const multiplier = 3; // Fetch 3x more records to account for filtering
      const expandedLimit = finalLimit * multiplier;
      
      console.log('[ControlOutages] Outage type filtering - fetching', expandedLimit, 'records (', finalLimit, 'x', multiplier, ')');
      
      queryStr += ` OFFSET ${offset} LIMIT ${expandedLimit}`;
      console.log('[ControlOutages] Expanded query:', queryStr);
      
      const startTime = Date.now();
      try {
        const result = await container.items.query(queryStr).fetchAll();
        resources = result.resources;
        executionTime = Date.now() - startTime;
        console.log('[ControlOutages] Expanded query executed successfully in', executionTime, 'ms, fetched:', resources.length, 'records');
      } catch (queryError) {
        console.error('[ControlOutages] Query execution error:', queryError);
        return res.status(500).json({
          error: 'Database query failed',
          details: queryError.message,
          code: queryError.code,
          query: queryStr
        });
      }
    } else {
      // Normal pagination for non-outage-type queries
      queryStr += ` OFFSET ${offset} LIMIT ${finalLimit}`;
      console.log('[ControlOutages] Normal query:', queryStr);
      
      const startTime = Date.now();
      try {
        const result = await container.items.query(queryStr).fetchAll();
        resources = result.resources;
        executionTime = Date.now() - startTime;
        console.log('[ControlOutages] Query executed successfully in', executionTime, 'ms');
      } catch (queryError) {
        console.error('[ControlOutages] Query execution error:', queryError);
        return res.status(500).json({
          error: 'Database query failed',
          details: queryError.message,
          code: queryError.code,
          query: queryStr
        });
      }
    }
    
    // Get total count without pagination for accurate pagination info
    let totalCount = 0;
    try {
      // Build count query with same filters but without pagination
      let countQuery = 'SELECT VALUE COUNT(1) FROM c';
      
      // Add the same filters that were applied to the main query
      if (filters.length > 0) {
        countQuery += ' WHERE ' + filters.join(' AND ');
      }
      
      console.log('[ControlOutages] Count query:', countQuery);
      const { resources: countResources } = await container.items.query(countQuery).fetchAll();
      totalCount = countResources[0] ?? 0;
      console.log('[ControlOutages] Count query result:', totalCount);
    } catch (countError) {
      console.error('[ControlOutages] Count query error:', countError);
      // Don't fail the request, just use the current page count
      totalCount = resources.length;
    }
    
    // Enhanced logging with performance metrics
    console.log('[ControlOutages] Query completed:', {
      totalRecords: totalCount,
      returnedRecords: resources.length,
      executionTime: `${executionTime}ms`,
      pagination: { offset, limit: finalLimit, page: Math.floor(offset / finalLimit) + 1 }
    });
    
    // Return paginated response with metadata
    res.json({
      data: resources,
      total: totalCount,
      page: Math.floor(offset / finalLimit) + 1,
      pageSize: finalLimit,
      totalPages: Math.ceil(totalCount / finalLimit),
      hasNextPage: offset + finalLimit < totalCount,
      hasPreviousPage: offset > 0
    });
    
  } catch (err) {
    console.error('[ControlOutages] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST (create) - requires authentication and appropriate role
router.post('/', requireAuth(), requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    const { resource } = await container.items.create(req.body);
    res.status(201).json(resource);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT (update)
router.put('/:id', requireAuth(), requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[ControlOutages] PUT request for ID:', id);
    console.log('[ControlOutages] Request body:', JSON.stringify(req.body, null, 2));
    // Ensure the document contains the required id property for Cosmos replace
    const updatedDoc = { ...req.body, id };
    
    const { resource } = await container.item(id, id).replace(updatedDoc);
    console.log('[ControlOutages] Update successful for ID:', id);
    res.json(resource);
  } catch (err) {
    console.error('[ControlOutages] Update error for ID:', req.params.id, err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE
router.delete('/:id', requireAuth(), requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[ControlOutages] DELETE request for ID:', id);
    await container.item(id, id).delete();
    console.log('[ControlOutages] Delete successful for ID:', id);
    res.status(204).end();
  } catch (err) {
    console.error('[ControlOutages] Delete error for ID:', req.params.id, err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 