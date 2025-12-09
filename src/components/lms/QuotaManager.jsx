import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import Card from '../ui/Card';
import Button from '../ui/Button';

const LEAVE_TYPES = [
    { value: 'sick', label: 'Sick Leave' },
    { value: 'casual', label: 'Casual Leave' },
    { value: 'earned', label: 'Earned Leave' },
];

export default function QuotaManager() {
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [quotas, setQuotas] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'users'));
            const usersData = querySnapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                .filter(user => user.role === 'user'); // Filter out admins and super_admins
            setUsers(usersData);
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleUserSelect = (userId) => {
        const user = users.find(u => u.id === userId);
        setSelectedUser(user);
        setQuotas(user.leaveQuota || { sick: 0, casual: 0, earned: 0 });
    };

    const handleQuotaChange = (type, value) => {
        setQuotas(prev => ({
            ...prev,
            [type]: parseInt(value) || 0
        }));
    };

    const handleSave = async () => {
        if (!selectedUser) return;
        setSaving(true);
        try {
            const userRef = doc(db, 'users', selectedUser.id);
            await updateDoc(userRef, {
                leaveQuota: quotas
            });

            // Update local state
            setUsers(users.map(u =>
                u.id === selectedUser.id ? { ...u, leaveQuota: quotas } : u
            ));

            alert("Quotas updated successfully!");
        } catch (error) {
            console.error("Error updating quotas:", error);
            alert("Failed to update quotas.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div>Loading users...</div>;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* User List */}
            <div className="md:col-span-1 space-y-2">
                <Card className="h-full">
                    <h3 className="font-medium text-gray-900 mb-4">Select User</h3>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                        {users.map(user => (
                            <button
                                key={user.id}
                                onClick={() => handleUserSelect(user.id)}
                                className={`w-full text-left p-3 rounded-lg transition-colors ${selectedUser?.id === user.id
                                    ? 'bg-indigo-50 border border-indigo-200'
                                    : 'hover:bg-gray-50 border border-transparent'
                                    }`}
                            >
                                <div className="font-medium text-gray-900">{user.name || 'No Name'}</div>
                                <div className="text-xs text-gray-500">{user.email}</div>
                                <div className="text-xs text-gray-400 mt-1 capitalize">{user.role}</div>
                            </button>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Quota Editor */}
            <div className="md:col-span-2">
                {selectedUser ? (
                    <Card>
                        <div className="p-4 sm:p-6">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Manage Quotas</h3>
                                    <p className="text-sm text-gray-500">
                                        For {selectedUser.name || selectedUser.email}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                                {LEAVE_TYPES.map(type => (
                                    <div key={type.value}>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {type.label}
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={quotas[type.value] || 0}
                                            onChange={(e) => handleQuotaChange(type.value, e.target.value)}
                                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-end border-t border-gray-100 pt-4">
                                <Button onClick={handleSave} loading={saving}>
                                    Save Changes
                                </Button>
                            </div>
                        </div>
                    </Card>
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-8">
                        Select a user to manage their leave quotas
                    </div>
                )}
            </div>
        </div>
    );
}
