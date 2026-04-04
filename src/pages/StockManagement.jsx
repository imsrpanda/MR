import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import { PRODUCTS } from '../constants/products';
import { useAuth } from '../contexts/AuthContext';

export default function StockManagement() {
    const { userRole } = useAuth();
    const [stocks, setStocks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStock, setEditingStock] = useState(null);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [expandedProducts, setExpandedProducts] = useState({});

    const initialFormState = {
        batchNo: '',
        expiry: '',
        quantity: 0,
        closingQuantity: 0
    };
    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        const q = query(collection(db, "stocks"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setStocks(data);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching stocks:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const groupedStocks = useMemo(() => {
        const groups = {};
        PRODUCTS.forEach(product => {
            groups[product.name] = {
                product,
                batches: stocks.filter(s => s.productName === product.name),
                totalQuantity: 0,
                totalClosingQuantity: 0
            };
            groups[product.name].totalQuantity = groups[product.name].batches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);
            groups[product.name].totalClosingQuantity = groups[product.name].batches.reduce((sum, b) => sum + Number(b.closingQuantity || 0), 0);
        });
        return groups;
    }, [stocks]);

    const filteredProducts = useMemo(() => {
        return PRODUCTS.filter(p => 
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.hsn.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery]);

    const toggleExpand = (productName) => {
        setExpandedProducts(prev => ({
            ...prev,
            [productName]: !prev[productName]
        }));
    };

    const handleOpenModal = (product, stock = null) => {
        setSelectedProduct(product);
        if (stock) {
            setEditingStock(stock);
            setFormData({
                batchNo: stock.batchNo,
                expiry: stock.expiry,
                quantity: stock.quantity,
                closingQuantity: stock.closingQuantity
            });
        } else {
            setEditingStock(null);
            setFormData(initialFormState);
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const dataToSave = {
                ...formData,
                quantity: Number(formData.quantity) || 0,
                closingQuantity: Number(formData.closingQuantity) || 0,
                productName: selectedProduct.name,
                hsn: selectedProduct.hsn,
                pack: selectedProduct.pack,
                updatedAt: serverTimestamp()
            };

            if (editingStock) {
                await updateDoc(doc(db, "stocks", editingStock.id), dataToSave);
            } else {
                await addDoc(collection(db, "stocks"), {
                    ...dataToSave,
                    createdAt: serverTimestamp()
                });
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error saving stock:", error);
            alert("Error saving stock");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this batch?")) {
            try {
                await deleteDoc(doc(db, "stocks", id));
            } catch (error) {
                console.error("Error deleting stock:", error);
                alert("Error deleting stock");
            }
        }
    };
    
    const repairStockData = async () => {
        if (!window.confirm("This will convert all existing stock quantities to numbers. Continue?")) return;
        setLoading(true);
        try {
            const updates = stocks.map(async (stock) => {
                const qty = Number(stock.quantity) || 0;
                const closing = Number(stock.closingQuantity) || 0;
                // Only update if they are currently not numeric (or if we want to be sure)
                return updateDoc(doc(db, "stocks", stock.id), {
                    quantity: qty,
                    closingQuantity: closing,
                    updatedAt: serverTimestamp()
                });
            });
            await Promise.all(updates);
            alert("Stock data repaired successfully! All quantities are now numeric.");
        } catch (error) {
            console.error("Error repairing stock data:", error);
            alert("Error repairing data: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout title="Stock Management">
            <Card className="p-0 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Search products..."
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    {userRole === 'admin' && (
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={repairStockData}
                            className="text-amber-600 border-amber-200 hover:bg-amber-50"
                        >
                            ⚠ Repair Data
                        </Button>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 uppercase">
                            <tr>
                                <th className="px-6 py-3 font-medium w-10"></th>
                                <th className="px-6 py-3 font-medium">Product Name</th>
                                <th className="px-6 py-3 font-medium">HSN No.</th>
                                <th className="px-6 py-3 font-medium">Pack</th>
                                <th className="px-6 py-3 font-medium">Total Qty</th>
                                <th className="px-6 py-3 font-medium">Closing Qty</th>
                                <th className="px-6 py-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredProducts.map((product) => {
                                const group = groupedStocks[product.name] || { batches: [], totalQuantity: 0, totalClosingQuantity: 0 };
                                const isExpanded = expandedProducts[product.name];

                                return (
                                    <React.Fragment key={product.name}>
                                        <tr className={`hover:bg-gray-50 transition-colors ${isExpanded ? 'bg-indigo-50/30' : ''}`}>
                                            <td className="px-6 py-4">
                                                <button onClick={() => toggleExpand(product.name)} className="text-gray-400 hover:text-indigo-600 transition-colors">
                                                    <svg className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-900">{product.name}</td>
                                            <td className="px-6 py-4 text-gray-500">{product.hsn}</td>
                                            <td className="px-6 py-4 text-gray-500">{product.pack}</td>
                                            <td className="px-6 py-4 font-semibold text-indigo-600">{group.totalQuantity}</td>
                                            <td className="px-6 py-4 font-semibold text-green-600">{group.totalClosingQuantity}</td>
                                            <td className="px-6 py-4 text-right">
                                                <Button size="sm" onClick={() => handleOpenModal(product)}>
                                                    Add Batch
                                                </Button>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-gray-50/50">
                                                <td colSpan={7} className="px-12 py-4">
                                                    {group.batches.length > 0 ? (
                                                        <table className="w-full text-xs bg-white border border-gray-100 rounded-lg overflow-hidden shadow-sm">
                                                            <thead className="bg-gray-50 text-gray-400 uppercase">
                                                                <tr>
                                                                    <th className="px-4 py-2 font-medium">Batch No.</th>
                                                                    <th className="px-4 py-2 font-medium">Expiry</th>
                                                                    <th className="px-4 py-2 font-medium">Quantity</th>
                                                                    <th className="px-4 py-2 font-medium">Closing Qty</th>
                                                                    <th className="px-4 py-2 font-medium text-right">Actions</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-100">
                                                                {group.batches.map((batch) => (
                                                                    <tr key={batch.id} className="hover:bg-gray-50">
                                                                        <td className="px-4 py-2 text-gray-700 font-medium">{batch.batchNo}</td>
                                                                        <td className="px-4 py-2 text-gray-500">{batch.expiry}</td>
                                                                        <td className="px-4 py-2 text-gray-500">{batch.quantity}</td>
                                                                        <td className="px-4 py-2 text-gray-500">{batch.closingQuantity}</td>
                                                                        <td className="px-4 py-2 text-right space-x-2">
                                                                            <button onClick={() => handleOpenModal(product, batch)} className="text-indigo-600 hover:text-indigo-900 font-medium">Edit</button>
                                                                            <button onClick={() => handleDelete(batch.id)} className="text-red-600 hover:text-red-900 font-medium">Delete</button>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    ) : (
                                                        <div className="text-center py-4 text-gray-400 italic bg-white border border-dashed border-gray-200 rounded-lg">
                                                            No batches added yet.
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingStock ? `Edit Batch for ${selectedProduct?.name}` : `Add New Batch for ${selectedProduct?.name}`}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label="Batch Number"
                        value={formData.batchNo}
                        onChange={(e) => setFormData({ ...formData, batchNo: e.target.value })}
                        placeholder="e.g. B123456"
                        required
                    />
                    <Input
                        label="Expiry"
                        type="text"
                        placeholder="e.g. Dec 2025"
                        value={formData.expiry}
                        onChange={(e) => setFormData({ ...formData, expiry: e.target.value })}
                        required
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Quantity"
                            type="number"
                            value={formData.quantity}
                            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                            required
                        />
                        <Input
                            label="Closing Quantity"
                            type="number"
                            value={formData.closingQuantity}
                            onChange={(e) => setFormData({ ...formData, closingQuantity: e.target.value })}
                            required
                        />
                    </div>
                    <div className="pt-4 flex gap-3">
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading} className="flex-1">
                            {loading ? 'Saving...' : 'Save Batch'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
