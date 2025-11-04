# ECG NMS API Documentation

## Table of Contents
1. [Authentication](#authentication)
2. [Fault Management](#fault-management)
3. [Analytics](#analytics)
4. [User Management](#user-management)
5. [System Configuration](#system-configuration)
6. [Security API Endpoints](#security-api-endpoints)
7. [Firebase Integration](#firebase-integration)

## Firebase Configuration

### Setup
```typescript
// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};
```

### Firebase Services
```typescript
// Initialize Firebase services
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const analytics = getAnalytics(app);
```

## Authentication

### Firebase Authentication

#### Sign In
```typescript
// Email/Password Sign In
const signInWithEmail = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return {
      user: userCredential.user,
      token: await userCredential.user.getIdToken()
    };
  } catch (error) {
    throw new Error('Authentication failed');
  }
};

// Google Sign In
const signInWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    return {
      user: userCredential.user,
      token: await userCredential.user.getIdToken()
    };
  } catch (error) {
    throw new Error('Google authentication failed');
  }
};
```

#### Sign Out
```typescript
const signOut = async () => {
  try {
    await auth.signOut();
    return { success: true };
  } catch (error) {
    throw new Error('Sign out failed');
  }
};
```

#### Password Reset
```typescript
const resetPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    throw new Error('Password reset failed');
  }
};
```

## Fault Management

### Firestore Collections

#### Faults Collection
```typescript
interface FaultDocument {
  id: string;
  type: 'op5' | 'control';
  status: 'active' | 'resolved';
  regionId: string;
  districtId: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  details: {
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    severity: 'minor' | 'moderate' | 'major' | 'severe';
    affectedPopulation: {
      rural: number;
      urban: number;
      metro: number;
    };
  };
  timestamps: {
    createdAt: Timestamp;
    updatedAt: Timestamp;
    resolvedAt?: Timestamp;
  };
  metadata: {
    reportedBy: string;
    assignedTo?: string;
    lastUpdatedBy: string;
  };
}
```

### Fault Operations

#### Create Fault
```typescript
const createFault = async (faultData: Omit<FaultDocument, 'id' | 'timestamps'>) => {
  try {
    const docRef = await addDoc(collection(db, 'faults'), {
      ...faultData,
      timestamps: {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    });
    return { id: docRef.id, ...faultData };
  } catch (error) {
    throw new Error('Failed to create fault');
  }
};
```

#### Update Fault
```typescript
const updateFault = async (faultId: string, updates: Partial<FaultDocument>) => {
  try {
    const docRef = doc(db, 'faults', faultId);
    await updateDoc(docRef, {
      ...updates,
      'timestamps.updatedAt': serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    throw new Error('Failed to update fault');
  }
};
```

#### Get Faults
```typescript
const getFaults = async (queryParams: {
  regionId?: string;
  districtId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  type?: 'op5' | 'control';
  limit?: number;
  lastDoc?: DocumentSnapshot;
}) => {
  try {
    let query = collection(db, 'faults');
    
    // Apply filters
    if (queryParams.regionId) {
      query = query.where('regionId', '==', queryParams.regionId);
    }
    if (queryParams.districtId) {
      query = query.where('districtId', '==', queryParams.districtId);
    }
    if (queryParams.status) {
      query = query.where('status', '==', queryParams.status);
    }
    if (queryParams.type) {
      query = query.where('type', '==', queryParams.type);
    }
    
    // Apply date range
    if (queryParams.startDate) {
      query = query.where('timestamps.createdAt', '>=', queryParams.startDate);
    }
    if (queryParams.endDate) {
      query = query.where('timestamps.createdAt', '<=', queryParams.endDate);
    }
    
    // Apply pagination
    if (queryParams.lastDoc) {
      query = query.startAfter(queryParams.lastDoc);
    }
    query = query.limit(queryParams.limit || 20);
    
    const snapshot = await getDocs(query);
    return {
      faults: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      lastDoc: snapshot.docs[snapshot.docs.length - 1]
    };
  } catch (error) {
    throw new Error('Failed to fetch faults');
  }
};
```

## Analytics

### Firebase Analytics Integration

#### Track Fault Events
```typescript
const trackFaultEvent = async (eventName: string, eventData: any) => {
  try {
    await logEvent(analytics, eventName, eventData);
    return { success: true };
  } catch (error) {
    throw new Error('Failed to track event');
  }
};

// Example events
const faultEvents = {
  FAULT_CREATED: 'fault_created',
  FAULT_UPDATED: 'fault_updated',
  FAULT_RESOLVED: 'fault_resolved',
  FAULT_ASSIGNED: 'fault_assigned'
};
```

#### Custom Analytics
```typescript
const trackCustomAnalytics = async (metric: string, value: number) => {
  try {
    await logEvent(analytics, 'custom_metric', {
      metric_name: metric,
      metric_value: value,
      timestamp: new Date().toISOString()
    });
    return { success: true };
  } catch (error) {
    throw new Error('Failed to track custom analytics');
  }
};
```

## User Management

### Firestore User Collection
```typescript
interface UserDocument {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'regional_manager' | 'district_engineer' | 'viewer';
  regionId?: string;
  districtId?: string;
  preferences: {
    theme: 'light' | 'dark' | 'system';
    notifications: boolean;
    language: string;
  };
  metadata: {
    createdAt: Timestamp;
    lastLogin: Timestamp;
    status: 'active' | 'inactive' | 'suspended';
  };
}
```

### User Operations

#### Create User
```typescript
const createUser = async (userData: Omit<UserDocument, 'id' | 'metadata'>) => {
  try {
    const docRef = await addDoc(collection(db, 'users'), {
      ...userData,
      metadata: {
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        status: 'active'
      }
    });
    return { id: docRef.id, ...userData };
  } catch (error) {
    throw new Error('Failed to create user');
  }
};
```

#### Update User
```typescript
const updateUser = async (userId: string, updates: Partial<UserDocument>) => {
  try {
    const docRef = doc(db, 'users', userId);
    await updateDoc(docRef, updates);
    return { success: true };
  } catch (error) {
    throw new Error('Failed to update user');
  }
};
```

## Storage

### Firebase Storage Integration

#### Upload File
```typescript
const uploadFile = async (file: File, path: string) => {
  try {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snapshot.ref);
    return { url, path: snapshot.ref.fullPath };
  } catch (error) {
    throw new Error('Failed to upload file');
  }
};
```

#### Delete File
```typescript
const deleteFile = async (path: string) => {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
    return { success: true };
  } catch (error) {
    throw new Error('Failed to delete file');
  }
};
```

## Security Rules

### Firestore Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User authentication check
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Role-based access
    function hasRole(role) {
      return isAuthenticated() && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == role;
    }
    
    // Region access check
    function hasRegionAccess(regionId) {
      return isAuthenticated() && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.regionId == regionId;
    }
    
    // Faults collection rules
    match /faults/{faultId} {
      allow read: if isAuthenticated();
      allow create: if hasRole('admin') || hasRole('regional_manager') || hasRole('district_engineer');
      allow update: if hasRole('admin') || hasRole('regional_manager');
      allow delete: if hasRole('admin');
    }
    
    // Users collection rules
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if hasRole('admin');
      allow update: if hasRole('admin') || request.auth.uid == userId;
      allow delete: if hasRole('admin');
    }
  }
}
```

### Storage Rules
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Authentication check
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // File type validation
    function isValidFileType() {
      return request.resource.contentType.matches('image/.*') ||
             request.resource.contentType.matches('application/pdf');
    }
    
    // File size validation
    function isValidFileSize() {
      return request.resource.size < 5 * 1024 * 1024; // 5MB
    }
    
    // Fault attachments
    match /faults/{faultId}/{fileName} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && 
                   isValidFileType() && 
                   isValidFileSize();
    }
    
    // User avatars
    match /avatars/{userId} {
      allow read: if isAuthenticated();
      allow write: if request.auth.uid == userId && 
                   isValidFileType() && 
                   isValidFileSize();
    }
  }
}
```

## Error Handling

### Firebase Error Types
```typescript
interface FirebaseError {
  code: string;
  message: string;
  details?: any;
}

const handleFirebaseError = (error: FirebaseError) => {
  switch (error.code) {
    case 'auth/user-not-found':
      return 'User not found';
    case 'auth/wrong-password':
      return 'Invalid password';
    case 'auth/email-already-in-use':
      return 'Email already in use';
    case 'permission-denied':
      return 'Permission denied';
    case 'not-found':
      return 'Resource not found';
    default:
      return 'An unexpected error occurred';
  }
};
```

## Best Practices

### Firebase Usage
1. Use batch operations for multiple writes
2. Implement proper indexing
3. Use security rules effectively
4. Implement proper error handling
5. Use offline persistence
6. Implement proper caching
7. Use proper data modeling
8. Implement proper validation
9. Use proper authentication
10. Implement proper monitoring

### Performance Optimization
1. Use proper queries
2. Implement pagination
3. Use proper indexing
4. Implement proper caching
5. Use proper data modeling
6. Implement proper validation
7. Use proper authentication
8. Implement proper monitoring
9. Use proper error handling
10. Implement proper logging

## Error Responses

All API endpoints may return the following error responses:

```http
400 Bad Request
{
  "error": "string",
  "message": "string"
}

401 Unauthorized
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}

403 Forbidden
{
  "error": "Forbidden",
  "message": "Insufficient permissions"
}

404 Not Found
{
  "error": "Not Found",
  "message": "Resource not found"
}

500 Internal Server Error
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
``` 