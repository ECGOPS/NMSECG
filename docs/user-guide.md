# ECG NMS User Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [User Roles and Permissions](#user-roles-and-permissions)
4. [Fault Management](#fault-management)
5. [Analytics & Reporting](#analytics--reporting)
6. [System Configuration](#system-configuration)
7. [Troubleshooting](#troubleshooting)
8. [Security Guidelines](#security-guidelines)
9. [Best Practices](#best-practices)
10. [Advanced Features](#advanced-features)

## Introduction
ECG NMS (Network Management System) is a comprehensive fault management system designed for power distribution networks. This guide will help you understand and effectively use the system's features to manage power outages, track fault resolution, and maintain system reliability.

### Key Features
- Real-time fault monitoring
- Automated outage tracking
- Performance analytics
- User role management
- Security controls
- Reporting tools

## Getting Started

### System Requirements
- Modern web browser (Chrome, Firefox, Edge)
- Internet connection
- Valid user credentials
- Required permissions

### Account Creation (Sign Up)
1. Navigate to the signup page
2. Fill in the required information:
   - Full Name
   - Email Address
   - Phone Number
   - Region
   - District
   - Role (if applicable)
3. Create a strong password that meets the following criteria:
   - Minimum 8 characters
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one number
   - At least one special character
4. Review and accept the terms of service
5. Click "Create Account"
6. Verify your email address by clicking the link sent to your email
7. Complete your profile setup if required

### Login Process
1. Navigate to the login page
2. Enter your credentials:
   - Username (email address)
   - Password
3. Click "Login"
4. If 2FA is enabled:
   - Enter the verification code sent to your registered phone/email
   - Click "Verify"

### Password Management
1. To change your password:
   - Click on your profile icon
   - Select "Change Password"
   - Enter current password
   - Enter new password
   - Confirm new password
   - Click "Update Password"

2. To reset a forgotten password:
   - Click "Forgot Password" on the login page
   - Enter your registered email address
   - Click "Send Reset Link"
   - Check your email for the reset link
   - Click the link and follow the instructions
   - Create a new password

### Troubleshooting Login Issues

#### Common Login Problems and Solutions

1. **Cannot Access Login Page**
   - Check your internet connection
   - Clear browser cache and cookies
   - Try using a different browser
   - Ensure you're using the correct URL

2. **Invalid Credentials**
   - Verify your email address is correct
   - Check for caps lock
   - Ensure no extra spaces in username/password
   - Try resetting your password if forgotten

3. **Account Locked**
   - Wait for the lockout period to expire (usually 30 minutes)
   - Contact your system administrator
   - Use the "Forgot Password" feature

4. **2FA Issues**
   - Ensure your phone/email is accessible
   - Request a new verification code
   - Contact support if codes aren't being received

5. **Browser Compatibility**
   - Update your browser to the latest version
   - Enable JavaScript and cookies
   - Try using a different browser

#### Getting Help
If you continue to experience issues:
1. Contact your system administrator
2. Submit a support ticket through the help desk
3. Call the support hotline: [Support Phone Number]
4. Email support: [Support Email]

### Dashboard Overview
The dashboard provides a comprehensive view of system status:

#### Active Faults Panel
- Current active faults
- Fault severity levels
- Affected areas
- Time since occurrence

#### Recent Outages Panel
- Latest system outages
- Restoration status
- Affected customers
- Duration of outage

#### Key Performance Indicators
- System reliability metrics
- Response time statistics
- Customer impact analysis
- Regional performance

#### System Alerts
- Critical notifications
- Maintenance reminders
- Security alerts
- System updates

## User Roles and Permissions

### Available Roles

#### 1. System Administrator
**Responsibilities:**
- Full system access and control
- User account management
- System configuration
- Security settings
- Backup management

**Permissions:**
- Create/Edit/Delete users
- Configure system settings
- Manage security policies
- Access all features
- Generate system reports

**Daily Functions:**
- Monitor system health and performance
- Manage user access and permissions
- Configure system parameters
- Implement security updates
- Handle system backups
- Resolve technical issues
- Manage system integrations
- Review system logs
- Update system documentation
- Train new administrators

#### 2. Regional Manager
**Responsibilities:**
- Regional oversight
- Team management
- Performance monitoring
- Resource allocation

**Permissions:**
- View regional data
- Manage regional users
- Generate regional reports
- Update fault status
- Access regional analytics

**Daily Functions:**
- Monitor regional performance metrics
- Coordinate with district managers
- Review and approve fault reports
- Allocate resources for fault resolution
- Conduct regional team meetings
- Generate performance reports
- Implement regional strategies
- Handle escalated issues
- Monitor resource utilization
- Ensure compliance with standards

#### 3. Regional General Manager
**Responsibilities:**
- Regional oversight
- Team management
- Performance monitoring
- Resource allocation
- Strategic planning

**Permissions:**
- View regional data
- Manage regional users
- Generate regional reports
- Update fault status
- Access regional analytics
- Manage regional resources

**Daily Functions:**
- Develop regional strategies
- Oversee multiple districts
- Set performance targets
- Manage regional budget
- Coordinate with other regions
- Handle major incidents
- Review regional KPIs
- Implement improvement plans
- Manage stakeholder relationships
- Lead regional initiatives

#### 4. District Engineer
**Responsibilities:**
- District-level operations
- Fault response
- Field operations
- Customer communication

**Permissions:**
- Report faults
- Update fault status
- View district data
- Generate basic reports
- Access district analytics

**Daily Functions:**
- Respond to fault reports
- Conduct field inspections
- Perform technical assessments
- Update fault status
- Coordinate repair teams
- Document technical issues
- Monitor equipment status
- Provide technical support
- Maintain equipment records
- Implement safety protocols

#### 5. District Manager
**Responsibilities:**
- District-level operations
- Team leadership
- Resource management
- Performance monitoring
- Customer service oversight

**Permissions:**
- Report faults
- Update fault status
- View district data
- Generate basic reports
- Access district analytics
- Manage district resources

**Daily Functions:**
- Oversee daily operations
- Manage district team
- Coordinate emergency responses
- Monitor service quality
- Handle customer complaints
- Manage district budget
- Implement district policies
- Conduct team training
- Review performance metrics
- Maintain stakeholder relations

#### 6. Viewer
**Responsibilities:**
- Monitor system status
- View reports
- Track performance

**Permissions:**
- Read-only access
- View basic reports
- Access public data
- Monitor system status

**Daily Functions:**
- Monitor system dashboards
- View performance reports
- Track fault status
- Access public information
- Generate basic reports
- Monitor system alerts
- View historical data
- Access documentation
- Track maintenance schedules
- Monitor service status

### Role Hierarchy and Reporting Structure
```
System Administrator
    │
    ├── Regional General Manager
    │       │
    │       ├── Regional Manager
    │       │       │
    │       │       ├── District Manager
    │       │       │       │
    │       │       │       ├── District Engineer
    │       │       │       └── Viewer
    │       │       │
    │       │       │
    │       │       └── Viewer
    │       │
    │       └── Viewer
    │
    └── Viewer
```

### Role Assignment Process
1. New user registration
2. Role assessment by System Administrator
3. Permission configuration
4. Access level assignment
5. Training provision
6. Access verification
7. Regular role review

### Role-Specific Training Requirements
1. **System Administrator**
   - Advanced system management
   - Security protocols
   - Backup procedures
   - User management
   - System configuration

2. **Regional General Manager**
   - Strategic planning
   - Resource management
   - Performance monitoring
   - Team leadership
   - Budget management

3. **Regional Manager**
   - Regional operations
   - Team management
   - Performance analysis
   - Resource allocation
   - Report generation

4. **District Manager**
   - District operations
   - Team supervision
   - Customer service
   - Resource coordination
   - Performance tracking

5. **District Engineer**
   - Technical operations
   - Fault assessment
   - Field operations
   - Safety protocols
   - Equipment maintenance

6. **Viewer**
   - Basic system navigation
   - Report viewing
   - Dashboard monitoring
   - Data interpretation
   - Basic troubleshooting

## Fault Management

### Reporting a Fault

#### OP5 Fault Report
1. Navigate to "Faults" > "Report New Fault"
2. Select "OP5 Fault"
3. Fill in required information:
   - Region and District
   - Fault Location
   - Fault Type
   - Specific Fault Type
   - Occurrence Date/Time
   - Affected Population:
     * Rural
     * Urban
     * Metro
4. Add additional details:
   - Description
   - Priority Level
   - Initial Assessment
5. Submit the fault report

#### Control Outage Report
1. Navigate to "Faults" > "Report New Fault"
2. Select "Control Outage"
3. Fill in required information:
   - Region and District
   - Outage Type
   - Specific Outage Type
   - Occurrence Date/Time
   - Number of Customers Affected
4. Add additional details:
   - System Impact
   - Priority Level
   - Initial Assessment
5. Submit the outage report

### Updating Fault Status

#### Status Update Process
1. Navigate to "Faults" > "Active Faults"
2. Select the fault to update
3. Click "Update Status"
4. Enter update information:
   - Current Status
   - Restoration Date/Time
   - Repair Date/Time
   - Resolution Details
5. Save the update

#### Status Categories
- Active
- Under Investigation
- Being Repaired
- Resolved
- Closed

### Fault Categories

#### OP5 Faults
- Location-based faults
- Equipment failures
- Line issues
- Transformer problems
- Distribution issues

#### Control Outages
- System-wide issues
- Control failures
- Network problems
- Communication issues
- SCADA system faults

### Customer Population Management

#### Updating Customer Population
1. Navigate to "Settings" > "Customer Population"
2. Select the region and district
3. Choose update method:
   - Manual Update
   - Bulk Import
   - API Integration

#### Manual Update Process
1. Click "Update Population"
2. Enter the following information:
   - Total Customer Count
   - Population Breakdown:
     * Rural Customers
     * Urban Customers
     * Metro Customers
   - Commercial Customers
   - Industrial Customers
   - Residential Customers
3. Add supporting documentation
4. Enter update reason
5. Click "Save Update"

#### Bulk Import Process
1. Click "Bulk Import"
2. Download the template file
3. Fill in the required fields:
   - Region Code
   - District Code
   - Customer Categories
   - Population Numbers
   - Update Date
4. Upload the completed file
5. Verify the data
6. Confirm import

#### Population Update Guidelines
1. **Update Frequency**
   - Monthly updates for urban areas
   - Quarterly updates for rural areas
   - Annual comprehensive review
   - Emergency updates as needed

2. **Data Requirements**
   - Valid customer counts
   - Category breakdown
   - Geographic distribution
   - Historical data
   - Supporting documentation

3. **Verification Process**
   - Data validation
   - Cross-reference checks
   - Historical comparison
   - Approval workflow
   - Audit trail

4. **Access Levels**
   - District Manager: Can update district data
   - Regional Manager: Can review and approve updates
   - System Administrator: Full access to all data

#### Population Update Workflow
1. **Initiation**
   - Identify need for update
   - Gather required data
   - Prepare documentation

2. **Review**
   - Data validation
   - Historical comparison
   - Impact assessment
   - Approval process

3. **Implementation**
   - System update
   - Data verification
   - Documentation update
   - Notification to stakeholders

4. **Monitoring**
   - Track changes
   - Verify accuracy
   - Monitor impact
   - Address issues

#### Troubleshooting Population Updates
1. **Common Issues**
   - Data validation errors
   - Import failures
   - Access permission issues
   - Historical data conflicts

2. **Solutions**
   - Verify data format
   - Check file integrity
   - Confirm permissions
   - Review historical records
   - Contact system administrator

3. **Support**
   - Technical assistance
   - Data verification
   - Process guidance
   - Emergency updates

## Analytics & Reporting

### Viewing Analytics

#### Dashboard Analytics
1. Navigate to "Analytics"
2. Select date range
3. Choose region/district
4. View analytics dashboard:
   - Performance metrics
   - Trend analysis
   - Comparative data
   - Historical patterns

#### Custom Analytics
1. Click "Custom Analytics"
2. Select metrics
3. Choose time period
4. Apply filters
5. Generate report

### Key Metrics

#### MTTR (Mean Time To Repair)
- Average repair time
- Regional comparison
- Trend analysis
- Performance tracking
- Improvement areas

#### Reliability Indices
- SAIDI (System Average Interruption Duration Index)
- SAIFI (System Average Interruption Frequency Index)
- CAIDI (Customer Average Interruption Duration Index)
- Regional benchmarks
- Historical trends

### Generating Reports

#### Standard Reports
1. Navigate to "Reports"
2. Select report type:
   - Daily Summary
   - Weekly Analysis
   - Monthly Review
   - Quarterly Assessment
3. Choose parameters
4. Generate report

#### Custom Reports
1. Click "Create Custom Report"
2. Select metrics
3. Choose format
4. Set parameters
5. Generate report

## System Configuration

### User Management

#### Adding Users
1. Navigate to "Settings" > "Users"
2. Click "Add User"
3. Enter user details:
   - Username
   - Email
   - Role
   - Region/District
4. Set permissions
5. Save user

#### Managing Users
1. Select user
2. Choose action:
   - Edit details
   - Reset password
   - Change role
   - Deactivate account
3. Save changes

### Region/District Setup

#### Adding Regions
1. Navigate to "Settings" > "Locations"
2. Click "Add Region"
3. Enter region details
4. Save region

#### Adding Districts
1. Select region
2. Click "Add District"
3. Enter district details
4. Save district

## Troubleshooting

### Common Issues

#### Login Problems
1. Check credentials
2. Verify network connection
3. Clear browser cache
4. Reset password
5. Contact administrator

#### Report Generation
1. Check date range
2. Verify permissions
3. Clear browser cache
4. Check data availability
5. Contact support

#### Data Display
1. Refresh page
2. Check filters
3. Verify internet connection
4. Clear cache
5. Update browser

### Support
For additional support:
- Email: support@ecg-oms.com
- Phone: +1 (555) 123-4567
- Online Help Center: help.ecg-oms.com
- Emergency Support: 24/7 hotline

## Security Guidelines

### Password Management
1. **Password Requirements**
   - Minimum 12 characters
   - Must include uppercase and lowercase letters
   - Must include numbers
   - Must include special characters
   - Cannot reuse last 5 passwords
   - Must be changed every 90 days

2. **Password Best Practices**
   - Use unique passwords for each account
   - Never share passwords
   - Use a password manager
   - Enable two-factor authentication
   - Report suspicious activity

### Account Security
1. **Login Security**
   - Use secure networks
   - Log out after each session
   - Clear browser cache regularly
   - Enable session timeout
   - Monitor login activity

2. **Access Control**
   - Request minimum required access
   - Report unauthorized access
   - Review access permissions regularly
   - Follow principle of least privilege
   - Document access changes

### Data Protection
1. **Sensitive Data Handling**
   - Encrypt sensitive information
   - Use secure file transfer
   - Follow data classification guidelines
   - Report data breaches
   - Maintain data privacy

2. **System Usage**
   - Lock screen when away
   - Use approved software only
   - Regular system updates
   - Backup important data
   - Follow security policies

## Best Practices

### Daily Operations
1. Regular system checks
2. Data verification
3. Report generation
4. Status updates
5. Communication with team

### Data Management
1. Regular backups
2. Data validation
3. Clean data entry
4. Proper documentation
5. Regular audits

### Communication
1. Clear reporting
2. Team coordination
3. Customer updates
4. Stakeholder communication
5. Emergency protocols

## Advanced Features

### Automated Reporting
- Scheduled reports
- Custom templates
- Data export
- Integration options
- Automated distribution

### System Integration
- API access
- Data import/export
- Third-party tools
- Custom workflows
- Automated processes

### Mobile Access
- Mobile dashboard
- Field reporting
- Real-time updates
- Offline capabilities
- Location services 