const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const { requireRole } = require('../roles');
const dynamicPermissions = require('../middleware/dynamicPermissions');

const router = express.Router();
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'equipmentFailureReports';
const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

// GET all equipment failure reports with role-based filtering
router.get('/', dynamicPermissions.requireAccess('equipment_failure_reporting'), async (req, res) => {
  try {
    console.log('[EquipmentFailureReports] Request received:', {
      method: req.method,
      url: req.url,
      query: req.query,
      user: req.user
    });

    // Check if container exists
    try {
      await container.read();
      console.log('[EquipmentFailureReports] Container exists and is accessible');
    } catch (containerError) {
      console.error('[EquipmentFailureReports] Container error:', containerError);
      return res.status(500).json({
        error: 'Database container not accessible',
        details: containerError.message,
        code: containerError.code
      });
    }

    let queryStr = 'SELECT c.id, c.date, c.region, c.district, c.materialEquipmentName, c.typeOfMaterialEquipment, c.locationOfMaterialEquipment, c.ghanaPostGPS, c.nameOfManufacturer, c.serialNumber, c.manufacturingDate, c.countryOfOrigin, c.dateOfInstallation, c.dateOfCommission, c.descriptionOfMaterialEquipment, c.causeOfFailure, c.frequencyOfRepairs, c.historyOfRepairs, c.initialObservations, c.immediateActionsTaken, c.severityOfFault, c.preparedBy, c.contact, c.photo, c.createdAt, c.updatedAt, c.createdBy, c.updatedBy FROM c';

    // Apply role-based filtering
    const filters = [];
    console.log('[EquipmentFailureReports] User info:', {
      role: req.user?.role,
      district: req.user?.district,
      region: req.user?.region,
      userId: req.user?.id
    });

    if (req.user && req.user.role !== "system_admin" && req.user.role !== "global_engineer") {
      if (req.user.role === "district_engineer" || req.user.role === "district_manager" || req.user.role === "technician") {
        if (req.user.district) {
          filters.push(`c.district = "${req.user.district}"`);
          console.log('[EquipmentFailureReports] Added district filter:', req.user.district);
        } else {
          console.log('[EquipmentFailureReports] No district found for user:', req.user.role);
        }
      } else if (req.user.role === "regional_engineer" || req.user.role === "regional_general_manager" || req.user.role === "project_engineer") {
        if (req.user.region) {
          filters.push(`c.region = "${req.user.region}"`);
          console.log('[EquipmentFailureReports] Added region filter:', req.user.region);
        } else {
          console.log('[EquipmentFailureReports] No region found for user:', req.user.role);
        }
      } else if (req.user.role === "ashsubt") {
        // Ashsubt users can see multiple regions: SUBTRANSMISSION ASHANTI, ASHANTI EAST, ASHANTI WEST, ASHANTI SOUTH
        const ashsubtRegions = ['SUBTRANSMISSION ASHANTI', 'ASHANTI EAST REGION', 'ASHANTI WEST REGION', 'ASHANTI SOUTH REGION'];
        const regionConditions = ashsubtRegions.map(r => `c.region = "${r}"`);
        filters.push(`(${regionConditions.join(' OR ')})`);
        console.log('[EquipmentFailureReports] Added ashsubt multi-region filter:', ashsubtRegions.join(', '));
      } else if (req.user.role === "accsubt") {
        // Accsubt users can see multiple regions: SUBTRANSMISSION ACCRA, ACCRA EAST, ACCRA WEST
        const accsubtRegions = ['SUBTRANSMISSION ACCRA', 'ACCRA EAST REGION', 'ACCRA WEST REGION'];
        const regionConditions = accsubtRegions.map(r => `c.region = "${r}"`);
        filters.push(`(${regionConditions.join(' OR ')})`);
        console.log('[EquipmentFailureReports] Added accsubt multi-region filter:', accsubtRegions.join(', '));
      } else {
        console.log('[EquipmentFailureReports] User role not handled for filtering:', req.user.role);
      }
    } else {
      console.log('[EquipmentFailureReports] Admin/Global engineer - no filtering applied');
    }

    // Add additional filters from query parameters
    if (req.query.region && req.query.region !== 'all') {
      filters.push(`c.region = "${req.query.region}"`);
      console.log('[EquipmentFailureReports] Added region filter from query:', req.query.region);
    }
    
    if (req.query.district && req.query.district !== 'all') {
      filters.push(`c.district = "${req.query.district}"`);
      console.log('[EquipmentFailureReports] Added district filter from query:', req.query.district);
    }
    
    if (req.query.date) {
      filters.push(`c.date = "${req.query.date}"`);
      console.log('[EquipmentFailureReports] Added date filter from query:', req.query.date);
    }

    if (req.query.type && req.query.type !== 'all') {
      filters.push(`c.typeOfMaterialEquipment = "${req.query.type}"`);
      console.log('[EquipmentFailureReports] Added type filter from query:', req.query.type);
    }

    if (req.query.severity && req.query.severity !== 'all') {
      filters.push(`c.severityOfFault = "${req.query.severity}"`);
      console.log('[EquipmentFailureReports] Added severity filter from query:', req.query.severity);
    }

    // Build final query
    if (filters.length > 0) {
      queryStr += ' WHERE ' + filters.join(' AND ');
    }

    // Add sorting
    const sortField = req.query.sortField || 'date';
    const sortDirection = req.query.sortDirection || 'desc';
    queryStr += ` ORDER BY c.${sortField} ${sortDirection.toUpperCase()}`;

    // Add pagination
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const offset = (page - 1) * pageSize;
    queryStr += ` OFFSET ${offset} LIMIT ${pageSize}`;

    console.log('[EquipmentFailureReports] Final query:', queryStr);

    // Execute query
    const { resources: reports } = await container.items.query(queryStr).fetchAll();

    // Get total count for pagination
    let countQuery = 'SELECT VALUE COUNT(1) FROM c';
    if (filters.length > 0) {
      countQuery += ' WHERE ' + filters.join(' AND ');
    }
    
    const { resources: countResult } = await container.items.query(countQuery).fetchAll();
    const totalCount = countResult[0] || 0;

    console.log('[EquipmentFailureReports] Query results:', {
      reportsCount: reports.length,
      totalCount,
      page,
      pageSize,
      filters: filters.length
    });

    res.json({
      records: reports,
      total: totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize)
    });

  } catch (error) {
    console.error('[EquipmentFailureReports] Error:', error);
    res.status(500).json({
      error: 'Failed to fetch equipment failure reports',
      details: error.message
    });
  }
});

