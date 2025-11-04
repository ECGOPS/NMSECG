const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const { requireRole } = require('../roles');

const router = express.Router();
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const op5ContainerId = 'op5Faults';
const controlContainerId = 'controlOutages';

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const op5Container = database.container(op5ContainerId);
const controlContainer = database.container(controlContainerId);

// Log endpoint status only in development
if (process.env.NODE_ENV === 'development') {
  console.log('[Faults] Endpoint:', endpoint);
  console.log('[Faults] Database:', databaseId);
  console.log('[Faults] Containers:', { op5: op5ContainerId, control: controlContainerId });
}

// GET all faults (combined OP5 and control outages)
router.get('/', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    console.log('[Faults] GET request received with query:', req.query);
    
    // Extract query parameters
    let {
      regionId,
      districtId,
      status,
      search,
      startDate,
      endDate,
      sort = 'occurrenceDate',
      order = 'desc',
      limit = 20,
      offset = 0,
      countOnly = false
    } = req.query;

    // Build base query for OP5 faults
    let op5QueryStr = 'SELECT * FROM c';
    const op5Filters = [];
    
    // Determine if we need role-based filtering (applies to all roles except system_admin and global_engineer)
    let roleFilter = null;
    if (!regionId && !districtId && req.user && req.user.role !== "system_admin" && req.user.role !== "global_engineer") {
      console.log('[Faults] Applying role-based filtering for role:', req.user.role);
      
      if (req.user.role === "district_engineer" || req.user.role === "district_manager" || req.user.role === "technician") {
        // District users can only see their assigned district
        if (req.user.district) {
          roleFilter = `c.district = "${req.user.district}"`;
          console.log('[Faults] Filtering by district:', req.user.district);
        }
      } else if (req.user.role === "regional_engineer" || req.user.role === "regional_general_manager" || req.user.role === "project_engineer") {
        // Regional users can only see their assigned region
        if (req.user.region) {
          roleFilter = `c.region = "${req.user.region}"`;
          console.log('[Faults] Filtering by region:', req.user.region);
        }
      } else if (req.user.role === "ashsubt") {
        // Ashsubt users can see multiple regions: SUBTRANSMISSION ASHANTI, ASHANTI EAST, ASHANTI WEST, ASHANTI SOUTH
        const ashsubtRegions = ['SUBTRANSMISSION ASHANTI', 'ASHANTI EAST REGION', 'ASHANTI WEST REGION', 'ASHANTI SOUTH REGION'];
        const regionConditions = ashsubtRegions.map(r => `c.region = "${r}"`);
        roleFilter = `(${regionConditions.join(' OR ')})`;
        console.log('[Faults] Ashsubt user - filtering to Ashanti regions:', ashsubtRegions.join(', '));
      } else if (req.user.role === "accsubt") {
        // Accsubt users can see multiple regions: SUBTRANSMISSION ACCRA, ACCRA EAST, ACCRA WEST
        const accsubtRegions = ['SUBTRANSMISSION ACCRA', 'ACCRA EAST REGION', 'ACCRA WEST REGION'];
        const regionConditions = accsubtRegions.map(r => `c.region = "${r}"`);
        roleFilter = `(${regionConditions.join(' OR ')})`;
        console.log('[Faults] Accsubt user - filtering to Accra regions:', accsubtRegions.join(', '));
      }
    }
    
    // Add date filtering if provided
    if (startDate || endDate) {
      if (startDate) {
        op5Filters.push(`c.occurrenceDate >= "${startDate}"`);
      }
      if (endDate) {
        op5Filters.push(`c.occurrenceDate <= "${endDate}"`);
      }
    }
    
    if (regionId) op5Filters.push(`c.regionId = "${regionId}"`);
    if (districtId) op5Filters.push(`c.districtId = "${districtId}"`);
    if (status) op5Filters.push(`c.status = "${status}"`);
    
    // Apply role-based filter if needed
    if (roleFilter) {
      op5Filters.push(roleFilter);
    }
    
    if (op5Filters.length) {
      op5QueryStr += ' WHERE ' + op5Filters.join(' AND ');
    }

    // Build base query for control outages
    let controlQueryStr = 'SELECT * FROM c';
    const controlFilters = [];
    
    // Add date filtering if provided
    if (startDate || endDate) {
      if (startDate) {
        controlFilters.push(`c.occurrenceDate >= "${startDate}"`);
      }
      if (endDate) {
        controlFilters.push(`c.occurrenceDate <= "${endDate}"`);
      }
    }
    
    if (regionId) controlFilters.push(`c.regionId = "${regionId}"`);
    if (districtId) controlFilters.push(`c.districtId = "${districtId}"`);
    if (status) controlFilters.push(`c.status = "${status}"`);
    
    // Apply role-based filter if needed
    if (roleFilter) {
      controlFilters.push(roleFilter);
    }
    
    if (controlFilters.length) {
      controlQueryStr += ' WHERE ' + controlFilters.join(' AND ');
    }

    // Add sorting
    if (sort) {
      op5QueryStr += ` ORDER BY c.${sort} ${order === 'desc' ? 'DESC' : 'ASC'}`;
      controlQueryStr += ` ORDER BY c.${sort} ${order === 'desc' ? 'DESC' : 'ASC'}`;
    }

    // Parse pagination parameters
    const parsedLimit = parseInt(limit);
    const parsedOffset = parseInt(offset);
    const maxLimit = 1000;
    const finalLimit = Math.min(parsedLimit, maxLimit);

    // Performance warning for large queries
    if (parsedLimit > 500) {
      console.warn('[Faults] Large query requested:', {
        requestedLimit: parsedLimit,
        finalLimit,
        warning: 'Large queries may impact performance'
      });
    }

    console.log('[Faults] Pagination params:', {
      requestedLimit: parsedLimit,
      finalLimit,
      offset: parsedOffset,
      countOnly
    });

    // Count-only shortcut for better performance
    if (countOnly) {
      try {
        // Get counts from both containers
        const [op5CountQuery, controlCountQuery] = [
          op5QueryStr.replace(/SELECT \* FROM c/, 'SELECT VALUE COUNT(1) FROM c'),
          controlQueryStr.replace(/SELECT \* FROM c/, 'SELECT VALUE COUNT(1) FROM c')
        ];

        const [op5CountResult, controlCountResult] = await Promise.all([
          op5Container.items.query(op5CountQuery).fetchAll(),
          controlContainer.items.query(controlCountQuery).fetchAll()
        ]);

        const op5Total = op5CountResult.resources[0] ?? 0;
        const controlTotal = controlCountResult.resources[0] ?? 0;
        const totalCount = op5Total + controlTotal;

        console.log('[Faults] Count query results:', { op5Total, controlTotal, totalCount });
        return res.json({ total: totalCount });
      } catch (countError) {
        console.error('[Faults] Count query error:', countError);
        return res.status(500).json({
          error: 'Failed to get fault count',
          details: countError.message
        });
      }
    }

    // Add pagination to queries
    op5QueryStr += ` OFFSET ${parsedOffset} LIMIT ${finalLimit}`;
    controlQueryStr += ` OFFSET ${parsedOffset} LIMIT ${finalLimit}`;

    // Execute queries for both containers
    console.log('[Faults] Final queries:', {
      op5: op5QueryStr,
      control: controlQueryStr
    });

    const startTime = Date.now();
    let op5Resources = [];
    let controlResources = [];
    let executionTime = 0;

    try {
      const [op5Result, controlResult] = await Promise.all([
        op5Container.items.query(op5QueryStr).fetchAll(),
        controlContainer.items.query(controlQueryStr).fetchAll()
      ]);

      op5Resources = op5Result.resources;
      controlResources = controlResult.resources;
      executionTime = Date.now() - startTime;
      
      console.log('[Faults] Queries executed successfully in', executionTime, 'ms');
      console.log('[Faults] Results:', {
        op5Count: op5Resources.length,
        controlCount: controlResources.length,
        totalCount: op5Resources.length + controlResources.length
      });
    } catch (queryError) {
      console.error('[Faults] Query execution error:', queryError);
      return res.status(500).json({
        error: 'Database query failed',
        details: queryError.message,
        code: queryError.code
      });
    }

    // Combine and sort results by occurrence date
    let combinedResources = [...op5Resources, ...controlResources];
    
    if (sort === 'occurrenceDate') {
      combinedResources.sort((a, b) => {
        const dateA = new Date(a.occurrenceDate).getTime();
        const dateB = new Date(b.occurrenceDate).getTime();
        return order === 'desc' ? dateB - dateA : dateA - dateB;
      });
    }

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      combinedResources = combinedResources.filter(fault => {
        // Check if it's an OP5 fault or control outage
        const isOP5 = 'substationName' in fault;
        
        if (isOP5) {
          return (
            (fault.faultType && fault.faultType.toLowerCase().includes(searchLower)) ||
            (fault.description && fault.description.toLowerCase().includes(searchLower)) ||
            (fault.substationName && fault.substationName.toLowerCase().includes(searchLower))
          );
        } else {
          return (
            (fault.faultType && fault.faultType.toLowerCase().includes(searchLower)) ||
            (fault.reason && fault.reason.toLowerCase().includes(searchLower)) ||
            (fault.areaAffected && fault.areaAffected.toLowerCase().includes(searchLower))
          );
        }
      });
    }

    // Get total count for pagination info
    let totalCount = 0;
    try {
      const [op5CountQuery, controlCountQuery] = [
        'SELECT VALUE COUNT(1) FROM c' + (op5Filters.length ? ' WHERE ' + op5Filters.join(' AND ') : ''),
        'SELECT VALUE COUNT(1) FROM c' + (controlFilters.length ? ' WHERE ' + controlFilters.join(' AND ') : '')
      ];

      const [op5CountResult, controlCountResult] = await Promise.all([
        op5Container.items.query(op5CountQuery).fetchAll(),
        controlContainer.items.query(controlCountQuery).fetchAll()
      ]);

      const op5Total = op5CountResult.resources[0] ?? 0;
      const controlTotal = controlCountResult.resources[0] ?? 0;
      totalCount = op5Total + controlTotal;

      // Apply search filter to total count if search is provided
      if (search) {
        // This is a rough estimate - in production you might want to implement
        // more sophisticated search counting
        totalCount = Math.min(totalCount, combinedResources.length);
      }
    } catch (countError) {
      console.error('[Faults] Count query error:', countError);
      totalCount = combinedResources.length;
    }

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / finalLimit);
    const currentPage = Math.floor(parsedOffset / finalLimit) + 1;
    const hasNextPage = parsedOffset + finalLimit < totalCount;
    const hasPreviousPage = parsedOffset > 0;

    // Return structured response
    res.json({
      data: combinedResources,
      total: totalCount,
      page: currentPage,
      pageSize: finalLimit,
      totalPages,
      hasNextPage,
      hasPreviousPage,
      offset: parsedOffset,
      limit: finalLimit,
      executionTime: `${executionTime}ms`
    });

  } catch (error) {
    console.error('[Faults] Route error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// GET fault by ID (search in both containers)
router.get('/:id', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[Faults] GET by ID request:', id);

    // Try to find in OP5 faults first
    try {
      const op5Result = await op5Container.item(id, id).read();
      if (op5Result.resource) {
        console.log('[Faults] Found OP5 fault:', id);
        return res.json(op5Result.resource);
      }
    } catch (op5Error) {
      // Fault not found in OP5 container, continue to control outages
    }

    // Try to find in control outages
    try {
      const controlResult = await controlContainer.item(id, id).read();
      if (controlResult.resource) {
        console.log('[Faults] Found control outage:', id);
        return res.json(controlResult.resource);
      }
    } catch (controlError) {
      // Fault not found in control container
    }

    // Fault not found in either container
    console.log('[Faults] Fault not found:', id);
    return res.status(404).json({
      error: 'Fault not found',
      id: id
    });

  } catch (error) {
    console.error('[Faults] GET by ID error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

module.exports = router;
