import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where } from 'firebase/firestore';
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import ColumnToggle from '../components/ui/ColumnToggle';
import MultiSelect from '../components/ui/MultiSelect';
import { useAuth } from '../contexts/AuthContext';
import { ODISHA_DISTRICTS } from '../constants/districts';
import { PRODUCTS } from '../constants/products';

const SPECIALISTS = ['D&G', 'SVR', 'URO', 'PED', 'PHY', 'GP', 'CP', 'MBBSORTH', 'CHESTSKIN', 'NEU', 'OTHER'];

const MASTER_RECORDS_COLS_DEF = [
    { id: 'type', label: 'Type' },
    { id: 'name', label: 'Name' },
    { id: 'specialist', label: 'Specialist' },
    { id: 'location', label: 'Location' },
    { id: 'visited', label: 'Visited' },
    { id: 'product', label: 'Product' },
    { id: 'actions', label: 'Actions' }
];

export default function MasterRecords() {
    console.log("MasterRecords: Rendering...");
    const { userRole, userData, currentUser } = useAuth();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Column Preferences State
    const [visibleColumns, setVisibleColumns] = useState(() => {
        const saved = localStorage.getItem('master_records_columns');
        return saved ? JSON.parse(saved) : ['type', 'name', 'location', 'actions'];
    });

    useEffect(() => {
        localStorage.setItem('master_records_columns', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    // Modal & Edit State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);

    const initialFormState = {
        type: 'Doctor',
        name: '',
        specialist: '',
        district: '',
        city: '',
        visited: false,
        productShown: ''
    };
    const [formData, setFormData] = useState(initialFormState);

    // Pending Approvals State
    const [pendingApprovals, setPendingApprovals] = useState([]);

    // Calculate available districts based on user role
    const availableDistricts = useMemo(() => {
        if (userRole === 'user' && userData?.assignedDistricts) {
            return ODISHA_DISTRICTS.filter(d => userData.assignedDistricts.includes(d));
        }
        return ODISHA_DISTRICTS;
    }, [userRole, userData]);

    // Subscribe to Master Records
    useEffect(() => {
        console.log("MasterRecords: Subscribing to master_records");
        const q = query(collection(db, "master_records"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log("MasterRecords: Fetched records", data.length);
            setRecords(data);
        }, (error) => {
            console.error("Error fetching records:", error);
        });
        return () => unsubscribe();
    }, []);

    // Subscribe to Pending Approvals for current user
    useEffect(() => {
        if (currentUser) {
            console.log("MasterRecords: Subscribing to pending_approvals for user", currentUser.uid);
            const qApprovals = query(
                collection(db, "pending_approvals"),
                where("requestedBy", "==", currentUser.uid),
                where("status", "==", "PENDING")
            );
            const unsubscribe = onSnapshot(qApprovals, (snapshot) => {
                const approvals = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                console.log("MasterRecords: Fetched pending approvals", approvals.length);
                setPendingApprovals(approvals);
            }, (error) => {
                console.error("Error fetching pending approvals:", error);
            });
            return () => unsubscribe();
        }
    }, [currentUser]);

    const handleOpenModal = (record = null) => {
        if (record) {
            setEditingRecord(record);
            setFormData({
                type: record.type,
                name: record.name,
                specialist: record.specialist || '',
                district: record.district,
                city: record.city,
                visited: record.visited,
                productShown: record.productShown || ''
            });
        } else {
            setEditingRecord(null);
            setFormData(initialFormState);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingRecord(null);
        setFormData(initialFormState);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const dataToSave = {
                ...formData
            };

            if (userRole === 'user') {
                // Check for existing pending request if updating
                if (editingRecord) {
                    const existingRequest = pendingApprovals.find(req => req.recordId === editingRecord.id);

                    if (existingRequest) {
                        if (window.confirm("A pending approval request already exists for this record. Do you want to override it with these new changes?")) {
                            // Override existing request
                            await updateDoc(doc(db, "pending_approvals", existingRequest.id), {
                                type: 'UPDATE',
                                data: dataToSave,
                                createdAt: serverTimestamp()
                            });
                            alert("Existing request updated successfully.");
                            handleCloseModal();
                            setLoading(false);
                            return;
                        } else {
                            setLoading(false);
                            return; // User cancelled override
                        }
                    }
                }

                // Create new pending approval request
                await addDoc(collection(db, "pending_approvals"), {
                    type: editingRecord ? 'UPDATE' : 'ADD',
                    collection: 'master_records',
                    data: dataToSave,
                    recordId: editingRecord ? editingRecord.id : null,
                    status: 'PENDING',
                    requestedBy: currentUser.uid,
                    requestedByName: userData.name || currentUser.email,
                    requestedByEmail: currentUser.email,
                    createdAt: serverTimestamp()
                });
                alert("Request sent to Admin for approval.");
            } else {
                // Admin: Direct execution
                if (editingRecord) {
                    await updateDoc(doc(db, "master_records", editingRecord.id), {
                        ...dataToSave,
                        updatedAt: serverTimestamp(),
                        updatedByRole: userRole
                    });
                } else {
                    await addDoc(collection(db, "master_records"), {
                        ...dataToSave,
                        createdAt: serverTimestamp(),
                        createdByRole: userRole
                    });
                }
            }
            handleCloseModal();
        } catch (error) {
            console.error("Error saving record: ", error);
            alert("Error saving record. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this record? This action cannot be undone.")) {
            try {
                if (userRole === 'user') {
                    // Check for existing pending request
                    const existingRequest = pendingApprovals.find(req => req.recordId === id);

                    if (existingRequest) {
                        if (window.confirm("A pending approval request already exists for this record. Do you want to override it and request deletion instead?")) {
                            // Override existing request
                            await updateDoc(doc(db, "pending_approvals", existingRequest.id), {
                                type: 'DELETE',
                                data: null,
                                createdAt: serverTimestamp()
                            });
                            alert("Existing request updated to DELETE.");
                            return;
                        } else {
                            return; // User cancelled override
                        }
                    }

                    // Create pending approval request for DELETE
                    await addDoc(collection(db, "pending_approvals"), {
                        type: 'DELETE',
                        collection: 'master_records',
                        data: null,
                        recordId: id,
                        status: 'PENDING',
                        requestedBy: currentUser.uid,
                        requestedByName: userData.name || currentUser.email,
                        requestedByEmail: currentUser.email,
                        createdAt: serverTimestamp()
                    });
                    alert("Delete request sent to Admin for approval.");
                } else {
                    // Admin: Direct delete
                    await deleteDoc(doc(db, "master_records", id));
                }
            } catch (error) {
                console.error("Error deleting record: ", error);
                alert("Error deleting record.");
            }
        }
    };

    const filteredRecords = records.filter(record => {
        // Filter by assigned districts for 'user' role
        if (userRole === 'user') {
            const assignedDistricts = userData?.assignedDistricts || [];
            if (!assignedDistricts.includes(record.district)) {
                return false;
            }
        }

        // Existing search filter
        return (
            record.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            record.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
            record.district.toLowerCase().includes(searchQuery.toLowerCase())
        );
    });

    return (
        <DashboardLayout title="Master Records">
            <Card className="p-0 overflow-hidden flex flex-col min-h-[500px]">
                {/* Toolbar */}
                <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Search by name, city, or district..."
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <ColumnToggle
                            columns={MASTER_RECORDS_COLS_DEF}
                            visibleColumns={visibleColumns}
                            onChange={setVisibleColumns}
                        />
                        <Button onClick={() => handleOpenModal()}>
                            + Add New Record
                        </Button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 uppercase">
                            <tr>

                                {visibleColumns.includes('type') && <th className="px-6 py-3 font-medium">Type</th>}
                                {visibleColumns.includes('name') && <th className="px-6 py-3 font-medium">Name</th>}
                                {visibleColumns.includes('specialist') && <th className="px-6 py-3 font-medium">Specialist</th>}
                                {visibleColumns.includes('location') && <th className="px-6 py-3 font-medium">Location</th>}
                                {visibleColumns.includes('visited') && <th className="px-6 py-3 font-medium">Visited</th>}
                                {visibleColumns.includes('product') && <th className="px-6 py-3 font-medium">Product</th>}
                                {visibleColumns.includes('actions') && <th className="px-6 py-3 font-medium text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredRecords.map((record) => (
                                <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                                    {visibleColumns.includes('type') && (
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${record.type === 'Doctor' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                                }`}>
                                                {record.type}
                                            </span>
                                        </td>
                                    )}
                                    {visibleColumns.includes('name') && <td className="px-6 py-4 font-medium text-gray-900">{record.name}</td>}
                                    {visibleColumns.includes('specialist') && (
                                        <td className="px-6 py-4 text-gray-500">
                                            {record.specialist || '-'}
                                        </td>
                                    )}
                                    {visibleColumns.includes('location') && (
                                        <td className="px-6 py-4 text-gray-500">
                                            <div className="flex flex-col">
                                                <span>{record.city}</span>
                                                <span className="text-xs text-gray-400">{record.district}</span>
                                            </div>
                                        </td>
                                    )}
                                    {visibleColumns.includes('visited') && (
                                        <td className="px-6 py-4">
                                            {record.visited ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                    Yes
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                                    No
                                                </span>
                                            )}
                                        </td>
                                    )}
                                    {visibleColumns.includes('product') && (
                                        <td className="px-6 py-4 text-gray-500">
                                            {record.productShown || '-'}
                                        </td>
                                    )}
                                    {visibleColumns.includes('actions') && (
                                        <td className="px-6 py-4 text-right space-x-2">
                                            <button
                                                onClick={() => handleOpenModal(record)}
                                                className="text-indigo-600 hover:text-indigo-900 font-medium"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(record.id)}
                                                className="text-red-600 hover:text-red-900 font-medium"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {filteredRecords.length === 0 && (
                                <tr>
                                    <td colSpan={visibleColumns.length} className="px-6 py-8 text-center text-gray-500">
                                        {searchQuery ? 'No matching records found.' : 'No records found. Add one to get started!'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Add/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={editingRecord ? 'Edit Record' : 'Add New Record'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                        >
                            <option value="Doctor">Doctor</option>
                            <option value="Chemist">Chemist</option>
                        </select>
                    </div>

                    <Input
                        label="Name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. John Doe"
                        required
                    />

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Specialist</label>
                        <select
                            value={formData.specialist}
                            onChange={(e) => setFormData({ ...formData, specialist: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                        >
                            <option value="">Select Specialist</option>
                            {SPECIALISTS.map((spec) => (
                                <option key={spec} value={spec}>
                                    {spec}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
                            <select
                                value={formData.district}
                                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                required
                            >
                                <option value="">Select District</option>
                                {availableDistricts.map((district) => (
                                    <option key={district} value={district}>
                                        {district}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <Input
                            label="City"
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            placeholder="e.g. Manhattan"
                            required
                        />
                    </div>

                    <div className="flex items-center gap-2 py-2">
                        <input
                            type="checkbox"
                            id="visited"
                            checked={formData.visited}
                            onChange={(e) => setFormData({ ...formData, visited: e.target.checked })}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <label htmlFor="visited" className="text-sm font-medium text-gray-700">Visited</label>
                    </div>

                    {/* Product Dropdown */}
                    <div>
                        <MultiSelect
                            label="Product Shown"
                            options={PRODUCTS}
                            value={formData.productShown ? formData.productShown.split(',').map(p => p.trim()).filter(p => p) : []}
                            onChange={(newVal) => setFormData({ ...formData, productShown: newVal.join(', ') })}
                            placeholder="Select products..."
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <Button type="button" variant="secondary" onClick={handleCloseModal} className="flex-1">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading} className="flex-1">
                            {loading ? 'Saving...' : 'Save Record'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
