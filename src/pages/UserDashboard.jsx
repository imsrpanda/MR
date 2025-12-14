import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import MultiSelect from '../components/ui/MultiSelect';
import { PRODUCTS } from '../constants/products';

export default function UserDashboard() {
    const { currentUser } = useAuth();
    const [pendingApprovals, setPendingApprovals] = useState([]);
    const [myTasks, setMyTasks] = useState([]);
    const [visitedCount, setVisitedCount] = useState(0);
    const [topVisited, setTopVisited] = useState([]);
    const [loading, setLoading] = useState(true);

    // Task Completion State
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [taskFormData, setTaskFormData] = useState({ productShown: '', comment: '' });
    const [taskLoading, setTaskLoading] = useState(false);

    useEffect(() => {
        if (!currentUser) return;

        // Fetch Pending Approvals
        const qApprovals = query(
            collection(db, "pending_approvals"),
            where("requestedBy", "==", currentUser.uid)
        );

        const unsubApprovals = onSnapshot(qApprovals, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Client-side sort to avoid index requirements
            data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setPendingApprovals(data);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching pending approvals:", error);
            setLoading(false);
            if (error.code === 'failed-precondition') {
                console.warn("Missing Index for Pending Approvals. Check Firebase Console.");
            }
        });

        // Fetch My Tasks (Approved Visits)
        const qTasks = query(
            collection(db, "visits"),
            where("createdBy", "==", currentUser.uid),
            where("status", "==", "Approved")
        );

        const unsubTasks = onSnapshot(qTasks, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Client-side sort to avoid index requirements
            data.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
            setMyTasks(data);
        }, (error) => {
            console.error("Error fetching tasks:", error);
            if (error.code === 'failed-precondition') {
                console.warn("Missing Index for My Tasks (Visits). Check Firebase Console.");
            }
        });

        // Fetch Visited Count
        const qVisited = query(
            collection(db, "visits"),
            where("createdBy", "==", currentUser.uid),
            where("status", "==", "Visited")
        );

        const unsubVisited = onSnapshot(qVisited, (snapshot) => {
            setVisitedCount(snapshot.size);

            // Calculate Top 10 Visited
            const visitCounts = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const key = `${data.name}|${data.type}|${data.city}`; // Create unique key
                if (!visitCounts[key]) {
                    visitCounts[key] = {
                        name: data.name,
                        type: data.type,
                        city: data.city,
                        count: 0
                    };
                }
                visitCounts[key].count++;
            });

            const sortedVisits = Object.values(visitCounts)
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);

            setTopVisited(sortedVisits);
        }, (error) => {
            console.error("Error fetching visited count:", error);
        });


        return () => {
            unsubApprovals();
            unsubTasks();
            unsubVisited();
        };
    }, [currentUser]);

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

    const handleOpenTaskModal = (task) => {
        setSelectedTask(task);
        setTaskFormData({ productShown: '', comment: '' });
        setIsTaskModalOpen(true);
    };

    const handleCloseTaskModal = () => {
        setIsTaskModalOpen(false);
        setSelectedTask(null);
        setTaskFormData({ productShown: '', comment: '' });
    };

    const handleCompleteTask = async (e) => {
        e.preventDefault();
        setTaskLoading(true);
        try {
            let location = null;
            try {
                location = await getLocation();
            } catch (err) {
                console.warn("Location capture failed:", err);
            }

            await updateDoc(doc(db, "visits", selectedTask.id), {
                status: 'Visited',
                visited: true,
                productShown: taskFormData.productShown,
                comment: taskFormData.comment,
                location: location,
                visitedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                updatedBy: currentUser.uid
            });

            handleCloseTaskModal();
            // Optional: Success toast could go here
        } catch (error) {
            console.error("Error completing task:", error);
            alert("Error completing task: " + error.message);
        } finally {
            setTaskLoading(false);
        }
    };

    return (
        <DashboardLayout
            title="My Dashboard"
            backgroundClass="bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100"
        >
            <div className="space-y-6">
                {/* Stats Overview */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
                    <Card className="p-6 bg-white/60 backdrop-blur-lg shadow-lg border-white/50 border-l-4 border-blue-500">
                        <h3 className="text-lg font-semibold text-blue-900">Visited</h3>
                        <p className="text-3xl font-bold text-blue-600 mt-2">
                            {visitedCount}
                        </p>
                    </Card>
                </div>

                {/* My Tasks Section */}
                {myTasks.length > 0 && (
                    <Card className="overflow-hidden bg-white shadow-lg border-l-4 border-indigo-500">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">My Pending Tasks</h3>
                                <p className="text-sm text-gray-500">You have {myTasks.length} approved visits to complete.</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500 uppercase">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Date</th>
                                        <th className="px-6 py-3 font-medium">Doctor/Chemist</th>
                                        <th className="px-6 py-3 font-medium">Location</th>
                                        <th className="px-6 py-3 font-medium text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {myTasks.map((task) => (
                                        <tr key={task.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 text-gray-600">
                                                {task.createdAt?.seconds ? new Date(task.createdAt.seconds * 1000).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                <div className="flex flex-col">
                                                    <span>{task.name}</span>
                                                    <span className="text-xs text-gray-500">{task.type} {task.specialist ? `• ${task.specialist}` : ''}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">
                                                {task.city}, {task.district}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Button onClick={() => handleOpenTaskModal(task)} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md">
                                                    Complete Visit
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}

                {/* Top 10 Visited Section */}
                {topVisited.length > 0 && (
                    <Card className="overflow-hidden bg-white shadow-lg border-l-4 border-blue-500">
                        <div className="p-6 border-b border-gray-100">
                            <h3 className="text-xl font-bold text-gray-900">Top 10 Most Visited</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500 uppercase">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Rank</th>
                                        <th className="px-6 py-3 font-medium">Name</th>
                                        <th className="px-6 py-3 font-medium">Type</th>
                                        <th className="px-6 py-3 font-medium">City</th>
                                        <th className="px-6 py-3 font-medium text-right">Visits</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {topVisited.map((item, index) => (
                                        <tr key={index} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 text-gray-500">#{index + 1}</td>
                                            <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
                                            <td className="px-6 py-4 text-gray-600">{item.type}</td>
                                            <td className="px-6 py-4 text-gray-600">{item.city}</td>
                                            <td className="px-6 py-4 text-right font-bold text-blue-600">{item.count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}

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
            {/* Task Completion Modal */}
            <Modal
                isOpen={isTaskModalOpen}
                onClose={handleCloseTaskModal}
                title={`Complete Visit: ${selectedTask?.name}`}
            >
                <form onSubmit={handleCompleteTask} className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 border border-blue-100">
                        <p className="font-semibold">Visit Details:</p>
                        <p>Type: {selectedTask?.type}</p>
                        <p>Location: {selectedTask?.city}, {selectedTask?.district}</p>
                    </div>

                    <div>
                        <MultiSelect
                            label="Products Shown"
                            options={PRODUCTS}
                            value={taskFormData.productShown ? taskFormData.productShown.split(',').map(p => p.trim()).filter(p => p) : []}
                            onChange={(newVal) => setTaskFormData({ ...taskFormData, productShown: newVal.join(', ') })}
                            placeholder="Select products..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Visit Comment</label>
                        <textarea
                            value={taskFormData.comment}
                            onChange={(e) => setTaskFormData({ ...taskFormData, comment: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            rows="3"
                            placeholder="Enter details about the visit..."
                            required
                        />
                    </div>

                    <div className="text-xs text-gray-500 italic">
                        * We will attempt to capture your current location.
                    </div>

                    <div className="pt-4 flex gap-3">
                        <Button type="button" variant="secondary" onClick={handleCloseTaskModal} className="flex-1">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={taskLoading} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                            {taskLoading ? 'Completing...' : 'Mark as Visited'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
