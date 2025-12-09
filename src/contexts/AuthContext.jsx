import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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

    // Use a ref to store the unsubscribe function so it persists across renders
    // and is always accessible in the callback closure
    const unsubscribeSnapshotRef = useRef(null);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            // Unsubscribe from previous user's listener if it exists
            if (unsubscribeSnapshotRef.current) {
                console.log("[AuthContext] Unsubscribing from previous listener");
                unsubscribeSnapshotRef.current();
                unsubscribeSnapshotRef.current = null;
            }

            setCurrentUser(user);

            if (user) {
                console.log(`[AuthContext] Setting up listener for user: ${user.uid}`);
                // Subscribe to user document changes
                unsubscribeSnapshotRef.current = onSnapshot(doc(db, "users", user.uid), (docSnapshot) => {
                    // Guard clause: Ensure this listener corresponds to the currently authenticated user
                    // This prevents stale listeners from updating state for the wrong user
                    if (auth.currentUser && auth.currentUser.uid !== user.uid) {
                        console.warn(`[AuthContext] Stale listener detected for ${user.uid}. Current auth: ${auth.currentUser.uid}. Ignoring.`);
                        return;
                    }

                    if (docSnapshot.exists()) {
                        const data = docSnapshot.data();
                        const role = data.role;
                        console.log(`[AuthContext] User ${user.uid} updated. Role: ${role}`);
                        // console.log("[AuthContext] Full user data:", data);
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
            } else {
                console.log("[AuthContext] No user logged in");
                setUserRole(null);
                setUserData(null);
                setLoading(false);
            }
        });

        return () => {
            if (unsubscribeSnapshotRef.current) unsubscribeSnapshotRef.current();
            unsubscribeAuth();
        };
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
