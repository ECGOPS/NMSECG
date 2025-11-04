const { auth } = require('express-oauth2-jwt-bearer');

// Get values from environment variables
const audience = process.env.AZURE_AD_AUDIENCE;
const tenantId = process.env.AZURE_AD_TENANT_ID;

// Validate required environment variables
if (!audience || !tenantId) {
  console.error('[JWT] ❌ Missing required environment variables:');
  console.error('   AZURE_AD_AUDIENCE:', audience ? 'SET' : 'MISSING');
  console.error('   AZURE_AD_TENANT_ID:', tenantId ? 'SET' : 'MISSING');
  console.error('[JWT] Please set these environment variables for JWT authentication');
  process.exit(1);
}

console.log('[JWT] Configuring JWT with:', {
  audience: audience.replace('api://', ''),
  issuerBaseURL: `https://login.microsoftonline.com/${tenantId}/v2.0`,
  tenantId: tenantId
});

const jwtCheck = auth({
  audience: audience.replace('api://', ''),
  issuerBaseURL: `https://login.microsoftonline.com/${tenantId}/v2.0`,
  tokenSigningAlg: 'RS256',
});

// Single consolidated JWT middleware that handles everything
const jwtCheckWithDebug = async (req, res, next) => {
  console.log('[JWT] Processing request:', req.path);
  console.log('[JWT] Authorization header:', req.headers.authorization ? 'Present' : 'Missing');
  
  if (req.headers.authorization) {
    console.log('[JWT] Token starts with:', req.headers.authorization.substring(0, 50) + '...');
    console.log('[JWT] Token format check:', req.headers.authorization.startsWith('Bearer ') ? 'Correct' : 'Incorrect');
  }
  
  jwtCheck(req, res, async (err) => {
    if (err) {
      console.log('[JWT] ❌ JWT validation failed:', err.message);
      console.log('[JWT] Error details:', err);
      console.log('[JWT] Error stack:', err.stack);
      return next(err);
    }
    
    console.log('[JWT] ✅ JWT validation passed');
    console.log('[JWT] req.auth.payload.sub:', req.auth?.payload?.sub);
    console.log('[JWT] req.auth.payload.oid:', req.auth?.payload?.oid);
    
    // Handle user authentication and role assignment here
    if (process.env.NODE_ENV === 'production' || process.env.TEST_JWT === 'true') {
      try {
        const { CosmosClient } = require('@azure/cosmos');
        const client = new CosmosClient({ 
          endpoint: process.env.COSMOS_DB_ENDPOINT, 
          key: process.env.COSMOS_DB_KEY 
        });
        const database = client.database(process.env.COSMOS_DB_DATABASE);
        const container = database.container('users');
        
        const tokenUserId = (req.auth?.payload?.oid) || (req.auth?.payload?.sub);
        
        if (tokenUserId) {
          console.log(`[JWT] 🔍 Looking for user with UID: ${tokenUserId}`);
          
          // Try to find user by JWT UID first
          let { resources } = await container.items.query({
            query: 'SELECT * FROM c WHERE c.uid = @uid',
            parameters: [{ name: '@uid', value: tokenUserId }]
          }).fetchAll();
          
          console.log(`[JWT] 🔍 Users found by UID: ${resources.length}`);
          
          if (resources.length > 0) {
            // User found by JWT UID
            const userData = resources[0];
            req.userRole = userData.role;
            req.userId = tokenUserId;
            req.user = userData;
            
            console.log(`[JWT] ✅ User found by UID:`, { id: userData.id, role: userData.role, email: userData.email });
          } else {
            // Try to find user by email
            const jwtEmail = (req.auth?.payload?.email || req.auth?.payload?.preferred_username || '').toLowerCase();
            console.log(`[JWT] 🔍 Looking for user by email: ${jwtEmail}`);
            
            const { resources: emailUsers } = await container.items.query({
              query: 'SELECT * FROM c WHERE LOWER(c.email) = @email',
              parameters: [{ name: '@email', value: jwtEmail }]
            }).fetchAll();
            
            console.log(`[JWT] 🔍 Users found by email: ${emailUsers.length}`);
            
            if (emailUsers.length > 0) {
              // Found existing user by email - update UID in database
              const existingUser = emailUsers[0];
              console.log(`[JWT] Setting req.userRole to: ${existingUser.role}`);
              req.userRole = existingUser.role;
              req.userId = tokenUserId;
              req.user = existingUser;
              
              console.log(`[JWT] ✅ User found by email:`, { id: existingUser.id, role: existingUser.role, email: existingUser.email });
              console.log(`[JWT] 🔄 Updating UID: ${existingUser.id} -> ${tokenUserId}`);
              
              // Update the user's UID in the database so future lookups work
              try {
                const updatedUser = { ...existingUser, uid: tokenUserId, updatedAt: new Date().toISOString() };
                await container.item(existingUser.id, existingUser.id).replace(updatedUser);
                console.log(`[JWT] ✅ UID updated in database for user: ${existingUser.email}`);
              } catch (updateError) {
                console.error(`[JWT] ⚠️ Failed to update UID in database:`, updateError);
                // Continue anyway - the user can still authenticate
              }
            } else {
              // Create new user in database
              const jwtEmail = (req.auth?.payload?.email || req.auth?.payload?.preferred_username || '').toLowerCase();
              const jwtName = req.auth?.payload?.name || req.auth?.payload?.preferred_username || 'Unknown User';
              
              const newUser = {
                id: tokenUserId,
                uid: tokenUserId,
                email: jwtEmail,
                name: jwtName,
                displayName: jwtName,
                role: 'pending', // Set to pending for approval
                status: 'pre_registered',
                region: '',
                district: '',
                staffId: '',
                disabled: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              
              try {
                // Create the user in the database
                const { resource } = await container.items.create(newUser);
                console.log(`[JWT] ✅ New user created in database:`, { id: resource.id, role: resource.role });
                
                req.userRole = resource.role;
                req.userId = tokenUserId;
                req.user = resource;
              } catch (createError) {
                console.error(`[JWT] ❌ Failed to create user in database:`, createError);
                // Fallback to temporary values
                req.userRole = 'pending';
                req.userId = tokenUserId;
                req.user = newUser;
              }
            }
          }
        }
      } catch (error) {
        console.error('[JWT] Error during user authentication:', error);
        // Continue with default values
        req.userRole = 'pending';
        req.userId = req.auth?.payload?.oid || req.auth?.payload?.sub;
        req.user = { id: req.userId, role: 'pending' };
      }
    }
    
    // Log final role assignment
    console.log(`[JWT] 🎯 Final role assignment:`, { 
      userId: req.userId, 
      userRole: req.userRole,
      userEmail: req.user?.email 
    });
    
    // Additional debug logging
    console.log(`[JWT] 🔍 req.userRole after assignment: ${req.userRole}`);
    console.log(`[JWT] 🔍 req.userRole type: ${typeof req.userRole}`);
    console.log(`[JWT] 🔍 req.userRole === null: ${req.userRole === null}`);
    console.log(`[JWT] 🔍 req.userRole === undefined: ${req.userRole === undefined}`);
    
    next();
  });
};

module.exports = jwtCheckWithDebug;