// GET single equipment failure report by ID
router.get('/:id', dynamicPermissions.requireAccess('equipment_failure_reporting'), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[EquipmentFailureReports] Get by ID request:', { id, user: req.user });

    const { resource: report } = await container.item(id, id).read();

    if (!report) {
      return res.status(404).json({ error: 'Equipment failure report not found' });
    }

    // Check if user has access to this report based on role
    if (req.user && req.user.role !== "system_admin" && req.user.role !== "global_engineer") {
      if (req.user.role === "district_engineer" || req.user.role === "district_manager" || req.user.role === "technician") {
        if (req.user.district && report.district !== req.user.district) {
          return res.status(403).json({ error: 'Access denied to this report' });
        }
      } else if (req.user.role === "regional_engineer" || req.user.role === "regional_general_manager" || req.user.role === "project_engineer") {
        if (req.user.region && report.region !== req.user.region) {
          return res.status(403).json({ error: 'Access denied to this report' });
        }
      } else if (req.user.role === "ashsubt") {
        // Ashsubt users can access reports from their allowed regions
        const ashsubtRegions = ['SUBTRANSMISSION ASHANTI', 'ASHANTI EAST REGION', 'ASHANTI WEST REGION', 'ASHANTI SOUTH REGION'];
        if (!ashsubtRegions.includes(report.region)) {
          return res.status(403).json({ error: 'Access denied to this report' });
        }
      } else if (req.user.role === "accsubt") {
        // Accsubt users can access reports from their allowed regions
        const accsubtRegions = ['SUBTRANSMISSION ACCRA', 'ACCRA EAST REGION', 'ACCRA WEST REGION'];
        if (!accsubtRegions.includes(report.region)) {
          return res.status(403).json({ error: 'Access denied to this report' });
        }
      }
    }

    res.json(report);

  } catch (error) {
    console.error('[EquipmentFailureReports] Error getting by ID:', error);
    res.status(500).json({
      error: 'Failed to fetch equipment failure report',
      details: error.message
    });
  }
});

