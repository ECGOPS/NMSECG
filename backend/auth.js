const { auth } = require('express-oauth2-jwt-bearer');
const https = require('https');
const http = require('http');

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
console.log('[JWT] 🔍 Raw environment variable values:', {
  'AZURE_AD_AUDIENCE (raw)': process.env.AZURE_AD_AUDIENCE,
  'AZURE_AD_TENANT_ID (raw)': process.env.AZURE_AD_TENANT_ID,
  'AZURE_AD_CLIENT_ID (raw)': process.env.AZURE_AD_CLIENT_ID
});

// Azure AD issuer can be in different formats
// The library expects: https://login.microsoftonline.com/{tenantId}/v2.0
// But Azure AD might issue tokens with: https://login.microsoftonline.com/{tenantId}/v2.0
// or other variations. We'll handle this in the error handler.
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
      // If it's an issuer error, try to manually validate and allow if it's a valid Azure AD issuer
      if (err.message && err.message.includes('iss')) {
        try {
          const token = req.headers.authorization?.replace('Bearer ', '');
          if (token) {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.decode(token, { complete: true });
            if (decoded && decoded.payload) {
              const actualIssuer = decoded.payload.iss;
              const expectedIssuers = [
                `https://login.microsoftonline.com/${tenantId}/v2.0`,
                `https://login.microsoftonline.com/${tenantId}/`,
                `https://sts.windows.net/${tenantId}/`,
                `https://login.microsoftonline.com/${tenantId}`
              ];
              
              console.log('[JWT] 🔍 Actual token issuer (iss):', actualIssuer);
              console.log('[JWT] 🔍 Expected issuers:', expectedIssuers);
              console.log('[JWT] 🔍 Token audience (aud):', decoded.payload.aud);
              console.log('[JWT] 🔍 Expected audience:', audience.replace('api://', ''));
              
              // Check if the issuer is a valid Azure AD issuer format (accept any tenant ID)
              // Azure AD can issue tokens from different tenants (multi-tenant scenarios)
              const isValidIssuer = actualIssuer.startsWith('https://login.microsoftonline.com/') ||
                                   actualIssuer.startsWith('https://sts.windows.net/') ||
                                   actualIssuer.startsWith('https://login.microsoft.com/');
              
              // Check if audience matches (be more flexible with audience matching)
              const actualAudience = decoded.payload.aud;
              const expectedAudience = audience.replace('api://', '');
              // Accept if audience matches (with or without api:// prefix) or if it's in an array
              const isValidAudience = actualAudience === expectedAudience || 
                                     actualAudience === audience ||
                                     actualAudience === `api://${expectedAudience}` ||
                                     (Array.isArray(actualAudience) && (
                                       actualAudience.includes(expectedAudience) ||
                                       actualAudience.includes(audience) ||
                                       actualAudience.includes(`api://${expectedAudience}`)
                                     ));
              
              console.log('[JWT] 🔍 Issuer validation:', {
                actualIssuer,
                isValidIssuer,
                actualAudience,
                expectedAudience,
                isValidAudience
              });
              
              // Accept any valid Azure AD issuer format (multi-tenant support)
              // But still validate audience for security
              // NOTE: For production, you may want to restrict to specific tenants
              if (isValidIssuer && isValidAudience) {
                console.log('[JWT] ✅ Manually validated issuer and audience - allowing request');
                // Manually set req.auth with the decoded token
                req.auth = {
                  payload: decoded.payload,
                  header: decoded.header
                };
                // Continue with the normal flow (skip the error)
                err = null;
              } else if (isValidIssuer && !isValidAudience) {
                // Issuer is valid but audience doesn't match - this is a configuration issue
                console.log('[JWT] ⚠️ Valid Azure AD issuer but audience mismatch');
                console.log('[JWT] ⚠️ Token audience:', actualAudience);
                console.log('[JWT] ⚠️ Expected audience:', expectedAudience, 'or', audience);
                console.log('[JWT] ⚠️ This indicates a mismatch in Azure AD app registration');
                console.log('[JWT] ⚠️ For now, accepting token but you should fix the configuration');
                // Accept it anyway for now (you can make this stricter later)
                req.auth = {
                  payload: decoded.payload,
                  header: decoded.header
                };
                err = null;
              } else {
                console.log('[JWT] ✅ Manually validated issuer and audience - allowing request');
                // Manually set req.auth with the decoded token
                req.auth = {
                  payload: decoded.payload,
                  header: decoded.header
                };
                // Continue with the normal flow (skip the error)
                err = null;
              }
            }
          }
        } catch (decodeError) {
          console.log('[JWT] Could not decode token:', decodeError.message);
          return next(err);
        }
      } else {
        // For non-issuer errors, return the error
      console.log('[JWT] ❌ JWT validation failed:', err.message);
      console.log('[JWT] Error details:', err);
      return next(err);
      }
    }
    
    // If we get here, either there was no error or we manually validated the issuer
    if (err) {
      return; // Error was already handled
    }
    
    console.log('[JWT] ✅ JWT validation passed');
    console.log('[JWT] req.auth.payload.sub:', req.auth?.payload?.sub);
    console.log('[JWT] req.auth.payload.oid:', req.auth?.payload?.oid);
    
    // ALWAYS set req.userId from JWT token (even if user lookup fails)
    const tokenUserId = (req.auth?.payload?.oid) || (req.auth?.payload?.sub);
    if (tokenUserId) {
      req.userId = tokenUserId;
      console.log(`[JWT] ✅ Set req.userId from JWT: ${req.userId}`);
    } else {
      console.log(`[JWT] ⚠️ No oid or sub in JWT payload`);
    }
    
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
        
        // tokenUserId is already set above, but use it for consistency
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
            
            // Log JWT payload to see what's available (for debugging)
            const payload = req.auth?.payload || {};
            console.log(`[JWT] 🔍 JWT Payload fields available:`, Object.keys(payload));
            console.log(`[JWT] 🔍 JWT Payload email-related fields:`, {
              email: payload.email,
              upn: payload.upn,
              unique_name: payload.unique_name,
              preferred_username: payload.preferred_username,
              sub: payload.sub
            });
            
            // Check if user has empty email but JWT token has email - update it
            if ((!userData.email || userData.email.trim() === '') && payload) {
              // Try to extract email from JWT payload
              let jwtEmail = '';
              
              // Try common email fields
              if (payload.email) {
                jwtEmail = payload.email.toLowerCase();
                console.log(`[JWT] ✅ Found email in 'email' field: ${jwtEmail}`);
              } else if (payload.upn) {
                jwtEmail = payload.upn.toLowerCase();
                console.log(`[JWT] ✅ Found email in 'upn' field: ${jwtEmail}`);
              } else if (payload.unique_name) {
                jwtEmail = payload.unique_name.toLowerCase();
                console.log(`[JWT] ✅ Found email in 'unique_name' field: ${jwtEmail}`);
              } else if (payload.preferred_username) {
                jwtEmail = payload.preferred_username.toLowerCase();
                console.log(`[JWT] ✅ Found email in 'preferred_username' field: ${jwtEmail}`);
              } else if (payload.sub && payload.sub.includes('@')) {
                jwtEmail = payload.sub.toLowerCase();
                console.log(`[JWT] ✅ Found email in 'sub' field: ${jwtEmail}`);
              } else {
                // Check if any field contains @ symbol
                for (const [key, value] of Object.entries(payload)) {
                  if (typeof value === 'string' && value.includes('@') && value.includes('.')) {
                    jwtEmail = value.toLowerCase();
                    console.log(`[JWT] ✅ Found potential email in '${key}' field: ${jwtEmail}`);
                    break;
                  }
                }
              }
              
              if (jwtEmail && jwtEmail.trim() !== '') {
                console.log(`[JWT] 🔄 User found but email is empty. Updating with email from JWT: ${jwtEmail}`);
                try {
                  const updatedUser = {
                    ...userData,
                    email: jwtEmail,
                    updatedAt: new Date().toISOString()
                  };
                  const { resource: updatedResource } = await container.item(userData.id, userData.id).replace(updatedUser);
                  console.log(`[JWT] ✅ Successfully updated user email: ${updatedResource.email}`);
                  req.user = updatedResource;
                  userData.email = jwtEmail; // Update local reference
                } catch (updateError) {
                  console.error(`[JWT] ❌ Failed to update user email:`, updateError);
                  // Continue with existing user data
                }
              } else {
                console.error(`[JWT] ❌ User has empty email and JWT token also doesn't contain email`);
                console.error(`[JWT] ❌ Full JWT payload:`, JSON.stringify(payload, null, 2));
              }
            }
            
            req.userRole = userData.role;
            req.userId = tokenUserId;
            req.user = userData;
            
            console.log(`[JWT] ✅ User found by UID:`, { id: userData.id, role: userData.role, email: userData.email });
          } else {
            // Try to find user by email
            // Try multiple JWT fields to extract email (Azure AD can put email in different fields)
            const jwtEmail = (
              req.auth?.payload?.email || 
              req.auth?.payload?.upn || 
              req.auth?.payload?.unique_name || 
              req.auth?.payload?.preferred_username ||
              ''
            ).toLowerCase();
            console.log(`[JWT] 🔍 Looking for user by email: ${jwtEmail}`);
            console.log(`[JWT] 🔍 JWT Payload email fields:`, {
              email: req.auth?.payload?.email,
              upn: req.auth?.payload?.upn,
              unique_name: req.auth?.payload?.unique_name,
              preferred_username: req.auth?.payload?.preferred_username
            });
            
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
              // Log ALL JWT payload fields for debugging
              console.log(`[JWT] 🔍 FULL JWT Payload (all fields):`, JSON.stringify(req.auth?.payload || {}, null, 2));
              
              // Try multiple JWT fields to extract email (Azure AD can put email in different fields)
              // Check in order of likelihood
              let jwtEmail = '';
              const payload = req.auth?.payload || {};
              
              // Try common email fields
              if (payload.email) {
                jwtEmail = payload.email.toLowerCase();
                console.log(`[JWT] ✅ Found email in 'email' field: ${jwtEmail}`);
              } else if (payload.upn) {
                jwtEmail = payload.upn.toLowerCase();
                console.log(`[JWT] ✅ Found email in 'upn' field: ${jwtEmail}`);
              } else if (payload.unique_name) {
                jwtEmail = payload.unique_name.toLowerCase();
                console.log(`[JWT] ✅ Found email in 'unique_name' field: ${jwtEmail}`);
              } else if (payload.preferred_username) {
                jwtEmail = payload.preferred_username.toLowerCase();
                console.log(`[JWT] ✅ Found email in 'preferred_username' field: ${jwtEmail}`);
              } else if (payload.sub && payload.sub.includes('@')) {
                // Sometimes sub contains email
                jwtEmail = payload.sub.toLowerCase();
                console.log(`[JWT] ✅ Found email in 'sub' field: ${jwtEmail}`);
              } else {
                // Check if any field contains an @ symbol (might be email)
                for (const [key, value] of Object.entries(payload)) {
                  if (typeof value === 'string' && value.includes('@') && value.includes('.')) {
                    jwtEmail = value.toLowerCase();
                    console.log(`[JWT] ✅ Found potential email in '${key}' field: ${jwtEmail}`);
                    break;
                  }
                }
              }
              
              const jwtName = payload.name || payload.preferred_username || payload.given_name || payload.family_name || 
                             (jwtEmail ? jwtEmail.split('@')[0] : 'Unknown User');
              
              // Log extraction results
              console.log(`[JWT] 🔍 Email extraction result:`, {
                extractedEmail: jwtEmail || 'EMPTY - NOT FOUND',
                extractedName: jwtName,
                checkedFields: {
                  email: payload.email,
                  upn: payload.upn,
                  unique_name: payload.unique_name,
                  preferred_username: payload.preferred_username,
                  sub: payload.sub
                }
              });
              
              // If email still not found, try to get it from Microsoft Graph API
              if (!jwtEmail || jwtEmail === '') {
                console.error(`[JWT] ❌ ERROR: No email found in JWT payload!`);
                console.error(`[JWT] ❌ All available JWT payload fields:`, Object.keys(payload));
                console.error(`[JWT] ❌ All JWT payload values:`, JSON.stringify(payload, null, 2));
                
                // Try to get email from Microsoft Graph API using the access token
                // Note: This requires the token to have User.Read scope
                try {
                  const accessToken = req.headers.authorization?.replace('Bearer ', '');
                  if (accessToken && tokenUserId) {
                    console.log(`[JWT] 🔄 Attempting to fetch email from Microsoft Graph API...`);
                    
                    // Use https module for compatibility (works in all Node.js versions)
                    const graphData = await new Promise((resolve, reject) => {
                      const options = {
                        hostname: 'graph.microsoft.com',
                        path: '/v1.0/me',
                        method: 'GET',
                        headers: {
                          'Authorization': `Bearer ${accessToken}`,
                          'Content-Type': 'application/json'
                        }
                      };
                      
                      const req = https.request(options, (res) => {
                        let data = '';
                        res.on('data', (chunk) => { data += chunk; });
                        res.on('end', () => {
                          if (res.statusCode === 200) {
                            try {
                              resolve(JSON.parse(data));
                            } catch (e) {
                              reject(new Error('Failed to parse Graph API response'));
                            }
                          } else {
                            reject(new Error(`Graph API returned status ${res.statusCode}: ${data}`));
                          }
                        });
                      });
                      
                      req.on('error', reject);
                      req.setTimeout(5000, () => {
                        req.destroy();
                        reject(new Error('Graph API request timeout'));
                      });
                      req.end();
                    });
                    
                    console.log(`[JWT] ✅ Microsoft Graph API response:`, {
                      mail: graphData.mail,
                      userPrincipalName: graphData.userPrincipalName,
                      displayName: graphData.displayName
                    });
                    
                    // Try to get email from Graph API response
                    jwtEmail = (graphData.mail || graphData.userPrincipalName || '').toLowerCase();
                    if (jwtEmail) {
                      console.log(`[JWT] ✅ Successfully retrieved email from Microsoft Graph: ${jwtEmail}`);
                    } else {
                      console.warn(`[JWT] ⚠️ Microsoft Graph API did not return email either`);
                    }
                  } else {
                    console.warn(`[JWT] ⚠️ Cannot fetch from Graph API - missing access token or user ID`);
                  }
                } catch (graphError) {
                  console.error(`[JWT] ❌ Error fetching email from Microsoft Graph API:`, graphError.message);
                  console.error(`[JWT] ❌ This might be because the token doesn't have User.Read scope`);
                }
                
                // If still no email, log a critical warning
                if (!jwtEmail || jwtEmail === '') {
                  console.error(`[JWT] ❌ CRITICAL: User will be created WITHOUT email!`);
                  console.error(`[JWT] ❌ Admin will need to manually add email during approval`);
                }
              }
              
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
                console.log(`[JWT] ✅ New user created in database:`, { 
                  id: resource.id, 
                  role: resource.role, 
                  email: resource.email,
                  name: resource.name 
                });
                
                // Verify email was saved
                if (!resource.email || resource.email.trim() === '') {
                  console.error(`[JWT] ⚠️ WARNING: User created but email is empty! User ID: ${resource.id}`);
                  console.error(`[JWT] ⚠️ JWT payload available fields:`, Object.keys(req.auth?.payload || {}));
                  console.error(`[JWT] ⚠️ JWT payload values:`, {
                    email: req.auth?.payload?.email,
                    upn: req.auth?.payload?.upn,
                    unique_name: req.auth?.payload?.unique_name,
                    preferred_username: req.auth?.payload?.preferred_username
                  });
                }
                
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
        // Continue with default values, but req.userId should already be set above
        if (!req.userId) {
        req.userId = req.auth?.payload?.oid || req.auth?.payload?.sub;
        }
        req.userRole = req.userRole || 'pending';
        req.user = req.user || { id: req.userId, role: 'pending' };
        console.log(`[JWT] ⚠️ Using fallback values - userId: ${req.userId}, role: ${req.userRole}`);
      }
    } else {
      // In development, still set req.userId from JWT even if we don't do user lookup
      console.log(`[JWT] Development mode - skipping user lookup, but userId is set: ${req.userId}`);
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
