import React, { useState, useEffect } from 'react';
import { db } from '../firebase/firebase';
import { collection, onSnapshot, query, where, doc, updateDoc, addDoc, deleteDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ColumnToggle from '../components/ui/ColumnToggle';
import { ODISHA_DISTRICTS } from '../constants/districts';
import { SPECIALISTS } from '../constants/specialists';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

const APPROVALS_COLS_DEF = [
    { id: 'name', label: 'Name' },
    { id: 'email', label: 'Email' },
    { id: 'type', label: 'Type' },
    { id: 'details', label: 'Details' },
    { id: 'actions', label: 'Actions' }
];

// Column Definitions for Employees Table
const EMPLOYEES_COLS_DEF = [
    { id: 'name', label: 'Name' },
    { id: 'email', label: 'Email' },
    { id: 'districts', label: 'Assignments' },
    { id: 'action', label: 'Action' }
];

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        doctors: 0,
        chemists: 0,
        employees: 0,
        totalVisits: 0
    });
    const [employees, setEmployees] = useState([]);
    const [pendingApprovals, setPendingApprovals] = useState([]);
    const [userVisitCounts, setUserVisitCounts] = useState([]);
    const [visitDates, setVisitDates] = useState([]);
    const [trendPeriod, setTrendPeriod] = useState('day'); // day, week, month, year
    const [loading, setLoading] = useState(true);

    // Column Preferences State
    const [approvalsColumns, setApprovalsColumns] = useState(() => {
        const saved = localStorage.getItem('admin_approvals_columns');
        return saved ? JSON.parse(saved) : ['name', 'type', 'actions'];
    });

    const [employeesColumns, setEmployeesColumns] = useState(() => {
        const saved = localStorage.getItem('admin_employees_columns');
        return saved ? JSON.parse(saved) : ['name', 'districts', 'action'];
    });

    // Assignment Modal State
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [tempAssignedDistricts, setTempAssignedDistricts] = useState([]);
    const [tempAssignedCities, setTempAssignedCities] = useState([]);
    const [tempAssignedSpecialities, setTempAssignedSpecialities] = useState([]);
    const [viewingDistrict, setViewingDistrict] = useState('');
    const [availableCities, setAvailableCities] = useState([]);
    const [saving, setSaving] = useState(false);

    // Approval Modal State
    const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
    const [selectedApproval, setSelectedApproval] = useState(null);

    useEffect(() => {
        localStorage.setItem('admin_approvals_columns', JSON.stringify(approvalsColumns));
    }, [approvalsColumns]);

    useEffect(() => {
        localStorage.setItem('admin_employees_columns', JSON.stringify(employeesColumns));
    }, [employeesColumns]);

    useEffect(() => {
        // Subscribe to Master Records to count Doctors and Chemists
        const unsubscribeRecords = onSnapshot(collection(db, "master_records"), (snapshot) => {
            let doctorCount = 0;
            let chemistCount = 0;

            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.type === 'Doctor') doctorCount++;
                if (data.type === 'Chemist') chemistCount++;
            });

            setStats(prev => ({
                ...prev,
                doctors: doctorCount,
                chemists: chemistCount
            }));
        });

        // Subscribe to Users to count Employees (role == 'user') and get list
        const qUsers = query(collection(db, "users"), where("role", "==", "user"));
        const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
            const employeeList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setEmployees(employeeList);
            setStats(prev => ({
                ...prev,
                employees: snapshot.size
            }));
            setLoading(false);
        });

        // Subscribe to Visits to count completed visits
        const qVisits = query(collection(db, "visits"), where("status", "==", "Visited"));
        const unsubscribeVisits = onSnapshot(qVisits, (snapshot) => {

            // Calculate visits per user and store raw dates
            const counts = {};
            const dates = [];

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                // Count per user
                if (data.createdBy) {
                    counts[data.createdBy] = (counts[data.createdBy] || 0) + 1;
                }
                // Store date
                const timestamp = data.visitedAt || data.updatedAt || data.createdAt;
                if (timestamp) {
                    dates.push(timestamp.toDate());
                }
            });

            setStats(prev => ({
                ...prev,
                totalVisits: snapshot.size
            }));
            setUserVisitCounts(counts);
            setVisitDates(dates);
        });

        // Subscribe to Pending Approvals
        const qApprovals = query(collection(db, "pending_approvals"), where("status", "==", "PENDING"));
        const unsubscribeApprovals = onSnapshot(qApprovals, (snapshot) => {
            const approvals = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setPendingApprovals(approvals);
        });

        return () => {
            unsubscribeRecords();
            unsubscribeUsers();
            unsubscribeApprovals();
            unsubscribeVisits();
        };
    }, []);

    // Fetch cities when viewing district changes
    useEffect(() => {
        const fetchCities = async () => {
            if (!viewingDistrict) {
                setAvailableCities([]);
                return;
            }
            try {
                const docRef = doc(db, "district_locations", viewingDistrict);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (Array.isArray(data.cities)) {
                        setAvailableCities(data.cities);
                    } else if (typeof data.cities === 'string') {
                        setAvailableCities(data.cities.split(',').map(c => c.trim()).filter(c => c));
                    } else {
                        setAvailableCities([]);
                    }
                } else {
                    setAvailableCities([]);
                }
            } catch (error) {
                console.error("Error fetching cities:", error);
                setAvailableCities([]);
            }
        };
        fetchCities();
    }, [viewingDistrict]);

    const handleAssignClick = (employee) => {
        setSelectedEmployee(employee);
        setTempAssignedDistricts(employee.assignedDistricts || []);
        setTempAssignedCities(employee.assignedCities || []);
        setTempAssignedSpecialities(employee.assignedSpecialities || []);
        setViewingDistrict(ODISHA_DISTRICTS[0]); // Default to first district
        setIsAssignModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsAssignModalOpen(false);
        setSelectedEmployee(null);
        setTempAssignedDistricts([]);
        setTempAssignedCities([]);
        setTempAssignedSpecialities([]);
        setViewingDistrict('');
        setAvailableCities([]);
    };

    const toggleDistrict = (district) => {
        setTempAssignedDistricts(prev => {
            if (prev.includes(district)) {
                return prev.filter(d => d !== district);
            } else {
                return [...prev, district];
            }
        });
    };

    const toggleCity = (city) => {
        setTempAssignedCities(prev => {
            if (prev.includes(city)) {
                return prev.filter(c => c !== city);
            } else {
                return [...prev, city];
            }
        });
    };

    const toggleSpeciality = (spec) => {
        setTempAssignedSpecialities(prev => {
            if (prev.includes(spec)) {
                return prev.filter(s => s !== spec);
            } else {
                return [...prev, spec];
            }
        });
    };

    const handleSaveAssignment = async () => {
        if (!selectedEmployee) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, "users", selectedEmployee.id), {
                assignedDistricts: tempAssignedDistricts,
                assignedCities: tempAssignedCities,
                assignedSpecialities: tempAssignedSpecialities
            });
            handleCloseModal();
        } catch (error) {
            console.error("Error updating assignment:", error);
            alert("Failed to update assignment.");
        } finally {
            setSaving(false);
        }
    };

    const handleViewApproval = (request) => {
        setSelectedApproval(request);
        setIsApprovalModalOpen(true);
    };

    const handleCloseApprovalModal = () => {
        setIsApprovalModalOpen(false);
        setSelectedApproval(null);
    };

    const handleApprove = async (request) => {
        if (!window.confirm("Are you sure you want to approve this request?")) return;
        try {
            // Execute the requested operation
            if (request.type === 'ADD') {
                await addDoc(collection(db, "master_records"), {
                    ...request.data,
                    createdAt: serverTimestamp(),
                    createdByRole: 'user', // Preserving original intent
                    approvedBy: 'admin',
                    approvedAt: serverTimestamp()
                });
            } else if (request.type === 'UPDATE') {
                await updateDoc(doc(db, "master_records", request.recordId), {
                    ...request.data,
                    updatedAt: serverTimestamp(),
                    updatedByRole: 'user',
                    approvedBy: 'admin',
                    approvedAt: serverTimestamp()
                });
            } else if (request.type === 'DELETE') {
                await deleteDoc(doc(db, "master_records", request.recordId));
            }

            // Update approval status
            await updateDoc(doc(db, "pending_approvals", request.id), {
                status: 'APPROVED',
                processedAt: serverTimestamp()
            });
            handleCloseApprovalModal();
        } catch (error) {
            console.error("Error approving request:", error);
            alert("Failed to approve request.");
        }
    };

    const handleReject = async (request) => {
        if (!window.confirm("Are you sure you want to reject this request?")) return;
        try {
            await updateDoc(doc(db, "pending_approvals", request.id), {
                status: 'REJECTED',
                processedAt: serverTimestamp()
            });
            handleCloseApprovalModal();
        } catch (error) {
            console.error("Error rejecting request:", error);
            alert("Failed to reject request.");
        }
    };

    // Helper for Chart Data Aggregation
    const getTrendData = (dates, period) => {
        if (!dates.length) return [];

        const now = new Date();
        const map = new Map();

        // Helper to format date keys
        const formatDate = (date) => {
            if (period === 'day') return date.toISOString().split('T')[0];
            if (period === 'week') {
                const d = new Date(date);
                d.setHours(0, 0, 0, 0);
                d.setDate(d.getDate() - d.getDay() + 1); // Monday
                return d.toISOString().split('T')[0];
            }
            if (period === 'month') return date.toISOString().slice(0, 7); // YYYY-MM
            if (period === 'year') return date.getFullYear().toString();
            return date.toISOString().split('T')[0];
        };

        const formatLabel = (key) => {
            const date = new Date(key);
            if (period === 'day') return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (period === 'week') return `Wk ${getWeekNumber(date)}`;
            if (period === 'month') return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            if (period === 'year') return key;
            return key;
        };

        const getWeekNumber = (d) => {
            d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
            d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
            var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
            return weekNo;
        }

        // Filter and Fill Data
        // For simplicity, we just aggregate what we have. 
        // Filling gaps (0 visits) would be ideal but logic heavy for this snippet.

        // Sort dates asc
        const sortedDates = [...dates].sort((a, b) => a - b);

        sortedDates.forEach(date => {
            const key = formatDate(date);
            map.set(key, (map.get(key) || 0) + 1);
        });

        // Convert Map to Array
        return Array.from(map.entries()).map(([key, value]) => ({
            name: formatLabel(key),
            visits: value
        }));
    };

    return (
        <DashboardLayout
            title="Admin Dashboard"
            backgroundClass="bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100"
        >
            {/* Analytics Cards */}
            <div className="grid gap-4 md:grid-cols-4 mb-6">
                <Card className="p-4 border-l-4 border-indigo-500 bg-white/60 backdrop-blur-lg shadow-lg border-white/50">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-gray-500 text-xs font-medium uppercase tracking-wider">Total Doctors</h3>
                            <p className="text-2xl font-bold text-gray-900 mt-1">
                                {loading ? '...' : stats.doctors}
                            </p>
                        </div>
                        <div className="p-2 bg-indigo-50 rounded-full">
                            <span className="text-xl">👨‍⚕️</span>
                        </div>
                    </div>
                </Card>

                <Card className="p-4 border-l-4 border-green-500 bg-white/60 backdrop-blur-lg shadow-lg border-white/50">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-gray-500 text-xs font-medium uppercase tracking-wider">Total Chemists</h3>
                            <p className="text-2xl font-bold text-gray-900 mt-1">
                                {loading ? '...' : stats.chemists}
                            </p>
                        </div>
                        <div className="p-2 bg-green-50 rounded-full">
                            <span className="text-xl">💊</span>
                        </div>
                    </div>
                </Card>

                <Card className="p-4 border-l-4 border-orange-500 bg-white/60 backdrop-blur-lg shadow-lg border-white/50">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-gray-500 text-xs font-medium uppercase tracking-wider">Total Employees</h3>
                            <p className="text-2xl font-bold text-gray-900 mt-1">
                                {loading ? '...' : stats.employees}
                            </p>
                        </div>
                        <div className="p-2 bg-orange-50 rounded-full">
                            <span className="text-xl">👥</span>
                        </div>
                    </div>
                </Card>

                <Card className="p-4 border-l-4 border-blue-500 bg-white/60 backdrop-blur-lg shadow-lg border-white/50">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-gray-500 text-xs font-medium uppercase tracking-wider">Total Visits</h3>
                            <p className="text-2xl font-bold text-gray-900 mt-1">
                                {loading ? '...' : stats.totalVisits}
                            </p>
                        </div>
                        <div className="p-2 bg-blue-50 rounded-full">
                            <span className="text-xl">✅</span>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Visit Trends Chart */}
            <Card className="p-6 mb-8 bg-white/60 backdrop-blur-lg shadow-lg border-white/50 border-l-4 border-indigo-500">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Visit Trends</h3>
                        <p className="text-sm text-gray-500">Visualizing completed visits over time.</p>
                    </div>
                    <div className="flex space-x-2 mt-4 sm:mt-0">
                        {['day', 'week', 'month', 'year'].map((period) => (
                            <button
                                key={period}
                                onClick={() => setTrendPeriod(period)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${trendPeriod === period
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                                    }`}
                            >
                                {period.charAt(0).toUpperCase() + period.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={getTrendData(visitDates, trendPeriod)}>
                            <defs>
                                <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#6b7280', fontSize: 12 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#6b7280', fontSize: 12 }}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', border: 'none' }}
                                itemStyle={{ color: '#4f46e5' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="visits"
                                stroke="#6366f1"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorVisits)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Visits by User Widget */}
            {userVisitCounts && Object.keys(userVisitCounts).length > 0 && (
                <Card className="p-0 overflow-hidden flex flex-col mb-8 border-l-4 border-blue-500 bg-white/60 backdrop-blur-lg shadow-lg border-white/50">
                    <div className="p-6 border-b border-gray-100/50 flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-gray-900">Visits by User</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50/50 text-gray-500 uppercase">
                                <tr>
                                    <th className="px-6 py-3 font-medium">Employee Name</th>
                                    <th className="px-6 py-3 font-medium">Email</th>
                                    <th className="px-6 py-3 font-medium text-right">Completed Visits</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {Object.entries(userVisitCounts)
                                    .map(([uid, count]) => {
                                        const employee = employees.find(e => e.id === uid);
                                        return {
                                            id: uid,
                                            name: employee?.name || 'Unknown User',
                                            email: employee?.email || '-',
                                            count: count
                                        };
                                    })
                                    .sort((a, b) => b.count - a.count)
                                    .map((user) => (
                                        <tr key={user.id} className="hover:bg-white/40">
                                            <td className="px-6 py-4 font-medium text-gray-900">{user.name}</td>
                                            <td className="px-6 py-4 text-gray-500">{user.email}</td>
                                            <td className="px-6 py-4 text-right font-bold text-blue-600">{user.count}</td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* Pending Approvals Section */}
            {pendingApprovals.length > 0 && (
                <Card className="p-0 overflow-hidden flex flex-col mb-8 border-l-4 border-yellow-400 bg-white/60 backdrop-blur-lg shadow-lg border-white/50">
                    <div className="p-6 border-b border-gray-100/50 bg-yellow-50/50 flex justify-between items-start">
                        <div>
                            <h3 className="text-lg font-semibold text-yellow-800">⚠️ Pending Approvals ({pendingApprovals.length})</h3>
                            <p className="text-sm text-yellow-700">Review and approve changes made by employees.</p>
                        </div>
                        <ColumnToggle
                            columns={APPROVALS_COLS_DEF}
                            visibleColumns={approvalsColumns}
                            onChange={setApprovalsColumns}
                        />
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white/50 text-gray-500 uppercase border-b border-gray-100/50">
                                <tr>
                                    {approvalsColumns.includes('name') && <th className="px-6 py-3 font-medium">Name</th>}
                                    {approvalsColumns.includes('email') && <th className="px-6 py-3 font-medium">Email</th>}
                                    {approvalsColumns.includes('type') && <th className="px-6 py-3 font-medium">Type</th>}
                                    {approvalsColumns.includes('details') && <th className="px-6 py-3 font-medium">Details</th>}
                                    {approvalsColumns.includes('actions') && <th className="px-6 py-3 font-medium text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {pendingApprovals.map((request) => {
                                    // Try to find the user in the employees list to get the most up-to-date info
                                    const requester = employees.find(e => e.id === request.requestedBy);
                                    const displayName = requester?.name || request.requestedByName || 'Unknown';
                                    const displayEmail = requester?.email || request.requestedByEmail || '-';

                                    return (
                                        <tr key={request.id} className="hover:bg-white/40 transition-colors">
                                            {approvalsColumns.includes('name') && (
                                                <td className="px-6 py-4 font-medium text-gray-900">
                                                    {displayName}
                                                </td>
                                            )}
                                            {approvalsColumns.includes('email') && (
                                                <td className="px-6 py-4 text-gray-500">
                                                    {displayEmail}
                                                </td>
                                            )}
                                            {approvalsColumns.includes('type') && (
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${request.type === 'ADD' ? 'bg-green-100 text-green-800' :
                                                        request.type === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-red-100 text-red-800'
                                                        }`}>
                                                        {request.type}
                                                    </span>
                                                </td>
                                            )}
                                            {approvalsColumns.includes('details') && (
                                                <td className="px-6 py-4 text-gray-600">
                                                    {request.type === 'DELETE' ? (
                                                        <span>Delete Record ID: {request.recordId}</span>
                                                    ) : (
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{request.data.name}</span>
                                                            <span className="text-xs">{request.data.district}</span>
                                                        </div>
                                                    )}
                                                </td>
                                            )}
                                            {approvalsColumns.includes('actions') && (
                                                <td className="px-6 py-4 text-right space-x-2">
                                                    <Button size="sm" variant="secondary" onClick={() => handleViewApproval(request)}>
                                                        View Details
                                                    </Button>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* Employee Engagement Table */}
            <Card className="p-0 overflow-hidden flex flex-col min-h-[400px] bg-white/60 backdrop-blur-lg shadow-lg border-white/50">
                <div className="p-6 border-b border-gray-100/50 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Employee Engagement</h3>
                        <p className="text-sm text-gray-500">Manage district assignments for employees.</p>
                    </div>
                    <ColumnToggle
                        columns={EMPLOYEES_COLS_DEF}
                        visibleColumns={employeesColumns}
                        onChange={setEmployeesColumns}
                    />
                </div>

                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50/50 text-gray-500 uppercase">
                            <tr>
                                {employeesColumns.includes('name') && <th className="px-6 py-3 font-medium">Name</th>}
                                {employeesColumns.includes('email') && <th className="px-6 py-3 font-medium">Email</th>}
                                {employeesColumns.includes('districts') && <th className="px-6 py-3 font-medium">Assignments</th>}
                                {employeesColumns.includes('action') && <th className="px-6 py-3 font-medium text-right">Action</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {employees.map((employee) => (
                                <tr key={employee.id} className="hover:bg-white/40 transition-colors">
                                    {employeesColumns.includes('name') && <td className="px-6 py-4 font-medium text-gray-900">{employee.name || 'N/A'}</td>}
                                    {employeesColumns.includes('email') && <td className="px-6 py-4 text-gray-500">{employee.email}</td>}
                                    {employeesColumns.includes('districts') && (
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                {employee.assignedDistricts?.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        <span className="text-xs font-semibold text-gray-500 mr-1">Districts:</span>
                                                        {employee.assignedDistricts.map((dist, idx) => (
                                                            <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                                                {dist}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {employee.assignedCities?.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        <span className="text-xs font-semibold text-gray-500 mr-1">Cities:</span>
                                                        {employee.assignedCities.map((city, idx) => (
                                                            <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                                {city}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {(!employee.assignedDistricts?.length && !employee.assignedCities?.length && !employee.assignedSpecialities?.length) && (
                                                    <span className="text-gray-400 italic text-xs">No assignments</span>
                                                )}
                                                {employee.assignedSpecialities?.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        <span className="text-xs font-semibold text-gray-500 mr-1">Specs:</span>
                                                        {employee.assignedSpecialities.map((spec, idx) => (
                                                            <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                                                                {spec}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                    {employeesColumns.includes('action') && (
                                        <td className="px-6 py-4 text-right">
                                            <Button size="sm" variant="secondary" onClick={() => handleAssignClick(employee)}>
                                                Assign
                                            </Button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {employees.length === 0 && !loading && (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                                        No employees found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Assignment Modal */}
            <Modal
                isOpen={isAssignModalOpen}
                onClose={handleCloseModal}
                title={`Assign Districts to ${selectedEmployee?.name || 'Employee'}`}
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-500">Select the districts this employee is responsible for:</p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Select District to Configure</label>
                            <select
                                value={viewingDistrict}
                                onChange={(e) => setViewingDistrict(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                {ODISHA_DISTRICTS.map((district) => (
                                    <option key={district} value={district}>
                                        {district} {tempAssignedDistricts.includes(district) ? '(Assigned)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {viewingDistrict && (
                            <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 flex flex-col gap-4">
                                {/* District Assignment Toggle */}
                                <div className="flex items-center space-x-2 border-b border-gray-200 pb-3">
                                    <input
                                        type="checkbox"
                                        id={`dist-check-${viewingDistrict}`}
                                        checked={tempAssignedDistricts.includes(viewingDistrict)}
                                        onChange={() => toggleDistrict(viewingDistrict)}
                                        className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <label htmlFor={`dist-check-${viewingDistrict}`} className="text-base font-semibold text-gray-900 cursor-pointer select-none">
                                        Assign District: {viewingDistrict}
                                    </label>
                                </div>

                                {/* Cities Assignment */}
                                <div>
                                    <h5 className="text-sm font-medium text-gray-700 mb-2">Assign Specific Cities</h5>
                                    {availableCities.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-2 max-h-[150px] overflow-y-auto">
                                            {availableCities.map((city) => (
                                                <label key={city} className="flex items-center space-x-2 p-1 hover:bg-gray-100 rounded cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={tempAssignedCities.includes(city)}
                                                        onChange={() => toggleCity(city)}
                                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-sm text-gray-600">{city}</span>
                                                </label>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-400 italic">No cities found for this district.</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Summary of Assignments */}
                        <div className="text-xs text-gray-500 border-t pt-2">
                            Summary: {tempAssignedDistricts.length} Districts, {tempAssignedCities.length} Cities assigned.
                        </div>
                    </div>

                    {/* Specialities Assignment */}
                    <div className="border-t border-gray-200 pt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Assign Specialities</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border border-gray-200 rounded-lg p-3 max-h-[150px] overflow-y-auto">
                            {SPECIALISTS.map((spec) => (
                                <label key={spec} className="flex items-center space-x-2 p-1 hover:bg-gray-50 rounded cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={tempAssignedSpecialities.includes(spec)}
                                        onChange={() => toggleSpeciality(spec)}
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm text-gray-700">{spec}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <Button type="button" variant="secondary" onClick={handleCloseModal} className="flex-1">
                            Cancel
                        </Button>
                        <Button onClick={handleSaveAssignment} disabled={saving} className="flex-1">
                            {saving ? 'Saving...' : 'Save Assignments'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Approval Details Modal */}
            <Modal
                isOpen={isApprovalModalOpen}
                onClose={handleCloseApprovalModal}
                title="Review Approval Request"
            >
                {selectedApproval && (
                    <div className="space-y-4">
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="block text-gray-500">Requested By</span>
                                    <span className="font-medium text-gray-900">{selectedApproval.requestedByName}</span>
                                </div>
                                <div>
                                    <span className="block text-gray-500">Request Type</span>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${selectedApproval.type === 'ADD' ? 'bg-green-100 text-green-800' :
                                        selectedApproval.type === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                                            'bg-red-100 text-red-800'
                                        }`}>
                                        {selectedApproval.type}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-gray-500">Date</span>
                                    <span className="font-medium text-gray-900">
                                        {selectedApproval.createdAt?.toDate().toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 pt-4">
                            <h4 className="text-sm font-medium text-gray-900 mb-3">Record Details</h4>
                            {selectedApproval.type === 'DELETE' ? (
                                <p className="text-red-600 text-sm">
                                    Request to delete record ID: <span className="font-mono">{selectedApproval.recordId}</span>
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-gray-500">Type</label>
                                            <div className="text-sm font-medium">{selectedApproval.data.type}</div>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500">Name</label>
                                            <div className="text-sm font-medium">{selectedApproval.data.name}</div>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500">District</label>
                                            <div className="text-sm font-medium">{selectedApproval.data.district}</div>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500">City</label>
                                            <div className="text-sm font-medium">{selectedApproval.data.city}</div>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500">Visited</label>
                                            <div className="text-sm font-medium">{selectedApproval.data.visited ? 'Yes' : 'No'}</div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500">Products Shown</label>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {selectedApproval.data.productShown ? (
                                                selectedApproval.data.productShown.split(',').map((p, i) => (
                                                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                        {p.trim()}
                                                    </span>
                                                ))
                                            ) : '-'}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="pt-4 flex gap-3 border-t border-gray-100 mt-4">
                            <Button
                                onClick={() => handleReject(selectedApproval)}
                                variant="secondary"
                                className="flex-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                                Reject Request
                            </Button>
                            <Button
                                onClick={() => handleApprove(selectedApproval)}
                                className="flex-1 bg-green-600 hover:bg-green-700"
                            >
                                Approve Request
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </DashboardLayout>
    );
}
