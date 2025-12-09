import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            if (user) {
                // Subscribe to user document changes
                const unsubscribeSnapshot = onSnapshot(doc(db, "users", user.uid), (docSnapshot) => {
                    if (docSnapshot.exists()) {
                        const data = docSnapshot.data();
                        const role = data.role;
                        console.log(`[AuthContext] User ${user.uid} updated. Role: ${role}`);
                        setUserRole(role);
                        setUserData(data);
                    } else {
                        console.warn(`[AuthContext] No user document found for ${user.uid}. Defaulting to 'user'.`);
                        setUserRole('user');
                        setUserData(null);
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Error fetching user data:", error);
                    setUserRole(null);
                    setUserData(null);
                    setLoading(false);
                });

                return () => unsubscribeSnapshot();
            } else {
                setUserRole(null);
                setUserData(null);
                setLoading(false);
            }
        });

        return () => unsubscribeAuth();
    }, []);

    const value = {
        currentUser,
        userRole,
        userData,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
