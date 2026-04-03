import React, { useState, useEffect } from 'react';
import { db } from '../firebase/firebase';
import { collection, deleteDoc, doc, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/ui/Card';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function BillsList() {
    const { userRole, currentUser } = useAuth();
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        if (!currentUser) return;

        let q;
        if (userRole === 'user') {
            q = query(collection(db, "bills"), where("createdBy", "==", currentUser.uid), orderBy("createdAt", "desc"));
        } else {
            // Admin sees all
            q = query(collection(db, "bills"), orderBy("createdAt", "desc"));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setBills(data);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching bills:", error);
            if (error.code === 'failed-precondition') {
                console.warn("Index might be required if querying with orderBy and where together.");
                // Fallback to basic query if index is missing
                const fallbackQ = query(collection(db, "bills"));
                onSnapshot(fallbackQ, (fallbackSnap) => {
                    let fallbackData = fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    if (userRole === 'user') fallbackData = fallbackData.filter(d => d.createdBy === currentUser.uid);
                    fallbackData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                    setBills(fallbackData);
                    setLoading(false);
                });
            } else {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [currentUser, userRole]);

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to completely delete this saved bill? This action cannot be undone.")) {
            try {
                await deleteDoc(doc(db, "bills", id));
            } catch (error) {
                console.error("Error deleting bill: ", error);
                alert("Failed to delete bill.");
            }
        }
    };

    const filteredBills = bills.filter(bill => {
        const queryTerm = searchQuery.toLowerCase();
        return (
            (bill.header?.name && bill.header.name.toLowerCase().includes(queryTerm)) ||
            (bill.header?.no && bill.header.no.toLowerCase().includes(queryTerm))
        );
    });

    return (
        <DashboardLayout title="Bill History">
            <Card className="p-0 overflow-hidden flex flex-col min-h-[500px]">
                {/* Toolbar */}
                <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="relative flex-1 max-w-md w-full">
                        <input
                            type="text"
                            placeholder="Search by Bill No. or Customer Name..."
                            className="block w-full pl-4 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        {userRole === 'admin' && (
                            <button 
                                onClick={() => navigate('/bill/create')}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
                            >
                                + Create New Bill
                            </button>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 uppercase">
                            <tr>
                                <th className="px-6 py-3 font-medium">Date</th>
                                <th className="px-6 py-3 font-medium">Bill No.</th>
                                <th className="px-6 py-3 font-medium">Customer (Bill To)</th>
                                <th className="px-6 py-3 font-medium text-right">Net Amount</th>
                                <th className="px-6 py-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="5" className="text-center py-8 text-gray-500">Loading bills...</td></tr>
                            ) : filteredBills.length === 0 ? (
                                <tr><td colSpan="5" className="text-center py-8 text-gray-500">No saved bills found.</td></tr>
                            ) : (
                                filteredBills.map((bill) => (
                                    <tr key={bill.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                                            {bill.createdAt?.seconds ? new Date(bill.createdAt.seconds * 1000).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            {bill.header?.no || '-'}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            {bill.header?.name || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium">
                                            ₹ {bill.totals?.netTotal?.toFixed(2) || '0.00'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => navigate('/bill/create', { state: { billData: bill } })}
                                                className="text-indigo-600 hover:text-indigo-900 font-medium"
                                            >
                                                View / Print
                                            </button>
                                            {userRole === 'admin' && (
                                                <button
                                                    onClick={() => handleDelete(bill.id)}
                                                    className="text-red-600 hover:text-red-900 font-medium ml-4"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </DashboardLayout>
    );
}
