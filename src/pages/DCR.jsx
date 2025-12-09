import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/firebase';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where } from 'firebase/firestore';
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

const DCR_COLS_DEF = [
    { id: 'status', label: 'Status' },
    { id: 'type', label: 'Type' },
    { id: 'name', label: 'Name' },
    { id: 'specialist', label: 'Specialist' },
    { id: 'location', label: 'Location' },
    { id: 'visited', label: 'Visited' },
    { id: 'actions', label: 'Actions' }
];

export default function DCR() {
    const { userRole, userData, currentUser } = useAuth();
    const [visits, setVisits] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Column Preferences State
    const [visibleColumns, setVisibleColumns] = useState(() => {
        const saved = localStorage.getItem('dcr_columns');
        return saved ? JSON.parse(saved) : ['name', 'status', 'actions'];
    });

    useEffect(() => {
        localStorage.setItem('dcr_columns', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    // Modal & Edit State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVisit, setEditingVisit] = useState(null);

    const initialFormState = {
        type: 'Doctor',
        name: '',
        specialist: '',
        district: '',
        city: '',
        productShown: '',
        status: 'Pending',
        visited: false,
        comment: '',
        location: null
    };
    const [formData, setFormData] = useState(initialFormState);

    // Calculate available districts based on user role
    const availableDistricts = useMemo(() => {
        if (userRole === 'user' && userData?.assignedDistricts) {
            return ODISHA_DISTRICTS.filter(d => userData.assignedDistricts.includes(d));
        }
        return ODISHA_DISTRICTS;
    }, [userRole, userData]);

    // Subscribe to Visits
    useEffect(() => {
        let q;
        if (userRole === 'user') {
            q = query(
                collection(db, "visits"),
                where("createdBy", "==", currentUser.uid),
                orderBy("createdAt", "desc")
            );
        } else {
            // Admin sees all
            q = query(collection(db, "visits"), orderBy("createdAt", "desc"));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setVisits(data);
        }, (error) => {
            console.error("Error fetching visits:", error);
            // Handle index error gracefully if index is missing
            if (error.code === 'failed-precondition') {
                console.warn("Missing index for query. Please create index in Firebase Console.");
            }
        });
        return () => unsubscribe();
    }, [userRole, currentUser]);

    const handleOpenModal = (visit = null) => {
        if (visit) {
            setEditingVisit(visit);
            setFormData({
                type: visit.type,
                name: visit.name,
                specialist: visit.specialist || '',
                district: visit.district,
                city: visit.city,
                productShown: visit.productShown,
                status: visit.status,
                visited: visit.visited || false,
                comment: visit.comment || '',
                location: visit.location || null
            });
        } else {
            setEditingVisit(null);
            setFormData(initialFormState);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingVisit(null);
        setFormData(initialFormState);
    };

    const getLocation = () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("Geolocation is not supported by your browser"));
            } else {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        resolve({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        });
                    },
                    (error) => {
                        reject(error);
                    }
                );
            }
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            let dataToSave = { ...formData };

            // Logic for User completing a visit
            if (userRole === 'user' && editingVisit && editingVisit.status === 'Approved' && formData.visited) {
                try {
                    const location = await getLocation();
                    dataToSave.location = location;
                    dataToSave.status = 'Visited';
                } catch (error) {
                    alert("Error getting location: " + error.message + ". Please enable location services.");
                    setLoading(false);
                    return;
                }
            }

            if (editingVisit) {
                await updateDoc(doc(db, "visits", editingVisit.id), {
                    ...dataToSave,
                    updatedAt: serverTimestamp(),
                    updatedBy: currentUser.uid
                });
            } else {
                await addDoc(collection(db, "visits"), {
                    ...dataToSave,
                    status: 'Pending', // Always pending on creation
                    visited: false,
                    createdBy: currentUser.uid,
                    createdByName: userData.name || currentUser.email,
                    createdAt: serverTimestamp()
                });
            }
            handleCloseModal();
        } catch (error) {
            console.error("Error saving visit: ", error);
            alert("Error saving visit. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleAdminAction = async (newStatus) => {
        setLoading(true);
        try {
            if (editingVisit) {
                await updateDoc(doc(db, "visits", editingVisit.id), {
                    ...formData,
                    status: newStatus,
                    updatedAt: serverTimestamp(),
                    updatedBy: currentUser.uid
                });
                handleCloseModal();
            }
        } catch (error) {
            console.error("Error updating visit status: ", error);
            alert("Error updating status. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const filteredVisits = visits.filter(visit =>
        visit.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        visit.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        visit.district.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <DashboardLayout title="Daily Call Report (DCR)">
            <Card className="p-0 overflow-hidden flex flex-col min-h-[500px]">
                {/* Toolbar */}
                <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <input
                            type="text"
                            placeholder="Search visits..."
                            className="block w-full pl-4 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <ColumnToggle
                            columns={DCR_COLS_DEF}
                            visibleColumns={visibleColumns}
                            onChange={setVisibleColumns}
                        />
                        {userRole === 'user' && (
                            <Button onClick={() => handleOpenModal()}>
                                + Request New Visit
                            </Button>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 uppercase">
                            <tr>
                                {visibleColumns.includes('status') && <th className="px-6 py-3 font-medium">Status</th>}
                                {visibleColumns.includes('type') && <th className="px-6 py-3 font-medium">Type</th>}
                                {visibleColumns.includes('name') && <th className="px-6 py-3 font-medium">Name</th>}
                                {visibleColumns.includes('specialist') && <th className="px-6 py-3 font-medium">Specialist</th>}
                                {visibleColumns.includes('location') && <th className="px-6 py-3 font-medium">Location</th>}
                                {visibleColumns.includes('visited') && <th className="px-6 py-3 font-medium">Visited</th>}
                                {visibleColumns.includes('actions') && <th className="px-6 py-3 font-medium text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredVisits.map((visit) => (
                                <tr key={visit.id} className="hover:bg-gray-50 transition-colors">
                                    {visibleColumns.includes('status') && (
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium 
                                            ${visit.status === 'Approved' ? 'bg-green-100 text-green-800' :
                                                    visit.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                                                        visit.status === 'Visited' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-yellow-100 text-yellow-800'}`}>
                                                {visit.status}
                                            </span>
                                        </td>
                                    )}
                                    {visibleColumns.includes('type') && <td className="px-6 py-4">{visit.type}</td>}
                                    {visibleColumns.includes('name') && <td className="px-6 py-4 font-medium text-gray-900">{visit.name}</td>}
                                    {visibleColumns.includes('specialist') && (
                                        <td className="px-6 py-4 text-gray-500">
                                            {visit.specialist || '-'}
                                        </td>
                                    )}
                                    {visibleColumns.includes('location') && (
                                        <td className="px-6 py-4 text-gray-500">
                                            <div className="flex flex-col">
                                                <span>{visit.city}</span>
                                                <span className="text-xs text-gray-400">{visit.district}</span>
                                            </div>
                                        </td>
                                    )}
                                    {visibleColumns.includes('visited') && (
                                        <td className="px-6 py-4">
                                            {visit.visited ? (
                                                <span className="text-green-600 font-bold">✓</span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                    )}
                                    {visibleColumns.includes('actions') && (
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleOpenModal(visit)}
                                                className="text-indigo-600 hover:text-indigo-900 font-medium"
                                            >
                                                {userRole === 'admin' ? 'Review' : (visit.status === 'Approved' ? 'Complete' : 'View')}
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {filteredVisits.length === 0 && (
                                <tr>
                                    <td colSpan={visibleColumns.length} className="px-6 py-8 text-center text-gray-500">
                                        No visits found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={editingVisit ? (userRole === 'admin' ? 'Review Visit' : 'Edit Visit') : 'Request New Visit'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Read-only fields if user is editing an approved/visited record, or if admin is reviewing */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                disabled={!!editingVisit}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white disabled:bg-gray-100"
                            >
                                <option value="Doctor">Doctor</option>
                                <option value="Chemist">Chemist</option>
                            </select>
                        </div>
                        <Input
                            label="Name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            disabled={!!editingVisit}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Specialist</label>
                        <select
                            value={formData.specialist}
                            onChange={(e) => setFormData({ ...formData, specialist: e.target.value })}
                            disabled={!!editingVisit}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white disabled:bg-gray-100"
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
                                disabled={!!editingVisit}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white disabled:bg-gray-100"
                                required
                            >
                                <option value="">Select District</option>
                                {availableDistricts.map((district) => (
                                    <option key={district} value={district}>{district}</option>
                                ))}
                            </select>
                        </div>
                        <Input
                            label="City"
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            disabled={!!editingVisit}
                            required
                        />
                    </div>

                    <div className="mb-4">
                        <MultiSelect
                            label="Product Shown"
                            options={PRODUCTS}
                            value={formData.productShown ? formData.productShown.split(',').map(p => p.trim()).filter(p => p) : []}
                            onChange={(newVal) => setFormData({ ...formData, productShown: newVal.join(', ') })}
                            disabled={userRole === 'admin' || (editingVisit && (editingVisit.status === 'Visited' || editingVisit.status === 'Rejected'))}
                            placeholder="Select products..."
                        />
                    </div>

                    {/* Status Field - Admin Only Edit */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            disabled={userRole !== 'admin'}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white disabled:bg-gray-100 font-medium"
                        >
                            <option value="Pending">Pending</option>
                            <option value="Approved">Approved</option>
                            <option value="Rejected">Rejected</option>
                            <option value="Visited">Visited</option>
                        </select>
                    </div>

                    {/* Visited Checkbox & Comment - Enabled for User if Approved */}
                    <div className="border-t pt-4 mt-4">
                        <div className="flex items-center gap-2 mb-4">
                            <input
                                type="checkbox"
                                id="visited"
                                checked={formData.visited}
                                onChange={(e) => setFormData({ ...formData, visited: e.target.checked })}
                                disabled={!editingVisit || editingVisit.status !== 'Approved' || userRole === 'admin'}
                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:opacity-50"
                            />
                            <label htmlFor="visited" className="text-sm font-medium text-gray-700">Mark as Visited</label>
                        </div>

                        {formData.visited && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Visit Comment</label>
                                <textarea
                                    value={formData.comment}
                                    onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    rows="3"
                                    placeholder="Enter details about the visit..."
                                    required={formData.visited}
                                    disabled={userRole === 'admin' || editingVisit?.status === 'Visited'}
                                />
                            </div>
                        )}

                        {formData.location && (
                            <div className="mt-2">
                                <a
                                    href={`https://www.google.com/maps?q=${formData.location.lat},${formData.location.lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1"
                                >
                                    📍 View Location on Map ({formData.location.lat.toFixed(6)}, {formData.location.lng.toFixed(6)})
                                </a>
                            </div>
                        )}
                    </div>

                    <div className="pt-4 flex gap-3">
                        <Button type="button" variant="secondary" onClick={handleCloseModal} className="flex-1">
                            {/* Show 'Close' if it's a view-only scenario for User or Admin */}
                            {(editingVisit && userRole === 'user' && editingVisit.status !== 'Approved') ||
                                (editingVisit && userRole === 'admin' && editingVisit.status !== 'Pending')
                                ? 'Close' : 'Cancel'}
                        </Button>

                        {/* Admin Actions: Approve / Reject - ONLY for Pending records */}
                        {editingVisit && userRole === 'admin' && editingVisit.status === 'Pending' ? (
                            <>
                                <Button
                                    type="button"
                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                                    onClick={() => handleAdminAction('Rejected')}
                                    disabled={loading}
                                >
                                    Reject
                                </Button>
                                <Button
                                    type="button"
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                    onClick={() => handleAdminAction('Approved')}
                                    disabled={loading}
                                >
                                    Approve
                                </Button>
                            </>
                        ) : (
                            /* User / Standard Save Action */
                            (!editingVisit || (userRole === 'user' && editingVisit.status === 'Approved')) && (
                                <Button type="submit" disabled={loading} className="flex-1">
                                    {loading ? 'Saving...' : 'Save'}
                                </Button>
                            )
                        )}
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
