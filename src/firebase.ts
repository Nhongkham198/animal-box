import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  initializeFirestore,
  memoryLocalCache,
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocFromServer,
  getDocsFromServer,
  orderBy,
  limit,
  Timestamp,
  increment,
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
// Use initializeFirestore instead of getFirestore for more control over settings
// experimentalForceLongPolling: true helps prevent "INTERNAL ASSERTION FAILED" errors
// that can occur behind proxies or in environments with unstable WebSocket connections.
// localCache: memoryLocalCache() prevents corrupted IndexedDB states that cause 
// "Unexpected state (ID: ca9/b815)" crashes in iframe environments.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  experimentalAutoDetectLongPolling: false,
  localCache: memoryLocalCache()
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Test connection to Firestore
export async function testFirestoreConnection() {
  try {
    const testDoc = doc(db, 'test', 'connection');
    await setDoc(testDoc, { timestamp: serverTimestamp(), user: auth.currentUser?.email }, { merge: true });
    console.log("Firestore connection write test successful");
    
    const snap = await getDoc(testDoc);
    console.log("Firestore connection read test successful:", snap.data());
  } catch (err) {
    console.warn("Firestore connection test failed (likely permissions):", err);
  }
}
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const isPermissionError = errMessage.toLowerCase().includes('permission') || errMessage.toLowerCase().includes('insufficient');
  const isQuotaError = errMessage.toLowerCase().includes('quota') || errMessage.toLowerCase().includes('resource-exhausted');

  // Explicitly extract primitives to avoid circular structures
  const errInfo = {
    error: isQuotaError ? 'QUOTA_EXCEEDED' : String(errMessage),
    operationType: String(operationType),
    path: path ? String(path) : null,
    authInfo: {
      userId: auth.currentUser?.uid ? String(auth.currentUser.uid) : undefined,
      email: auth.currentUser?.email ? String(auth.currentUser.email) : undefined,
      emailVerified: Boolean(auth.currentUser?.emailVerified),
      isAnonymous: Boolean(auth.currentUser?.isAnonymous),
      tenantId: auth.currentUser?.tenantId ? String(auth.currentUser.tenantId) : undefined,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: String(provider.providerId),
        displayName: provider.displayName ? String(provider.displayName) : null,
        email: provider.email ? String(provider.email) : null,
        photoUrl: provider.photoURL ? String(provider.photoURL) : null
      })) || []
    }
  };
  
  const errString = JSON.stringify(errInfo);
  
  if (isPermissionError) {
    console.warn('Firestore Permission Warning: ', errString);
    if (operationType === OperationType.CREATE || operationType === OperationType.UPDATE || operationType === OperationType.DELETE || operationType === OperationType.WRITE) {
      throw new Error(errString);
    }
    return;
  }
  
  console.error('Firestore Error: ', errString);
  throw new Error(errString);
}

export { 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut, 
  onAuthStateChanged, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  orderBy,
  limit,
  Timestamp,
  increment,
  getDocFromServer,
  getDocsFromServer,
  serverTimestamp,
  getDocs
};
export type { FirebaseUser };
