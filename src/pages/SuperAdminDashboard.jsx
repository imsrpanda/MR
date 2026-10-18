import React, { useState, useEffect } from 'react';
import { db, firebaseConfig } from '../firebase/firebase';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { doc, setDoc, collection, onSnapshot, query, updateDoc } from 'firebase/firestore';
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import { useAuth } from '../contexts/AuthContext';

export default function SuperAdminDashboard() {
    const { currentUser } = useAuth();

    // Create User State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('user');
    const [message, setMessage] = useState({ type: '', text: '' });
    const [loading, setLoading] = useState(false);

    // Data State
    const [users, setUsers] = useState([]);

    // Edit User State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [editName, setEditName] = useState('');
    const [editRole, setEditRole] = useState('user');
    const [editIsActive, setEditIsActive] = useState(true);
    const [updating, setUpdating] = useState(false);

    // Fetch users in real-time
    useEffect(() => {
        const q = query(collection(db, "users"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const usersData = [];
            querySnapshot.forEach((doc) => {
                usersData.push({ id: doc.id, ...doc.data() });
            });
            setUsers(usersData);
        });

        return () => unsubscribe();
    }, []);

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });
        setLoading(true);

        let secondaryApp = null;

        try {
            secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
            const secondaryAuth = getAuth(secondaryApp);

            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            const newUser = userCredential.user;

            await setDoc(doc(db, "users", newUser.uid), {
                name: name,
                email: newUser.email,
                role: role,
                isActive: true,
                createdAt: new Date().toISOString()
            });

            await sendPasswordResetEmail(secondaryAuth, email);
            await signOut(secondaryAuth);

            setMessage({ type: 'success', text: `User ${email} created as ${role}. Invitation sent.` });
            setName('');
            setEmail('');
            setPassword('');
            setRole('user');

        } catch (error) {
            console.error("Error creating user:", error);
            setMessage({ type: 'error', text: error.message });
        } finally {
            if (secondaryApp) {
                await deleteApp(secondaryApp);
            }
            setLoading(false);
        }
    };

    const handleEditClick = (user) => {
        setEditingUser(user);
        setEditName(user.name || '');
        setEditRole(user.role || 'user');
        setEditIsActive(user.isActive !== false);
        setIsEditModalOpen(true);
    };

    const handleCloseEditModal = () => {
        setIsEditModalOpen(false);
        setEditingUser(null);
        setEditName('');
        setEditRole('user');
        setEditIsActive(true);
    };

    const handleToggleStatus = async (user) => {
        if (user.id === currentUser?.uid) {
            alert("You cannot deactivate your own Super Admin account.");
            return;
        }

        const willDeactivate = user.isActive !== false;
        const confirmMsg = willDeactivate
            ? `Are you sure you want to deactivate ${user.name || user.email}?\n\n• The user will be immediately logged out and unable to log in.\n• All existing data, visits, and records created by this user will remain preserved.`
            : `Are you sure you want to reactivate ${user.name || user.email}? They will be able to log in again.`;

        if (!window.confirm(confirmMsg)) return;

        try {
            await updateDoc(doc(db, "users", user.id), {
                isActive: !willDeactivate,
                statusUpdatedAt: new Date().toISOString()
            });
        } catch (err) {
            console.error("Error updating user status:", err);
            alert("Failed to update user status.");
        }
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        if (!editingUser) return;
        setUpdating(true);

        try {
            await updateDoc(doc(db, "users", editingUser.id), {
                name: editName,
                role: editRole,
                isActive: editIsActive
            });
            handleCloseEditModal();
        } catch (error) {
            console.error("Error updating user:", error);
            alert("Failed to update user.");
        } finally {
            setUpdating(false);
        }
    };

    return (
        <DashboardLayout title="User Management">
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Create User Form - 1 Column */}
                <Card className="p-6 lg:col-span-1 h-fit">
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-900">Onboard New User</h3>
                        <p className="text-sm text-gray-500">Create a new account and assign a role.</p>
                    </div>

                    <form onSubmit={handleCreateUser} className="space-y-4">
                        <Input
                            label="Full Name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Jane Doe"
                            required
                        />

                        <Input
                            label="Email Address"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />

                        <Input
                            label="Temporary Password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                            >
                                <option value="admin">Admin</option>
                                <option value="user">User</option>
                            </select>
                        </div>

                        {message.text && (
                            <div className={`p-3 rounded-lg text-sm ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                {message.text}
                            </div>
                        )}

                        <div className="pt-2">
                            <Button type="submit" disabled={loading} className="w-full">
                                {loading ? 'Creating User...' : 'Create User & Send Invitation'}
                            </Button>
                        </div>
                    </form>
                </Card>

                {/* User List - 2 Columns */}
                <Card className="p-0 lg:col-span-2 overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900">Registered Users</h3>
                        <p className="text-sm text-gray-500">List of all users in the system.</p>
                    </div>

                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 uppercase">
                                <tr>
                                    <th className="px-6 py-3 font-medium">Name</th>
                                    <th className="px-6 py-3 font-medium">Email</th>
                                    <th className="px-6 py-3 font-medium">Role</th>
                                    <th className="px-6 py-3 font-medium">Status</th>
                                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {users.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                            No users found.
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((user) => (
                                        <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-900">{user.name || 'N/A'}</td>
                                            <td className="px-6 py-4 text-gray-500">{user.email}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.role === 'super_admin' ? 'bg-purple-100 text-purple-800' :
                                                    user.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {user.role?.replace('_', ' ').toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {user.isActive === false ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                                        Deactivated
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                        Active
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button size="sm" variant="secondary" onClick={() => handleEditClick(user)}>
                                                        Edit
                                                    </Button>
                                                    {user.isActive === false ? (
                                                        <Button
                                                            size="sm"
                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                                                            onClick={() => handleToggleStatus(user)}
                                                        >
                                                            Activate
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            className="text-red-600 hover:bg-red-50 border-red-200 hover:border-red-300 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                                                            onClick={() => handleToggleStatus(user)}
                                                            disabled={user.id === currentUser?.uid}
                                                            title={user.id === currentUser?.uid ? "You cannot deactivate your own account" : "Deactivate user"}
                                                        >
                                                            Deactivate
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            {/* Edit User Modal */}
            <Modal
                isOpen={isEditModalOpen}
                onClose={handleCloseEditModal}
                title="Edit User Details"
            >
                <form onSubmit={handleUpdateUser} className="space-y-4">
                    <Input
                        label="Full Name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="e.g. Jane Doe"
                        required
                    />

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                        <input
                            type="email"
                            value={editingUser?.email || ''}
                            disabled
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-400 mt-1">Email cannot be changed.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                        >
                            <option value="admin">Admin</option>
                            <option value="user">User</option>
                            {/* Prevent accidentally setting super_admin unless already one, logic can be refined if needed */}
                            {editingUser?.role === 'super_admin' && <option value="super_admin">Super Admin</option>}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Account Status</label>
                        <select
                            value={editIsActive ? 'active' : 'inactive'}
                            onChange={(e) => setEditIsActive(e.target.value === 'active')}
                            disabled={editingUser?.id === currentUser?.uid}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                            <option value="active">Active (Can log in)</option>
                            <option value="inactive">Deactivated (Blocked from login)</option>
                        </select>
                        {editingUser?.id === currentUser?.uid ? (
                            <p className="text-xs text-amber-600 mt-1">You cannot deactivate your own Super Admin account.</p>
                        ) : (
                            <p className="text-xs text-gray-400 mt-1">Deactivated users cannot log in, but all their records and data remain preserved.</p>
                        )}
                    </div>

                    <div className="pt-4 flex gap-3">
                        <Button type="button" variant="secondary" onClick={handleCloseEditModal} className="flex-1">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={updating} className="flex-1">
                            {updating ? 'Updating...' : 'Save Changes'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