// POST new equipment failure report
router.post('/', dynamicPermissions.requireCreate('equipment_failure_reporting'), async (req, res) => {
  try {
    console.log('[EquipmentFailureReports] Create request:', {
      body: req.body,
      user: req.user
    });

    const reportData = {
      ...req.body,
      id: req.body.id || `efr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.user.id,
      updatedBy: req.user.id
    };

    // Validate required fields
    if (!reportData.date || !reportData.materialEquipmentName || !reportData.typeOfMaterialEquipment || !reportData.locationOfMaterialEquipment) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['date', 'materialEquipmentName', 'typeOfMaterialEquipment', 'locationOfMaterialEquipment']
      });
    }

    // Apply role-based restrictions
    if (req.user.role === "district_engineer" || req.user.role === "district_manager" || req.user.role === "technician") {
      if (req.user.district) {
        reportData.district = req.user.district;
      }
      if (req.user.region) {
        reportData.region = req.user.region;
      }
    } else if (req.user.role === "regional_engineer" || req.user.role === "regional_general_manager" || req.user.role === "project_engineer") {
      if (req.user.region) {
        reportData.region = req.user.region;
      }
    }

    const { resource: createdReport } = await container.items.create(reportData);

    console.log('[EquipmentFailureReports] Report created successfully:', {
      id: createdReport.id,
      materialEquipmentName: createdReport.materialEquipmentName,
      createdBy: createdReport.createdBy
    });

    res.status(201).json(createdReport);

  } catch (error) {
    console.error('[EquipmentFailureReports] Error creating report:', error);
    res.status(500).json({
      error: 'Failed to create equipment failure report',
      details: error.message
    });
  }
});

// PUT update equipment failure report
router.put('/:id', dynamicPermissions.requireUpdate('equipment_failure_reporting'), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[EquipmentFailureReports] Update request:', { id, body: req.body, user: req.user });

    // Get existing report
    const { resource: existingReport } = await container.item(id, id).read();

    if (!existingReport) {
      return res.status(404).json({ error: 'Equipment failure report not found' });
    }

    // Check if user has access to update this report
    if (req.user && req.user.role !== "system_admin" && req.user.role !== "global_engineer") {
      if (req.user.role === "district_engineer" || req.user.role === "district_manager") {
        if (req.user.district && existingReport.district !== req.user.district) {
          return res.status(403).json({ error: 'Access denied to update this report' });
        }
      } else if (req.user.role === "regional_engineer" || req.user.role === "regional_general_manager" || req.user.role === "project_engineer") {
        if (req.user.region && existingReport.region !== req.user.region) {
          return res.status(403).json({ error: 'Access denied to update this report' });
        }
      } else if (req.user.role === "ashsubt") {
        // Ashsubt users can update reports from their allowed regions
        const ashsubtRegions = ['SUBTRANSMISSION ASHANTI', 'ASHANTI EAST REGION', 'ASHANTI WEST REGION', 'ASHANTI SOUTH REGION'];
        if (!ashsubtRegions.includes(existingReport.region)) {
          return res.status(403).json({ error: 'Access denied to update this report' });
        }
      } else if (req.user.role === "accsubt") {
        // Accsubt users can update reports from their allowed regions
        const accsubtRegions = ['SUBTRANSMISSION ACCRA', 'ACCRA EAST REGION', 'ACCRA WEST REGION'];
        if (!accsubtRegions.includes(existingReport.region)) {
          return res.status(403).json({ error: 'Access denied to update this report' });
        }
      }
    }

    const updateData = {
      ...existingReport,
      ...req.body,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.id
    };

    const { resource: updatedReport } = await container.item(id, id).replace(updateData);

    console.log('[EquipmentFailureReports] Report updated successfully:', {
      id: updatedReport.id,
      updatedBy: updatedReport.updatedBy
    });

    res.json(updatedReport);

  } catch (error) {
    console.error('[EquipmentFailureReports] Error updating report:', error);
    res.status(500).json({
      error: 'Failed to update equipment failure report',
      details: error.message
    });
  }
});

// DELETE equipment failure report
router.delete('/:id', dynamicPermissions.requireDelete('equipment_failure_reporting'), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[EquipmentFailureReports] Delete request:', { id, user: req.user });

    // Get existing report to check access
    const { resource: existingReport } = await container.item(id, id).read();

    if (!existingReport) {
      return res.status(404).json({ error: 'Equipment failure report not found' });
    }

    // Check if user has access to delete this report
    if (req.user && req.user.role !== "system_admin" && req.user.role !== "global_engineer") {
      if (req.user.role === "district_engineer" || req.user.role === "district_manager") {
        if (req.user.district && existingReport.district !== req.user.district) {
          return res.status(403).json({ error: 'Access denied to delete this report' });
        }
      } else if (req.user.role === "regional_engineer" || req.user.role === "regional_general_manager" || req.user.role === "project_engineer") {
        if (req.user.region && existingReport.region !== req.user.region) {
          return res.status(403).json({ error: 'Access denied to delete this report' });
        }
      } else if (req.user.role === "ashsubt") {
        // Ashsubt users can delete reports from their allowed regions
        const ashsubtRegions = ['SUBTRANSMISSION ASHANTI', 'ASHANTI EAST REGION', 'ASHANTI WEST REGION', 'ASHANTI SOUTH REGION'];
        if (!ashsubtRegions.includes(existingReport.region)) {
          return res.status(403).json({ error: 'Access denied to delete this report' });
        }
      } else if (req.user.role === "accsubt") {
        // Accsubt users can delete reports from their allowed regions
        const accsubtRegions = ['SUBTRANSMISSION ACCRA', 'ACCRA EAST REGION', 'ACCRA WEST REGION'];
        if (!accsubtRegions.includes(existingReport.region)) {
          return res.status(403).json({ error: 'Access denied to delete this report' });
        }
      }
    }

    await container.item(id, id).delete();

    console.log('[EquipmentFailureReports] Report deleted successfully:', { id });

    res.json({ message: 'Equipment failure report deleted successfully' });

  } catch (error) {
    console.error('[EquipmentFailureReports] Error deleting report:', error);
    res.status(500).json({
      error: 'Failed to delete equipment failure report',
      details: error.message
    });
  }
});

module.exports = router;
