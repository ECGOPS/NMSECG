# Backend Service Troubleshooting Guide

## 🚨 **503 Service Unavailable Error - Quick Fix**

### **Immediate Actions:**

1. **Check Azure App Service Status:**
   ```bash
   az webapp show --name nmsbackend --resource-group YOUR_RESOURCE_GROUP
   ```

2. **Restart the App Service:**
   ```bash
   az webapp restart --name nmsbackend --resource-group YOUR_RESOURCE_GROUP
   ```

3. **View Real-time Logs:**
   ```bash
   az webapp log tail --name nmsbackend --resource-group YOUR_RESOURCE_GROUP
   ```

## 🔍 **Error Analysis**

### **What 503 Service Unavailable Means:**
- **Service temporarily unavailable** - Backend is down, restarting, or overloaded
- **Resource constraints** - CPU/Memory limits reached
- **Configuration issues** - Environment variables or app settings problems
- **Infrastructure problems** - Azure region issues or network problems

### **Common Root Causes:**

#### **1. Azure App Service Issues**
- **Service restarting** after deployment or configuration changes
- **Scaling operations** (up/down scaling)
- **Resource exhaustion** (CPU, Memory, Disk)
- **App Service Plan limits** reached

#### **2. Application Issues**
- **Application crashes** or unhandled exceptions
- **Database connection failures**
- **Environment variable misconfigurations**
- **Dependency service failures**

#### **3. Network/Infrastructure Issues**
- **Azure region outages**
- **Load balancer problems**
- **DNS resolution issues**
- **Firewall/security group restrictions**

## 🛠️ **Troubleshooting Steps**

### **Step 1: Check Azure Portal**
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your App Service
3. Check the **Overview** tab for status
4. Look at **Monitoring** → **Logs** for errors

### **Step 2: Check Application Logs**
```bash
# View application logs
az webapp log download --name nmsbackend --resource-group YOUR_RESOURCE_GROUP

# View real-time logs
az webapp log tail --name nmsbackend --resource-group YOUR_RESOURCE_GROUP

# Check specific log files
az webapp log show --name nmsbackend --resource-group YOUR_RESOURCE_GROUP
```

### **Step 3: Check Resource Usage**
```bash
# Check CPU and Memory usage
az monitor metrics list --resource /subscriptions/YOUR_SUBSCRIPTION/resourceGroups/YOUR_RESOURCE_GROUP/providers/Microsoft.Web/sites/nmsbackend --metric "CpuPercentage,MemoryPercentage" --interval PT1M
```

### **Step 4: Check Configuration**
```bash
# List app settings
az webapp config appsettings list --name nmsbackend --resource-group YOUR_RESOURCE_GROUP

# Check connection strings
az webapp config connection-string list --name nmsbackend --resource-group YOUR_RESOURCE_GROUP
```

## 🚀 **Quick Fixes**

### **Fix 1: Restart App Service**
```bash
az webapp restart --name nmsbackend --resource-group YOUR_RESOURCE_GROUP
```

### **Fix 2: Scale Up Resources**
```bash
# Scale up to higher tier
az appservice plan update --name YOUR_PLAN_NAME --resource-group YOUR_RESOURCE_GROUP --sku S1
```

### **Fix 3: Check and Fix Environment Variables**
```bash
# Set critical environment variables
az webapp config appsettings set --name nmsbackend --resource-group YOUR_RESOURCE_GROUP --settings \
  "NODE_ENV=production" \
  "PORT=8080" \
  "WEBSITE_NODE_DEFAULT_VERSION=18.x"
```

### **Fix 4: Enable Always On**
```bash
# Enable Always On to prevent idle shutdown
az webapp config set --name nmsbackend --resource-group YOUR_RESOURCE_GROUP --always-on true
```

## 🔧 **Frontend Error Handling Improvements**

### **Enhanced Error Messages:**
The frontend now provides better error feedback:

- **503**: "Service temporarily unavailable. Please try again in a few minutes."
- **502**: "Bad Gateway. The backend service is not responding properly."
- **504**: "Gateway Timeout. The backend service is taking too long to respond."
- **500**: "Server Error. The backend is experiencing technical difficulties."

### **Retry Logic:**
- **Automatic retry** for server errors (5xx)
- **No retry** for client errors (4xx)
- **Exponential backoff** between retry attempts

### **Fallback Mechanisms:**
- **Client-side data loading** when backend is unavailable
- **Offline mode support** for critical functions
- **Graceful degradation** of features

## 📊 **Monitoring and Prevention**

### **Set Up Alerts:**
```bash
# Create alert rule for 503 errors
az monitor metrics alert create \
  --name "Backend503Alert" \
  --resource-group YOUR_RESOURCE_GROUP \
  --scopes /subscriptions/YOUR_SUBSCRIPTION/resourceGroups/YOUR_RESOURCE_GROUP/providers/Microsoft.Web/sites/nmsbackend \
  --condition "avg Percentage of 5xx Errors > 0" \
  --window-size 5m \
  --evaluation-frequency 1m
```

