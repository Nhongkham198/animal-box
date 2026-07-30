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
        const userEmail = firebaseUser.email?.toLowerCase() || '';
        const isAdminEmail = AUTHORIZED_EMAILS.includes(userEmail);
        
        console.log("Auth State Changed: User authenticated", {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          isAdminEmail
        });
        
        setUser(firebaseUser);
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          let userDoc = null;
          
          try {
            // Try cache first
            userDoc = await getDoc(userDocRef);
            if (!userDoc.exists()) {
              // Try server if not in cache
              try {
                userDoc = await getDocFromServer(userDocRef);
              } catch (serverErr) {
                console.warn("Server fetch failed, checking fallback role:", serverErr);
              }
            }
          } catch (err) {
            console.warn("User doc fetch failed:", err);
          }
          
          if (userDoc && userDoc.exists()) {
            const role = userDoc.data().role || 'staff';
            console.log("User role found in Firestore:", role);
            setUserRole(role);
          } else {
            // Default roles if document doesn't exist yet
            const role = isAdminEmail ? 'admin' : 'staff';
            console.log("Initial role determined:", role);
            
            try {
              await setDoc(userDocRef, {
                uid: firebaseUser.uid,
                name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Staff Member',
                email: firebaseUser.email,
                role: role,
                status: 'active'
              }, { merge: true });
            } catch (setErr) {
              console.warn("Could not sync user profile:", setErr);
            }
            setUserRole(role);
          }
        } catch (error) {
          console.warn("Non-fatal error in Auth initialization:", error);
          setUserRole(isAdminEmail ? 'admin' : 'staff');
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
