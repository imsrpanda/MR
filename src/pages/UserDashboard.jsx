import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/firebase';

export default function UserDashboard() {
    const { currentUser } = useAuth();
    const [pendingApprovals, setPendingApprovals] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser) return;

        const q = query(
            collection(db, "pending_approvals"),
            where("requestedBy", "==", currentUser.uid),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setPendingApprovals(data);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching pending approvals:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    return (
        <DashboardLayout
            title="My Dashboard"
            backgroundClass="bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100"
        >
            <div className="space-y-6">
                {/* Stats Overview */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <Card className="p-6 bg-white/60 backdrop-blur-lg shadow-lg border-white/50 border-l-4 border-indigo-500">
                        <h3 className="text-lg font-semibold text-indigo-900">Pending Requests</h3>
                        <p className="text-3xl font-bold text-indigo-600 mt-2">
                            {pendingApprovals.filter(p => p.status === 'PENDING').length}
                        </p>
                    </Card>
                    <Card className="p-6 bg-white/60 backdrop-blur-lg shadow-lg border-white/50 border-l-4 border-green-500">
                        <h3 className="text-lg font-semibold text-green-900">Approved</h3>
                        <p className="text-3xl font-bold text-green-600 mt-2">
                            {pendingApprovals.filter(p => p.status === 'APPROVED').length}
                        </p>
                    </Card>
                    <Card className="p-6 bg-white/60 backdrop-blur-lg shadow-lg border-white/50 border-l-4 border-red-500">
                        <h3 className="text-lg font-semibold text-red-900">Rejected</h3>
                        <p className="text-3xl font-bold text-red-600 mt-2">
                            {pendingApprovals.filter(p => p.status === 'REJECTED').length}
                        </p>
                    </Card>
                </div>

                {/* Pending Approvals List */}
                <Card className="overflow-hidden bg-white/60 backdrop-blur-lg shadow-lg border-white/50">
                    <div className="p-6 border-b border-gray-100/50">
                        <h3 className="text-lg font-semibold text-gray-900">My Approval Requests</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white/50 text-gray-500 uppercase">
                                <tr>
                                    <th className="px-6 py-3 font-medium">Date</th>
                                    <th className="px-6 py-3 font-medium">Type</th>
                                    <th className="px-6 py-3 font-medium">Details</th>
                                    <th className="px-6 py-3 font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {pendingApprovals.map((request) => (
                                    <tr key={request.id} className="hover:bg-white/40 transition-colors">
                                        <td className="px-6 py-4 text-gray-500">
                                            {request.createdAt?.toDate().toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${request.type === 'ADD' ? 'bg-green-100 text-green-800' :
                                                request.type === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-red-100 text-red-800'
                                                }`}>
                                                {request.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-900">
                                            {request.type === 'DELETE' ? (
                                                <span>Record ID: {request.recordId}</span>
                                            ) : (
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{request.data.name}</span>
                                                    <span className="text-xs text-gray-500">{request.data.district}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${request.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                                request.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                                                    'bg-red-100 text-red-800'
                                                }`}>
                                                {request.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {pendingApprovals.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                                            No approval requests found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </DashboardLayout>
    );
}