### **Health Check Endpoint:**
The backend should implement a health check endpoint:
```javascript
// In your backend app.js or main server file
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || 'unknown'
  });
});
```

### **Service Status Component:**
Use the new `ServiceStatus` component to show users backend health:
```tsx
import { ServiceStatus } from '@/components/common/ServiceStatus';

function Dashboard() {
  return (
    <div>
      <ServiceStatus showDetails={true} />
      {/* Rest of dashboard */}
    </div>
  );
}
```

## 🚨 **Emergency Procedures**

### **When Backend is Completely Down:**

1. **Immediate Actions:**
   - Check Azure status page for region outages
   - Verify App Service is not deleted or moved
   - Check billing and subscription status

2. **Fallback Options:**
   - Enable offline mode in frontend
   - Use cached data when available
   - Redirect users to maintenance page

3. **Communication:**
   - Update status page
   - Notify stakeholders
   - Provide estimated recovery time

### **Recovery Steps:**
1. **Identify root cause** from logs
2. **Apply fixes** (restart, scale, configure)
3. **Verify recovery** with health checks
4. **Monitor stability** for 24-48 hours
5. **Document incident** and lessons learned

## 📋 **Prevention Checklist**

### **Before Deployment:**
- [ ] **Health check endpoint** implemented
- [ ] **Monitoring alerts** configured
- [ ] **Resource limits** reviewed
- [ ] **Environment variables** validated
- [ ] **Database connections** tested

### **Regular Maintenance:**
- [ ] **Log rotation** configured
- [ ] **Resource usage** monitored
- [ ] **Security updates** applied
- [ ] **Backup verification** completed
- [ ] **Performance testing** conducted

### **Monitoring Setup:**
- [ ] **Application Insights** enabled
- [ ] **Custom metrics** defined
- [ ] **Alert rules** configured
- [ ] **Dashboard** created
- [ ] **Escalation procedures** documented

## 🔍 **Debugging Tools**

### **Azure CLI Commands:**
```bash
# Check app service status
az webapp show --name nmsbackend --resource-group YOUR_RESOURCE_GROUP

# View recent deployments
az webapp deployment list --name nmsbackend --resource-group YOUR_RESOURCE_GROUP

# Check app service plan
az appservice plan show --name YOUR_PLAN_NAME --resource-group YOUR_RESOURCE_GROUP

# View metrics
az monitor metrics list --resource /subscriptions/YOUR_SUBSCRIPTION/resourceGroups/YOUR_RESOURCE_GROUP/providers/Microsoft.Web/sites/nmsbackend --metric "Requests,Http5xx" --interval PT1H
```

### **Frontend Debugging:**
```javascript
// Check backend health from browser console
import { checkBackendHealth } from '@/lib/api';
checkBackendHealth().then(console.log);

// Test specific endpoints
fetch('https://nmsbackend.azurewebsites.net/api/health')
  .then(res => console.log('Status:', res.status))
  .catch(err => console.error('Error:', err));
```

## 📞 **Support Resources**

### **Azure Support:**
- **Documentation**: [Azure App Service Troubleshooting](https://docs.microsoft.com/en-us/azure/app-service/troubleshoot-http-502-http-503)
- **Community**: [Azure Community Forums](https://social.msdn.microsoft.com/Forums/azure/en-US/home?forum=windowsazurewebsitespreview)
- **Support**: [Azure Support Plans](https://azure.microsoft.com/en-us/support/plans/)

### **Internal Resources:**
- **Team Chat**: #dev-ops or #backend-support
- **Documentation**: Internal wiki or knowledge base
- **Escalation**: Senior developers or DevOps team

## 🎯 **Quick Reference**

### **Common Commands:**
```bash
# Restart service
az webapp restart --name nmsbackend --resource-group YOUR_RESOURCE_GROUP

# View logs
az webapp log tail --name nmsbackend --resource-group YOUR_RESOURCE_GROUP

# Check status
az webapp show --name nmsbackend --resource-group YOUR_RESOURCE_GROUP

# Scale up
az appservice plan update --name YOUR_PLAN_NAME --resource-group YOUR_RESOURCE_GROUP --sku S1
```

### **Status Codes:**
- **503**: Service Unavailable - Restart needed
- **502**: Bad Gateway - Configuration issue
- **504**: Gateway Timeout - Performance issue
- **500**: Internal Server Error - Application bug

### **Recovery Time Estimates:**
- **Restart**: 2-5 minutes
- **Scale up**: 5-10 minutes
- **Configuration fix**: 10-30 minutes
- **Code deployment**: 15-45 minutes

---

**Remember**: Always check logs first, then apply the simplest fix (usually restart), and monitor the recovery process.
