import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import Card from '../ui/Card';

const STATUS_COLORS = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
};

export default function LeaveList({ mode = 'my-leaves' }) {
    const { currentUser } = useAuth();
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let q;
        const leavesRef = collection(db, 'leaves');

        if (mode === 'my-leaves') {
            // Removed orderBy to avoid needing a composite index
            q = query(
                leavesRef,
                where('userId', '==', currentUser.uid)
            );
        } else {
            // Admin view - all leaves
            q = query(leavesRef, orderBy('createdAt', 'desc'));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const leavesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Client-side sorting
            leavesData.sort((a, b) => {
                const dateA = a.createdAt?.toDate() || new Date(0);
                const dateB = b.createdAt?.toDate() || new Date(0);
                return dateB - dateA;
            });

            setLeaves(leavesData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching leaves:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [mode, currentUser.uid]);

    const handleStatusUpdate = async (leaveId, newStatus, leaveData) => {
        if (!window.confirm(`Are you sure you want to ${newStatus} this leave request?`)) return;

        try {
            await runTransaction(db, async (transaction) => {
                const leaveRef = doc(db, 'leaves', leaveId);
                const userRef = doc(db, 'users', leaveData.userId);

                // If approving, deduct from quota
                if (newStatus === 'approved' && leaveData.status !== 'approved' && leaveData.type !== 'unpaid') {
                    const userDoc = await transaction.get(userRef);
                    if (!userDoc.exists()) throw new Error("User not found");

                    const userData = userDoc.data();
                    const currentQuotas = userData.leaveQuota || {};
                    const currentTypeQuota = currentQuotas[leaveData.type] || 0;

                    if (currentTypeQuota < leaveData.days) {
                        throw new Error("User does not have enough quota remaining.");
                    }

                    // Update the specific quota type
                    const newQuotas = {
                        ...currentQuotas,
                        [leaveData.type]: currentTypeQuota - leaveData.days
                    };

                    console.log("Updating user quota:", { userId: leaveData.userId, oldRole: userData.role, newQuotas });

                    // Use set with merge and EXPLICITLY preserve the role to prevent any accidental overwrites
                    transaction.set(userRef, {
                        leaveQuota: newQuotas,
                        role: userData.role // Paranoid check: ensure role is preserved
                    }, { merge: true });
                }

                transaction.update(leaveRef, { status: newStatus });
            });

            alert(`Leave request ${newStatus} successfully.`);
        } catch (error) {
            console.error("Error updating status:", error);
            alert("Failed to update status: " + error.message);
        }
    };

    if (loading) return <div className="text-center py-4">Loading leaves...</div>;

    if (leaves.length === 0) {
        return (
            <Card>
                <div className="text-center py-8 text-gray-500">
                    No leave records found.
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {leaves.map(leave => (
                <Card key={leave.id} className="hover:shadow-md transition-shadow">
                    <div className="p-4 sm:p-6 flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full uppercase ${STATUS_COLORS[leave.status]}`}>
                                    {leave.status}
                                </span>
                                <span className="text-sm text-gray-500">
                                    {new Date(leave.createdAt?.toDate()).toLocaleDateString()}
                                </span>
                            </div>

                            <div className="mb-2">
                                <h4 className="font-medium text-gray-900">
                                    {leave.type.charAt(0).toUpperCase() + leave.type.slice(1)} Leave
                                </h4>
                                {mode === 'manage' && (
                                    <p className="text-sm text-gray-600">By: {leave.userName} ({leave.userEmail})</p>
                                )}
                            </div>

                            <div className="flex gap-4 text-sm text-gray-600 mb-2">
                                <div>
                                    <span className="font-medium">From:</span> {leave.startDate}
                                </div>
                                <div>
                                    <span className="font-medium">To:</span> {leave.endDate}
                                </div>
                                <div>
                                    <span className="font-medium">Duration:</span> {leave.days} days
                                </div>
                            </div>

                            <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                                <span className="font-medium">Reason:</span> {leave.reason}
                            </p>
                        </div>

                        {mode === 'manage' && leave.status === 'pending' && (
                            <div className="flex md:flex-col gap-2 justify-center border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-4">
                                <button
                                    onClick={() => handleStatusUpdate(leave.id, 'approved', leave)}
                                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors"
                                >
                                    Approve
                                </button>
                                <button
                                    onClick={() => handleStatusUpdate(leave.id, 'rejected', leave)}
                                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition-colors"
                                >
                                    Reject
                                </button>
                            </div>
                        )}
                    </div>
                </Card>
            ))}
        </div>
    );
}
