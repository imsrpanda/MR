import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import Card from '../ui/Card';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from 'recharts';

export default function ChemistPurchaseWidget() {
    const [chemists, setChemists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('table'); // 'table' or 'graph'
    const [selectedChemist, setSelectedChemist] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const q = query(collection(db, "chemists"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            try {
                const data = snapshot.docs.map(doc => {
                    const chemistData = doc.data();
                    const products = Array.isArray(chemistData.products) ? chemistData.products : [];
                    
                    // Calculate total units and total value
                    let totalUnits = 0;
                    let totalValue = 0;
                    products.forEach(p => {
                        const qty = Number(p.quantity || 0);
                        const price = Number(p.price || 0);
                        totalUnits += qty;
                        totalValue += (qty * price);
                    });

                    return {
                        id: doc.id,
                        ...chemistData,
                        products,
                        totalUnits,
                        totalValue
                    };
                });
                setChemists(data);
                setLoading(false);
            } catch (err) {
                console.error("Error processing chemists data:", err);
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const handleRowClick = (chemist) => {
        setSelectedChemist(chemist);
        setIsDetailModalOpen(true);
    };

    const getGraphData = (chemist) => {
        if (!chemist || !chemist.products || !Array.isArray(chemist.products)) return [];

        // Group by Month
        const monthlyGroups = {};
        chemist.products.forEach(p => {
            if (!p || !p.purchaseDate || !p.name || !p.quantity) return;
            const date = new Date(p.purchaseDate);
            if (isNaN(date.getTime())) return;

            const monthKey = date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
            
            if (!monthlyGroups[monthKey]) {
                monthlyGroups[monthKey] = { month: monthKey, _date: date, totalValue: 0 };
            }
            const quantity = Number(p.quantity);
            const price = Number(p.price || 0);
            if (!isNaN(quantity)) {
                monthlyGroups[monthKey][p.name] = (monthlyGroups[monthKey][p.name] || 0) + quantity;
                monthlyGroups[monthKey].totalValue += (quantity * price);
            }
        });

        // Convert to array and sort by date
        return Object.values(monthlyGroups)
            .sort((a, b) => a._date - b._date)
            .map(({ _date, ...rest }) => rest);
    };

    const getUniqueProducts = (chemist) => {
        if (!chemist || !chemist.products || !Array.isArray(chemist.products)) return [];
        return [...new Set(chemist.products.filter(p => p && p.name).map(p => String(p.name)))];
    };

    // Filter and Sort Data
    const filteredChemists = chemists.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.place?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Get Top 5 sorted by totalValue if not searching, otherwise show filtered results
    const displayedChemists = searchTerm.length > 0 
        ? filteredChemists 
        : [...filteredChemists].sort((a, b) => b.totalValue - a.totalValue).slice(0, 5);

    // Auto-Graph View Logic
    const isSingleResult = filteredChemists.length === 1 && searchTerm.length > 0;
    const singleChemist = isSingleResult ? filteredChemists[0] : null;
    const singleGraphData = isSingleResult ? getGraphData(singleChemist) : [];

    if (loading) {
        return (
            <Card className="p-6 mb-8 border-l-4 border-indigo-500 bg-white/60 backdrop-blur-lg shadow-lg border-white/50">
                <div className="flex items-center justify-center h-40 text-gray-500">Loading chemist purchase data...</div>
            </Card>
        );
    }

    return (
        <Card className="p-0 overflow-hidden flex flex-col mb-8 border-l-4 border-indigo-500 bg-white/60 backdrop-blur-lg shadow-lg border-white/50">
            {/* Header */}
            <div className="p-6 border-b border-gray-100/50 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-gradient-to-r from-indigo-50 to-blue-50/30">
                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <span className="text-2xl">🛍️</span>
                        Purchase by Chemist
                        {searchTerm.length === 0 && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full ml-2">Top 5</span>}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">Summary of product purchases per chemist</p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                    {/* Search Field */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Type to search chemist..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full sm:w-64 pl-4 pr-10 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')} 
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    <div className="flex items-center bg-white p-1 rounded-lg border border-gray-200 shadow-sm h-[38px]">
                        <button
                            onClick={() => setViewMode('table')}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                                viewMode === 'table' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            Table
                        </button>
                        <button
                            onClick={() => setViewMode('graph')}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                                viewMode === 'graph' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            Graph
                        </button>
                    </div>
                </div>
            </div>

            {/* Content View */}
            <div className="flex-1">
                {isSingleResult ? (
                    /* Auto-Graph View for single result */
                    <div className="p-8 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-xl shadow-indigo-100/30">
                            <h4 className="font-bold text-xl text-gray-900 mb-6 flex items-center justify-between">
                                <div className="flex items-center gap-3 text-2xl font-bold text-gray-900">
                                    <span className="p-2 bg-indigo-50 rounded-lg text-2xl">📈</span>
                                    <div>
                                        {singleChemist.name}
                                        <span className="block text-sm font-normal text-gray-500 mt-0.5">{singleChemist.place}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Total Purchase</div>
                                    <div className="text-2xl font-black text-indigo-600">₹{singleChemist.totalValue.toLocaleString()}</div>
                                </div>
                            </h4>
                            <div className="h-[400px] w-full">
                                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                    <AreaChart data={singleGraphData}>
                                        <defs>
                                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                                                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="month" fontSize={12} tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} dy={10} />
                                        <YAxis fontSize={12} tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val}`} />
                                        <Tooltip 
                                            formatter={(value) => [`₹${value.toLocaleString()}`, 'Monthly Value']}
                                            contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                        />
                                        <Area 
                                            type="monotone" 
                                            dataKey="totalValue" 
                                            stroke="#4f46e5" 
                                            strokeWidth={4}
                                            fillOpacity={1} 
                                            fill="url(#colorTotal)"
                                            dot={{ r: 6, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }}
                                            activeDot={{ r: 8, strokeWidth: 0 }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-8 flex justify-center">
                                <Button onClick={() => handleRowClick(singleChemist)} variant="secondary" className="flex items-center gap-2">
                                    <span>🔍 View Detailed Items</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : viewMode === 'table' ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50/50 text-gray-500 uppercase border-b border-gray-100/50">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Chemist Name</th>
                                    <th className="px-6 py-4 font-semibold">Location</th>
                                    <th className="px-6 py-4 font-semibold text-right">Products Count</th>
                                    <th className="px-6 py-4 font-semibold text-right">Total Purchase</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {displayedChemists.map((chemist) => (
                                    <tr
                                        key={chemist.id}
                                        onClick={() => handleRowClick(chemist)}
                                        className="hover:bg-indigo-50/30 transition-colors cursor-pointer group"
                                    >
                                        <td className="px-6 py-4 font-medium text-gray-900 group-hover:text-indigo-600">
                                            {chemist.name}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {chemist.place}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                                {chemist.totalUnits} Units
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-indigo-100 text-indigo-700">
                                                ₹ {chemist.totalValue.toLocaleString()}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {displayedChemists.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-10 text-center text-gray-500">No chemist purchase data found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-6 space-y-8">
                        {displayedChemists.map(chemist => {
                            const graphData = getGraphData(chemist);
                            const products = getUniqueProducts(chemist);
                            if (graphData.length === 0) return null;
                            
                            return (
                                <div key={chemist.id} className="bg-white/40 p-6 rounded-xl border border-white/50 shadow-sm">
                                    <h4 className="font-bold text-gray-900 mb-4 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                            {chemist.name} <span className="text-sm font-normal text-gray-500">({chemist.place})</span>
                                        </div>
                                        <div className="text-sm font-bold text-indigo-600">Total Value: ₹{chemist.totalValue.toLocaleString()}</div>
                                    </h4>
                                    <div className="h-64 w-full">
                                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                            <LineChart data={graphData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                                <XAxis dataKey="month" fontSize={12} tick={{ fill: '#6b7280' }} />
                                                <YAxis fontSize={12} tick={{ fill: '#6b7280' }} />
                                                <Tooltip 
                                                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: 'none', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                                />
                                                <Legend />
                                                {products.map((prodName, idx) => (
                                                    <Line 
                                                        key={prodName}
                                                        type="monotone" 
                                                        dataKey={prodName} 
                                                        stroke={`hsl(${idx * (360 / products.length)}, 70%, 50%)`} 
                                                        strokeWidth={3}
                                                        dot={{ r: 4, strokeWidth: 2 }}
                                                        activeDot={{ r: 6 }}
                                                    />
                                                ))}
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            );
                        })}
                        {displayedChemists.length === 0 && (
                            <div className="py-20 text-center text-gray-500">No graph data available.</div>
                        )}
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            <Modal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                title={`Purchase Details: ${selectedChemist?.name}`}
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Location</div>
                            <div className="text-sm font-bold text-gray-900">{selectedChemist?.place}</div>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg">
                            <div className="text-xs text-blue-500 uppercase tracking-wider font-semibold">Total Quantity</div>
                            <div className="text-sm font-bold text-blue-900">{selectedChemist?.totalUnits} Units</div>
                        </div>
                        <div className="p-3 bg-indigo-50 rounded-lg">
                            <div className="text-xs text-indigo-500 uppercase tracking-wider font-semibold">Total Value</div>
                            <div className="text-sm font-bold text-indigo-900">₹{selectedChemist?.totalValue.toLocaleString()}</div>
                        </div>
                    </div>
                    
                    <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-gray-100 shadow-sm">
                        <table className="w-full text-left text-xs sm:text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 font-semibold text-gray-600">Product</th>
                                    <th className="px-4 py-3 font-semibold text-gray-600">Qty</th>
                                    <th className="px-4 py-3 font-semibold text-gray-600">Price</th>
                                    <th className="px-4 py-3 font-semibold text-gray-600 text-right">Value</th>
                                    <th className="px-4 py-3 font-semibold text-gray-600">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {(selectedChemist?.products || []).map((p, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                                        <td className="px-4 py-3 text-indigo-600 font-bold">{p.quantity}</td>
                                        <td className="px-4 py-3 text-gray-600">₹{p.price}</td>
                                        <td className="px-4 py-3 text-right font-bold text-gray-900">₹{(Number(p.quantity) * Number(p.price)).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-gray-500">
                                            {p.purchaseDate ? new Date(p.purchaseDate).toLocaleDateString() : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="pt-4 flex justify-end">
                        <Button onClick={() => setIsDetailModalOpen(false)} variant="secondary">Close</Button>
                    </div>
                </div>
            </Modal>
        </Card>
    );
}
