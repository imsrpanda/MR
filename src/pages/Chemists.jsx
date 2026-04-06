import React, { useState, useEffect } from 'react';
import { db } from '../firebase/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where } from 'firebase/firestore';
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { PRODUCT_NAMES } from '../constants/products';

export default function Chemists() {
    const { userRole, userData, currentUser } = useAuth();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);

    const initialFormState = {
        name: '',
        place: '',
        products: []
    };
    const [formData, setFormData] = useState(initialFormState);
    const [pendingApprovals, setPendingApprovals] = useState([]);

    // Subscribe to Chemists
    useEffect(() => {
        const q = query(collection(db, "chemists"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setRecords(data);
        });
        return () => unsubscribe();
    }, []);

    // Subscribe to Pending Approvals for current user
    useEffect(() => {
        if (currentUser) {
            const qApprovals = query(
                collection(db, "pending_approvals"),
                where("requestedBy", "==", currentUser.uid),
                where("status", "==", "PENDING"),
                where("collection", "==", "chemists")
            );
            const unsubscribe = onSnapshot(qApprovals, (snapshot) => {
                const approvals = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setPendingApprovals(approvals);
            });
            return () => unsubscribe();
        }
    }, [currentUser]);

    const handleOpenModal = (record = null) => {
        if (record) {
            setEditingRecord(record);
            setFormData({
                name: record.name,
                place: record.place || '',
                products: record.products || []
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
                name: formData.name,
                place: formData.place,
                products: formData.products
            };

            if (userRole === 'user') {
                const userDataToSave = {
                    name: formData.name,
                    place: formData.place
                };

                if (editingRecord) {
                    const existingRequest = pendingApprovals.find(req => req.recordId === editingRecord.id);
                    if (existingRequest) {
                        if (window.confirm("A pending approval request already exists. Override?")) {
                            await updateDoc(doc(db, "pending_approvals", existingRequest.id), {
                                type: 'UPDATE',
                                data: userDataToSave,
                                createdAt: serverTimestamp()
                            });
                            alert("Request updated.");
                        } else {
                            setLoading(false);
                            return;
                        }
                    } else {
                        await addDoc(collection(db, "pending_approvals"), {
                            type: 'UPDATE',
                            collection: 'chemists',
                            data: userDataToSave,
                            recordId: editingRecord.id,
                            status: 'PENDING',
                            requestedBy: currentUser.uid,
                            requestedByName: userData.name || currentUser.email,
                            createdAt: serverTimestamp()
                        });
                        alert("Update request sent to Admin.");
                    }
                } else {
                    await addDoc(collection(db, "pending_approvals"), {
                        type: 'ADD',
                        collection: 'chemists',
                        data: userDataToSave,
                        status: 'PENDING',
                        requestedBy: currentUser.uid,
                        requestedByName: userData.name || currentUser.email,
                        createdAt: serverTimestamp()
                    });
                    alert("Add request sent to Admin.");
                }
            } else {
                if (editingRecord) {
                    await updateDoc(doc(db, "chemists", editingRecord.id), {
                        ...dataToSave,
                        updatedAt: serverTimestamp()
                    });
                } else {
                    await addDoc(collection(db, "chemists"), {
                        ...dataToSave,
                        createdAt: serverTimestamp()
                    });
                }
                alert("Saved successfully.");
            }
            handleCloseModal();
        } catch (error) {
            console.error("Error saving chemist: ", error);
            alert("Error saving record.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure?")) return;
        try {
            if (userRole === 'user') {
                await addDoc(collection(db, "pending_approvals"), {
                    type: 'DELETE',
                    collection: 'chemists',
                    recordId: id,
                    status: 'PENDING',
                    requestedBy: currentUser.uid,
                    requestedByName: userData.name || currentUser.email,
                    createdAt: serverTimestamp()
                });
                alert("Delete request sent.");
            } else {
                await deleteDoc(doc(db, "chemists", id));
            }
        } catch (error) {
            console.error("Error deleting: ", error);
        }
    };

    const addProduct = () => {
        setFormData({
            ...formData,
            products: [...formData.products, { name: '', quantity: '', price: '', purchaseDate: new Date().toISOString().split('T')[0] }]
        });
    };

    const updateProduct = (index, field, value) => {
        const newProducts = [...formData.products];
        newProducts[index][field] = value;
        setFormData({ ...formData, products: newProducts });
    };

    const removeProduct = (index) => {
        const newProducts = formData.products.filter((_, i) => i !== index);
        setFormData({ ...formData, products: newProducts });
    };

    const filteredRecords = records.filter(record =>
        record.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.place.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <DashboardLayout title="Chemists">
            <Card className="p-0 overflow-hidden flex flex-col min-h-[500px]">
                <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <input
                            type="text"
                            placeholder="Search by name or place..."
                            className="block w-full pl-4 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 shadow-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button onClick={() => handleOpenModal()}>+ Add New Chemist</Button>
                </div>

                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Name</th>
                                <th className="px-6 py-4 font-semibold">Place</th>
                                {userRole === 'admin' && <th className="px-6 py-4 font-semibold">Products</th>}
                                <th className="px-6 py-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {filteredRecords.map((record) => (
                                <tr key={record.id} className="hover:bg-indigo-50/30 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-900 border-l-4 border-transparent hover:border-indigo-500">{record.name}</td>
                                    <td className="px-6 py-4 text-gray-600">{record.place}</td>
                                    {userRole === 'admin' && (
                                        <td className="px-6 py-4">
                                            {record.products?.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {record.products.slice(0, 2).map((p, i) => (
                                                        <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                                                            {p.name} ({p.quantity}) - ₹{p.price || 0} - {p.purchaseDate ? new Date(p.purchaseDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '-'}
                                                        </span>
                                                    ))}
                                                    {record.products.length > 2 && (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                                            +{record.products.length - 2}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 italic text-xs">No products</span>
                                            )}
                                        </td>
                                    )}
                                    <td className="px-6 py-4 text-right space-x-3">
                                        <button onClick={() => handleOpenModal(record)} className="text-indigo-600 hover:text-indigo-900 font-medium transition-colors">Edit</button>
                                        <button onClick={() => handleDelete(record.id)} className="text-red-600 hover:text-red-900 font-medium transition-colors">Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={editingRecord ? 'Edit Chemist' : 'Add New Chemist'}
            >
                <form onSubmit={handleSubmit} className="space-y-5">
                    <Input
                        label="Chemist Name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Enter chemist name"
                        required
                    />
                    <Input
                        label="Place / Location"
                        value={formData.place}
                        onChange={(e) => setFormData({ ...formData, place: e.target.value })}
                        placeholder="Enter location"
                        required
                    />

                    {userRole === 'admin' && (
                        <div className="bg-gray-50 p-4 rounded-xl space-y-4 border border-gray-100">
                            <label className="block text-sm font-semibold text-gray-900">Related Products</label>
                            {formData.products.map((product, index) => (
                                <div key={index} className="flex gap-2 items-start bg-white p-3 rounded-lg shadow-sm border border-gray-100 animate-in fade-in slide-in-from-top-1">
                                    <div className="flex-1">
                                        <select
                                            value={product.name}
                                            onChange={(e) => updateProduct(index, 'name', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                                            required
                                        >
                                            <option value="">Select Product</option>
                                            {PRODUCT_NAMES.map(name => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="w-20">
                                        <input
                                            type="number"
                                            placeholder="Qty"
                                            value={product.quantity}
                                            onChange={(e) => updateProduct(index, 'quantity', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                                            required
                                        />
                                    </div>
                                    <div className="w-24">
                                        <input
                                            type="number"
                                            placeholder="Price"
                                            value={product.price}
                                            onChange={(e) => updateProduct(index, 'price', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                                            required
                                        />
                                    </div>
                                    <div className="w-32">
                                        <input
                                            type="date"
                                            value={product.purchaseDate}
                                            onChange={(e) => updateProduct(index, 'purchaseDate', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                                            required
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeProduct(index)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                            <Button type="button" variant="secondary" onClick={addProduct} className="w-full py-2 bg-white hover:bg-gray-50 border-dashed border-2">
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add Product
                                </span>
                            </Button>
                        </div>
                    )}

                    <div className="pt-6 flex gap-3">
                        <Button type="button" variant="secondary" onClick={handleCloseModal} className="flex-1">Cancel</Button>
                        <Button type="submit" disabled={loading} className="flex-1 shadow-lg shadow-indigo-200">
                            {loading ? 'Saving...' : 'Save Chemist'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
