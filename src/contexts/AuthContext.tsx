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
  authError: string | null;
}

const AUTHORIZED_EMAILS = [
  'zowamarketing@gmail.com',
  'animalboxclinic@gmail.com'
];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const throwError = useAsyncError();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsAuthReady(false);
      setAuthError(null);

      if (firebaseUser) {
        const userEmail = firebaseUser.email?.toLowerCase();
        
        // Strict Login Restriction
        if (!userEmail || !AUTHORIZED_EMAILS.includes(userEmail)) {
          console.warn("Unauthorized login attempt:", userEmail);
          setAuthError(`Access denied for ${userEmail || 'unknown user'}. Only authorized staff accounts can login.`);
          // Don't sign out immediately, let the UI show the error
          setUser(null);
          setUserRole(null);
          setLoading(false);
          setIsAuthReady(true);
          return;
        }

        console.log("Auth State Changed: Authorized user logged in", {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          isAdminEmail: AUTHORIZED_EMAILS.includes(firebaseUser.email?.toLowerCase() || '')
        });
        setUser(firebaseUser);
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          let userDoc = null;
          
          const isAdminEmail = AUTHORIZED_EMAILS.includes(userEmail);
          
          try {
            // Try cache first
            userDoc = await getDoc(userDocRef);
            if (!userDoc.exists()) {
              // Try server if not in cache
              try {
                userDoc = await getDocFromServer(userDocRef);
              } catch (serverErr) {
                console.warn("Server fetch failed, using hypothetical role for admin check:", serverErr);
              }
            }
          } catch (err) {
            console.warn("User doc fetch failed:", err);
          }
          
          if (userDoc && userDoc.exists()) {
            const role = userDoc.data().role;
            console.log("User role found in Firestore:", role);
            setUserRole(role);
          } else {
            // Default roles if document doesn't exist or isn't readable
            // DO NOT default to staff as it causes permission errors in UI
            const role = isAdminEmail ? 'admin' : null;
            console.log("Initial role determined:", role);
            
            // Attempt to sync with Firestore but don't crash if it fails
            if (isAdminEmail) {
              try {
                await setDoc(userDocRef, {
                  uid: firebaseUser.uid,
                  name: firebaseUser.displayName || 'Staff Member',
                  email: firebaseUser.email,
                  role: 'admin',
                  status: 'active'
                }, { merge: true });
              } catch (setErr) {
                console.warn("Could not sync admin profile:", setErr);
              }
            }
            setUserRole(role);
          }
        } catch (error) {
          console.warn("Non-fatal error in Auth initialization:", error);
          // If it's an admin, ensure they get the role even if everything else fails
          const isAdminEmail = userEmail && AUTHORIZED_EMAILS.includes(userEmail);
          if (isAdminEmail) {
            setUserRole('admin');
          } else {
            // Only throw for non-admin users where role is critical
            throwError(error);
          }
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
    authError,
    isAdmin: userRole === 'admin' || (user?.email && AUTHORIZED_EMAILS.includes(user.email.toLowerCase())),
    isStaff: ['admin', 'doctor', 'staff', 'vet'].includes(userRole || '') || (user?.email && AUTHORIZED_EMAILS.includes(user.email.toLowerCase())),
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
