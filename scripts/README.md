# Admin Setup Scripts

This directory contains scripts for setting up the initial system administrator in Firebase.

## Prerequisites

1. Firebase Admin SDK service account key (`serviceAccountKey.json`) in the root directory
2. Node.js installed
3. Required dependencies:
   ```bash
   npm install firebase-admin
   ```

## Scripts

### 1. createAdmin.js
Creates a staff ID for the system administrator in Firestore.

```bash
node scripts/createAdmin.js
```

### 2. createAdminUser.js
Creates the admin user in Firebase Authentication and Firestore.

```bash
node scripts/createAdminUser.js
```

## Default Admin Credentials
- Email: admin@faultmaster.com
- Password: Admin@123
- Staff ID: ADMIN001
- Role: system_admin

**Important**: Change these credentials after first login for security purposes.

## Order of Execution
1. Run `createAdmin.js` first to create the staff ID
2. Then run `createAdminUser.js` to create the authentication user

## Troubleshooting
If you encounter any errors:
1. Ensure your `serviceAccountKey.json` is properly configured
2. Check that Firebase Admin SDK is properly initialized
3. Verify that you have the necessary permissions in Firebase Console 