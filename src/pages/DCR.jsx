import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { db } from '../firebase/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where, getDoc } from 'firebase/firestore';
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
import { SPECIALISTS } from '../constants/specialists';

const DCR_COLS_DEF = [
    { id: 'createdDate', label: 'Date' },
    { id: 'status', label: 'Status' },
    { id: 'type', label: 'Type' },
    { id: 'name', label: 'Name' },
    { id: 'specialist', label: 'Specialist' },
    { id: 'location', label: 'Location' },
    { id: 'visited', label: 'Visited' },
    { id: 'visitedAt', label: 'Visited Time' },
    { id: 'actions', label: 'Actions' }
];

export default function DCR() {
    const { userRole, userData, currentUser, loading: authLoading } = useAuth();
    const [visits, setVisits] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [masterRecords, setMasterRecords] = useState([]);
    const [dcrCities, setDcrCities] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Date Filter State
    const [dateFilter, setDateFilter] = useState('Today');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    // Handle Navigation State from Dashboard
    const location = useLocation();

    useEffect(() => {
        if (location.state?.filterStatus) {
            setStatusFilter(location.state.filterStatus);
            // If filtering by specific status (like Visited), usually implies full history check
            if (location.state.filterStatus === 'Visited') {
                setDateFilter('All');
            }
        }
    }, [location.state]);

    // Column Preferences State
    const [visibleColumns, setVisibleColumns] = useState(() => {
        const saved = localStorage.getItem('dcr_columns');
        return saved ? JSON.parse(saved) : ['createdDate', 'name', 'status', 'actions'];
    });

    useEffect(() => {
        localStorage.setItem('dcr_columns', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    // Modal & Edit State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVisit, setEditingVisit] = useState(null);

    // Bulk Visit Creation State
    const [bulkVisitMode, setBulkVisitMode] = useState(false);
    const [selectedCities, setSelectedCities] = useState([]);
    const [cityDoctors, setCityDoctors] = useState({});


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
        if (!currentUser) return;
        let q;
        if (userRole === 'user') {
            q = query(
                collection(db, "visits"),
                where("createdBy", "==", currentUser.uid)
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
            // Client-side sort to avoid index requirements
            data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
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

    // Subscribe to Master Records for suggestions
    useEffect(() => {
        const q = query(collection(db, "master_records"), orderBy("name"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMasterRecords(data);
        }, (error) => {
            console.error("Error fetching master records:", error);
        });
        return () => unsubscribe();
    }, []);

    // Filter Master Records for Auto-complete
    const filteredMasterOptions = useMemo(() => {
        return masterRecords.filter(record => {
            // Filter by Type
            if (record.type !== formData.type) return false;

            // Filter by User Assignments
            if (userRole === 'user') {
                const assignedDistricts = userData?.assignedDistricts || [];
                const assignedCities = userData?.assignedCities || [];
                const assignedSpecialities = userData?.assignedSpecialities || [];

                // If userData is not loaded yet, don't show any options just to be safe, or allow all? 
                // Better to be safe: if user is logged in they should have data. 
                if (!userData) return false;

                // Location Access
                // Must be in assigned district
                if (!assignedDistricts.includes(record.district)) return false;

                // If specific cities are assigned, record must be in one of those cities
                if (assignedCities.length > 0 && !assignedCities.includes(record.city)) return false;

                // Speciality Access
                if (assignedSpecialities.length > 0) {
                    if (!assignedSpecialities.includes(record.specialist)) return false;
                }
            }
            return true;
        });
    }, [masterRecords, formData.type, userRole, userData]);

    const checkPastVisits = (doctorName) => {
        if (!doctorName || userRole !== 'user' || editingVisit) return;

        // Find past COMPLETED visits for this doctor
        const pastVisits = visits.filter(v =>
            v.name?.toLowerCase() === doctorName.toLowerCase() &&
            v.status === 'Visited'
        );

        if (pastVisits.length > 0) {
            // Sort by visitedAt to find the last one
            const sorted = [...pastVisits].sort((a, b) =>
                (b.visitedAt?.seconds || 0) - (a.visitedAt?.seconds || 0)
            );

            const lastVisit = sorted[0];
            const lastDate = lastVisit.visitedAt?.seconds
                ? new Date(lastVisit.visitedAt.seconds * 1000).toLocaleDateString()
                : 'Unknown';

            alert(`History for ${doctorName}:\nTotal Visits: ${pastVisits.length}\nLast Visit: ${lastDate}`);
        }
    };

    const handleOpenModal = (visit = null) => {
        setBulkVisitMode(false);
        setSelectedCities([]);
        setCityDoctors({});
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
            // Fetch cities for existing visit
            if (visit.district) {
                const fetchCities = async () => {
                    try {
                        const docRef = doc(db, "district_locations", visit.district);
                        const docSnap = await getDoc(docRef);
                        if (docSnap.exists()) {
                            const data = docSnap.data();
                            if (Array.isArray(data.cities)) {
                                setDcrCities(data.cities);
                            } else if (typeof data.cities === 'string') {
                                setDcrCities(data.cities.split(',').map(c => c.trim()).filter(c => c));
                            } else {
                                setDcrCities([]);
                            }
                        } else {
                            setDcrCities([]);
                        }
                    } catch (error) {
                        console.error("Error fetching cities for visit:", error);
                        setDcrCities([]);
                    }
                };
                fetchCities();
            }
        } else {
            setEditingVisit(null);
            setFormData(initialFormState);
            setDcrCities([]);
        }
        setIsModalOpen(true);
    };

    // Watch for district changes to update available cities
    useEffect(() => {
        const fetchCities = async () => {
            if (!formData.district) {
                setDcrCities([]);
                return;
            }
            try {
                const docRef = doc(db, "district_locations", formData.district);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (Array.isArray(data.cities)) {
                        setDcrCities(data.cities);
                    } else if (typeof data.cities === 'string') {
                        setDcrCities(data.cities.split(',').map(c => c.trim()).filter(c => c));
                    } else {
                        setDcrCities([]);
                    }
                } else {
                    setDcrCities([]);
                }
            } catch (error) {
                console.error("Error fetching cities:", error);
                setDcrCities([]);
            }
        };

        if (isModalOpen) {
            fetchCities();
        }
    }, [formData.district, isModalOpen]);

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingVisit(null);
        setFormData(initialFormState);
        setDcrCities([]);
        setBulkVisitMode(false);
        setSelectedCities([]);
        setCityDoctors({});
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
                } catch (error) {
                    console.warn("Location not captured:", error);
                    // Continue without location
                }
                dataToSave.status = 'Visited';
                dataToSave.visitedAt = serverTimestamp();
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

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this visit request?")) {
            try {
                await deleteDoc(doc(db, "visits", id));
            } catch (error) {
                console.error("Error deleting visit: ", error);
                alert("Error deleting visit.");
            }
        }
    };

    const filteredVisits = visits.filter(visit => {
        // 1. Text Search
        const matchesSearch = (
            (visit.name && visit.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (visit.city && visit.city.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (visit.district && visit.district.toLowerCase().includes(searchQuery.toLowerCase()))
        );
        if (!matchesSearch) return false;

        // 2. Status Filter
        if (statusFilter !== 'All' && visit.status !== statusFilter) return false;

        // 3. Date Filter
        if (dateFilter === 'All') return true;

        if (!visit.createdAt) return false;
        const visitDate = new Date(visit.createdAt.seconds * 1000);
        visitDate.setHours(0, 0, 0, 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (dateFilter === 'Today') {
            return visitDate.getTime() === today.getTime();
        }

        if (dateFilter === 'Yesterday') {
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            return visitDate.getTime() === yesterday.getTime();
        }

        if (dateFilter === 'Custom') {
            if (!customStartDate || !customEndDate) return true;
            const start = new Date(customStartDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(customEndDate);
            end.setHours(0, 0, 0, 0);
            return visitDate >= start && visitDate <= end;
        }

        return true;
    });

    if (authLoading || !currentUser) {
        return <div className="p-8 flex justify-center text-gray-500">Loading user data...</div>;
    }

    return (
        <DashboardLayout title="Daily Call Report (DCR)">
            <Card className="p-0 overflow-hidden flex flex-col min-h-[500px]">
                {/* Toolbar */}
                <div className="p-6 border-b border-gray-100 flex flex-col gap-4">
                    {/* Date Filters */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-gray-700 mr-2">Filter Date:</span>
                        {['Today', 'Yesterday', 'Custom', 'All'].map(filter => (
                            <button
                                key={filter}
                                onClick={() => setDateFilter(filter)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${dateFilter === filter
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                    }`}
                            >
                                {filter}
                            </button>
                        ))}

                        {dateFilter === 'Custom' && (
                            <div className="flex items-center gap-2 ml-2 animate-in fade-in slide-in-from-left-2 duration-200">
                                <input
                                    type="date"
                                    value={customStartDate}
                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                    className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                />
                                <span className="text-gray-400">-</span>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                    className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                />
                            </div>
                        )}

                        <div className="h-6 w-px bg-gray-300 mx-2 hidden sm:block"></div>
                        <span className="text-sm font-medium text-gray-700 mr-1">Status:</span>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-2 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                            <option value="All">All Status</option>
                            <option value="Pending">Pending</option>
                            <option value="Approved">Approved</option>
                            <option value="Rejected">Rejected</option>
                            <option value="Visited">Visited</option>
                        </select>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                </div>

                {/* Table */}
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 uppercase">
                            <tr>
                                {visibleColumns.includes('createdDate') && <th className="px-6 py-3 font-medium">Date</th>}
                                {visibleColumns.includes('status') && <th className="px-6 py-3 font-medium">Status</th>}
                                {visibleColumns.includes('type') && <th className="px-6 py-3 font-medium">Type</th>}
                                {visibleColumns.includes('name') && <th className="px-6 py-3 font-medium">Name</th>}
                                {visibleColumns.includes('specialist') && <th className="px-6 py-3 font-medium">Specialist</th>}
                                {visibleColumns.includes('location') && <th className="px-6 py-3 font-medium">Location</th>}
                                {visibleColumns.includes('visited') && <th className="px-6 py-3 font-medium">Visited</th>}
                                {visibleColumns.includes('visitedAt') && <th className="px-6 py-3 font-medium">Visited Time</th>}
                                {visibleColumns.includes('actions') && <th className="px-6 py-3 font-medium text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredVisits.map((visit) => (
                                <tr key={visit.id} className="hover:bg-gray-50 transition-colors">
                                    {visibleColumns.includes('createdDate') && (
                                        <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                                            {visit.createdAt?.seconds ? new Date(visit.createdAt.seconds * 1000).toLocaleDateString() : '-'}
                                        </td>
                                    )}
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
                                    {visibleColumns.includes('visitedAt') && (
                                        <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                                            {visit.visitedAt?.seconds ? new Date(visit.visitedAt.seconds * 1000).toLocaleString() : '-'}
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
                                            {visit.status !== 'Visited' && (
                                                <button
                                                    onClick={() => handleDelete(visit.id)}
                                                    className="text-red-600 hover:text-red-900 font-medium ml-2"
                                                >
                                                    Delete
                                                </button>
                                            )}
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
                title={bulkVisitMode ? 'Create Visits by Cities' : (editingVisit ? (userRole === 'admin' ? 'Review Visit' : 'Edit Visit') : 'Request New Visit')}
            >
                {!editingVisit && (
                    <div className="mb-4 p-3 bg-indigo-50 rounded-lg flex items-center gap-2 cursor-pointer" onClick={() => setBulkVisitMode(!bulkVisitMode)}>
                        <input
                            type="checkbox"
                            checked={bulkVisitMode}
                            onChange={(e) => setBulkVisitMode(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <label className="text-sm font-medium text-indigo-900 cursor-pointer">Create visits by cities</label>
                    </div>
                )}

                {!bulkVisitMode ? (
                    /* Regular Visit Form */
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
                            <div className="relative">
                                <Input
                                    label="Name"
                                    value={formData.name}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setFormData(prev => ({ ...prev, name: val }));
                                        setShowSuggestions(true);

                                        // Auto-fill if exact match typed
                                        const matchedRecord = filteredMasterOptions.find(r => r.name.toLowerCase() === val.toLowerCase());
                                        if (matchedRecord) {
                                            setFormData(prev => ({
                                                ...prev,
                                                name: matchedRecord.name,
                                                specialist: matchedRecord.specialist || prev.specialist,
                                                district: matchedRecord.district || prev.district,
                                                city: matchedRecord.city || prev.city
                                            }));
                                            checkPastVisits(matchedRecord.name);
                                        }
                                    }}
                                    onFocus={() => setShowSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                    disabled={!!editingVisit}
                                    placeholder="Type to search..."
                                    autoComplete="off"
                                    required
                                />
                                {showSuggestions && !editingVisit && formData.name && (
                                    <ul className="absolute z-50 w-full bg-white border border-gray-300 rounded-b-lg shadow-lg max-h-60 overflow-y-auto mt-1 left-0">
                                        {filteredMasterOptions
                                            .filter(r => r.name.toLowerCase().includes(formData.name.toLowerCase()))
                                            .map((record) => (
                                                <li
                                                    key={record.id}
                                                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm border-b last:border-b-0 border-gray-100"
                                                    onMouseDown={() => {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            name: record.name,
                                                            specialist: record.specialist || prev.specialist,
                                                            district: record.district || prev.district,
                                                            city: record.city || prev.city
                                                        }));
                                                        setShowSuggestions(false);
                                                        checkPastVisits(record.name);
                                                    }}
                                                >
                                                    <div className="font-medium text-gray-900">{record.name}</div>
                                                    <div className="text-xs text-gray-500">
                                                        {record.city}{record.district ? `, ${record.district}` : ''}
                                                        {record.specialist ? ` • ${record.specialist}` : ''}
                                                    </div>
                                                </li>
                                            ))}
                                        {filteredMasterOptions.filter(r => r.name.toLowerCase().includes(formData.name.toLowerCase())).length === 0 && (
                                            <li className="px-4 py-2 text-sm text-gray-500 italic">No matches found</li>
                                        )}
                                    </ul>
                                )}
                            </div>
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
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                <select
                                    value={formData.city}
                                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                    disabled={!!editingVisit || !formData.district}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white disabled:bg-gray-100"
                                    required
                                >
                                    <option value="">Select City</option>
                                    {dcrCities.map((city) => (
                                        <option key={city} value={city}>
                                            {city}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="mb-4">
                            <MultiSelect
                                label="Product Shown"
                                options={PRODUCTS}
                                value={formData.productShown ? formData.productShown.split(',').map(p => p.trim()).filter(p => p) : []}
                                onChange={(newVal) => setFormData({ ...formData, productShown: newVal.join(', ') })}
                                disabled={!editingVisit || userRole === 'admin' || (editingVisit && (editingVisit.status === 'Visited' || editingVisit.status === 'Rejected'))}
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
                ) : (
                    /* Bulk Visit Creation Interface */
                    <div className="space-y-4">
                        {/* City Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Select Cities</label>
                            <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                                {(userData?.assignedCities || []).map(city => (
                                    <label key={city} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                                        <input
                                            type="checkbox"
                                            checked={selectedCities.includes(city)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedCities([...selectedCities, city]);
                                                    // Load doctors for this city
                                                    const doctors = masterRecords.filter(r =>
                                                        r.type === 'Doctor' &&
                                                        r.city === city &&
                                                        (userData?.assignedDistricts || []).includes(r.district)
                                                    );
                                                    setCityDoctors(prev => ({ ...prev, [city]: doctors }));
                                                } else {
                                                    setSelectedCities(selectedCities.filter(c => c !== city));
                                                    setCityDoctors(prev => {
                                                        const newDoctors = { ...prev };
                                                        delete newDoctors[city];
                                                        return newDoctors;
                                                    });
                                                }
                                            }}
                                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                        />
                                        <span className="text-sm font-medium text-gray-700">{city}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Doctor Lists by City */}
                        {selectedCities.length > 0 && (
                            <div className="space-y-4 max-h-96 overflow-y-auto">
                                {selectedCities.map(city => {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);

                                    const availableDoctors = (cityDoctors[city] || []).filter(doctor => {
                                        return !visits.some(v =>
                                            v.name === doctor.name &&
                                            v.city === doctor.city &&
                                            v.createdAt &&
                                            new Date(v.createdAt.seconds * 1000).setHours(0, 0, 0, 0) === today.getTime() &&
                                            ['Pending', 'Approved', 'Rejected'].includes(v.status)
                                        );
                                    });

                                    return (
                                        <div key={city} className="border border-gray-200 rounded-lg p-4">
                                            <h4 className="font-semibold text-gray-900 mb-3 underline decoration-indigo-200">{city}</h4>
                                            {availableDoctors.length > 0 ? (
                                                <div className="space-y-2">
                                                    {availableDoctors.map(doctor => (
                                                        <div key={doctor.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 border border-transparent hover:border-indigo-100 transition-all">
                                                            <div className="flex-1">
                                                                <div className="font-medium text-gray-900">{doctor.name}</div>
                                                                <div className="text-xs text-gray-500">{doctor.specialist}</div>
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                onClick={async () => {
                                                                    try {
                                                                        setLoading(true);
                                                                        await addDoc(collection(db, "visits"), {
                                                                            type: 'Doctor',
                                                                            name: doctor.name,
                                                                            specialist: doctor.specialist || '',
                                                                            district: doctor.district,
                                                                            city: doctor.city,
                                                                            productShown: '',
                                                                            status: 'Pending',
                                                                            visited: false,
                                                                            createdBy: currentUser.uid,
                                                                            createdByName: userData.name || currentUser.email,
                                                                            createdAt: serverTimestamp()
                                                                        });
                                                                        alert(`Visit request created for ${doctor.name}`);
                                                                    } catch (error) {
                                                                        console.error("Error creating bulk visit:", error);
                                                                        alert("Error creating visit request");
                                                                    } finally {
                                                                        setLoading(false);
                                                                    }
                                                                }}
                                                                disabled={loading}
                                                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1 ml-2"
                                                            >
                                                                Visit
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-gray-500 italic">No doctors found in this city</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="pt-4 border-t">
                            <Button type="button" variant="secondary" onClick={handleCloseModal} className="w-full">
                                Close
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </DashboardLayout>
    );
}
