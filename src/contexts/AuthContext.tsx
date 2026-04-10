import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  auth, 
  db, 
  onAuthStateChanged, 
  doc, 
  getDoc, 
  getDocFromServer,
  setDoc,
  FirebaseUser,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection
} from '../firebase';
import { useAsyncError } from '../hooks/useAsyncError';

interface AuthContextType {
  user: FirebaseUser | null;
  userRole: string | null;
  loading: boolean;
  isAuthReady: boolean;
  isAdmin: boolean;
  isStaff: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const throwError = useAsyncError();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsAuthReady(false);
      if (firebaseUser) {
        console.log("Auth State Changed: User logged in", {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          emailVerified: firebaseUser.emailVerified,
          displayName: firebaseUser.displayName
        });
        setUser(firebaseUser);
        testFirestoreConnection();
        try {
          console.log("Fetching user role for:", firebaseUser.uid, firebaseUser.email);
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          let userDoc;
          
          try {
            // Use getDocFromServer to bypass cache and ensure we have latest permissions
            userDoc = await getDocFromServer(userDocRef);
          } catch (err) {
            console.warn("Error getting user doc from server:", err);
            // Fallback to local cache if server fails
            try {
              userDoc = await getDoc(userDocRef);
            } catch (cacheErr) {
              console.warn("Error getting user doc from cache:", cacheErr);
              if (firebaseUser.email === 'zowamarketing@gmail.com') {
                console.log("Admin user detected, proceeding with local role due to permission error.");
                // We'll set userRole to 'admin' below if userDoc is null
              } else {
                // For non-admins, this is a real error
                throw cacheErr;
              }
            }
          }
          
          if (userDoc && userDoc.exists()) {
            const role = userDoc.data().role;
            console.log("User role found in Firestore:", role);
            setUserRole(role);
          } else {
            const role = firebaseUser.email === 'zowamarketing@gmail.com' ? 'admin' : 'staff';
            console.log("Creating/Updating user doc with role:", role);
            try {
              await setDoc(userDocRef, {
                uid: firebaseUser.uid,
                name: firebaseUser.displayName || 'Staff Member',
                email: firebaseUser.email,
                role: role
              });
            } catch (err) {
              console.warn("setDoc failed (likely permissions):", err);
              // If it's the admin, we still set the role locally
              if (firebaseUser.email === 'zowamarketing@gmail.com') {
                console.log("Admin user detected, proceeding with local role even if setDoc failed.");
              } else {
                // For non-admins, this is a real error
                handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}`);
              }
            }
            setUserRole(role);
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          throwError(error);
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
      // Small delay to ensure Firestore SDK and Rules are in sync
      setTimeout(() => {
        setIsAuthReady(true);
      }, 1000);
    });

    return () => unsubscribe();
  }, [throwError]);

  const value = {
    user,
    userRole,
    loading,
    isAuthReady,
    isAdmin: userRole === 'admin' || user?.email === 'zowamarketing@gmail.com',
    isStaff: ['admin', 'doctor', 'staff', 'vet'].includes(userRole || '') || user?.email === 'zowamarketing@gmail.com',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
