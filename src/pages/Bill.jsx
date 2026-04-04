import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { PRODUCTS, PRODUCT_NAMES } from '../constants/products';
import { db } from '../firebase/firebase';
import { collection, addDoc, serverTimestamp, setDoc, doc, onSnapshot, query, where, getDocs, increment, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Bill() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    
    // Check if we are viewing an existing bill
    const viewData = location.state?.billData;
    const isReadOnly = !!viewData;

    const [header, setHeader] = useState(viewData?.header || {
        name: '',
        address1: '',
        address2: '',
        fssai: '',
        gstin: '',
        phone: '',
        no: '',
        date: new Date().toISOString().split('T')[0],
        transport: '',
        lrNoDate: '',
        lrNo: '',
        noOfCases: '',
    });

    const [items, setItems] = useState(viewData?.items || [{
        id: 1,
        product: '',
        hsn: '',
        pack: '',
        bno: '',
        exp: '',
        quantity: 0,
        fQunt: 0,
        mrp: 0,
        gstPercent: 5,
        ptr: 0,
        pts: 0,
        amount: 0
    }]);

    const [footer, setFooter] = useState(viewData?.footer || {
        distDisPercent: 5,
        sgstPercent: 2.5,
        cgstPercent: 2.5,
        igstPercent: 0,
    });

    const [totals, setTotals] = useState(viewData?.totals || {
        total: 0,
        distDis: 0,
        gTotal: 0,
        sgst: 0,
        cgst: 0,
        igst: 0,
        subTotal: 0,
        ro: 0,
        netTotal: 0
    });

    const [isSaving, setIsSaving] = useState(false);
    const [savedCustomers, setSavedCustomers] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [excludePts, setExcludePts] = useState(false);
    const [syncWithStock, setSyncWithStock] = useState(false);
    const [availableStocks, setAvailableStocks] = useState([]);

    useEffect(() => {
        if (isReadOnly) return;
        const unsubscribe = onSnapshot(collection(db, "customers"), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSavedCustomers(data);
        });
        return () => unsubscribe();
    }, [isReadOnly]);

    useEffect(() => {
        if (isReadOnly) return;
        const unsubscribe = onSnapshot(collection(db, "stocks"), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAvailableStocks(data);
        });
        return () => unsubscribe();
    }, [isReadOnly]);

    // Handle header changes
    const handleHeaderChange = (e) => {
        const { name, value } = e.target;
        setHeader(prev => {
            const next = { ...prev, [name]: value };
            
            // Auto complete if exact match is typed
            if (name === 'name') {
                const match = savedCustomers.find(c => c.name.toLowerCase() === value.toLowerCase());
                if (match) {
                    next.address1 = match.address1 || '';
                    next.address2 = match.address2 || '';
                    next.fssai = match.fssai || '';
                    next.gstin = match.gstin || '';
                    next.phone = match.phone || '';
                }
            }
            return next;
        });
    };

    // Handle footer changes
    const handleFooterChange = (e) => {
        setFooter({ ...footer, [e.target.name]: parseFloat(e.target.value) || 0 });
    };

    // Calculate item values when dependent fields change
    const updateItem = (index, field, value) => {
        const newItems = [...items];
        const item = { ...newItems[index], [field]: value };

        // Auto-calculate if MRP, Quantity, or GST% changes
        if (['mrp', 'quantity', 'gstPercent'].includes(field)) {
            const mrp = parseFloat(item.mrp) || 0;
            const gst = parseFloat(item.gstPercent) || 0;
            const qty = parseFloat(item.quantity) || 0;
            
            const base = mrp / (1 + gst / 100);
            item.ptr = base * 0.8;
            item.pts = item.ptr * 0.9;
            item.amount = qty * (excludePts ? item.ptr : item.pts);
        } else if (['ptr', 'pts'].includes(field)) {
            // If user manually overrides PTR or PTS, recalculate amount
            const qty = parseFloat(item.quantity) || 0;
            const price = excludePts ? parseFloat(item.ptr) : parseFloat(item.pts);
            item.amount = qty * price;
        } else if (field === 'product') {
            // Auto-fill HSN and Pack when product is selected
            const productData = PRODUCTS.find(p => p.name === value);
            if (productData) {
                item.hsn = productData.hsn;
                item.pack = productData.pack;
            }
        } else if (field === 'bno') {
            // Auto-fill expiry when batch is selected
            const stockData = availableStocks.find(s => s.productName === item.product && s.batchNo === value);
            if (stockData) {
                item.exp = stockData.expiry;
            }
        }

        newItems[index] = item;
        setItems(newItems);
    };

    const addItem = () => {
        setItems([...items, {
            id: items.length + 1,
            product: '', hsn: '', pack: '', bno: '', exp: '',
            quantity: 0, fQunt: 0, mrp: 0, gstPercent: 5,
            ptr: 0, pts: 0, amount: 0
        }]);
    };

    const removeItem = (index) => {
        if (items.length > 1) {
            const newItems = items.filter((_, i) => i !== index);
            setItems(newItems);
        }
    };

    // Recalculate all amounts when excludePts changes
    useEffect(() => {
        if (isReadOnly) return;
        setItems(prevItems => prevItems.map(item => {
            const qty = parseFloat(item.quantity) || 0;
            const price = excludePts ? parseFloat(item.ptr) : parseFloat(item.pts);
            return { ...item, amount: qty * price };
        }));
    }, [excludePts, isReadOnly]);

    // Recalculate totals whenever items or footer percentages change
    useEffect(() => {
        const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        const distDis = totalAmount * (footer.distDisPercent / 100);
        const gTotal = totalAmount - distDis;
        const sgst = gTotal * (footer.sgstPercent / 100);
        const cgst = gTotal * (footer.cgstPercent / 100);
        const igst = gTotal * (footer.igstPercent / 100);
        const subTotal = gTotal + sgst + cgst + igst;
        const netTotal = Math.round(subTotal);
        const ro = subTotal - netTotal;

        setTotals({
            total: totalAmount,
            distDis,
            gTotal,
            sgst,
            cgst,
            igst,
            subTotal,
            ro,
            netTotal
        });
    }, [items, footer]);

    const handlePrint = () => {
        window.print();
    };

    const numberToWords = (num) => {
        const a = ['','ONE ','TWO ','THREE ','FOUR ', 'FIVE ','SIX ','SEVEN ','EIGHT ','NINE ','TEN ','ELEVEN ','TWELVE ','THIRTEEN ','FOURTEEN ','FIFTEEN ','SIXTEEN ','SEVENTEEN ','EIGHTEEN ','NINETEEN '];
        const b = ['', '', 'TWENTY','THIRTY','FORTY','FIFTY', 'SIXTY','SEVENTY','EIGHTY','NINETY'];

        if ((num = num.toString()).length > 9) return 'overflow';
        let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
        if (!n) return; let str = '';
        str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'CRORE ' : '';
        str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'LAKH ' : '';
        str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'THOUSAND ' : '';
        str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'HUNDRED ' : '';
        str += (n[5] != 0) ? ((str != '') ? 'AND ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'ONLY ' : '';
        return str.trim();
    };

    const handleSave = async () => {
        if (!header.name || !header.no) {
            alert("Please provide at least a Bill To Name and No. before saving.");
            return;
        }
        setIsSaving(true);
        try {
            // Save to customers collection for auto-complete next time
            if (header.name) {
                const customerId = header.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
                await setDoc(doc(db, "customers", customerId), {
                    name: header.name,
                    address1: header.address1,
                    address2: header.address2,
                    fssai: header.fssai,
                    gstin: header.gstin,
                    phone: header.phone,
                }, { merge: true });
            }

            await addDoc(collection(db, "bills"), {
                header,
                items,
                footer,
                totals,
                createdAt: serverTimestamp(),
                createdBy: currentUser.uid,
                syncWithStock: syncWithStock
            });

            // Stock Sync Logic
            if (syncWithStock) {
                try {
                    for (const item of items) {
                        if (item.product && item.bno) {
                            const totalDeduct = (Number(item.quantity) || 0) + (Number(item.fQunt) || 0);
                            if (totalDeduct > 0) {
                                // Normalize for matching
                                const pName = item.product.trim();
                                const bNo = item.bno.trim();

                                const q = query(
                                    collection(db, "stocks"),
                                    where("productName", "==", pName),
                                    where("batchNo", "==", bNo)
                                );
                                
                                const snapshot = await getDocs(q);
                                if (!snapshot.empty) {
                                    const stockDoc = snapshot.docs[0];
                                    await updateDoc(doc(db, "stocks", stockDoc.id), {
                                        closingQuantity: increment(-totalDeduct),
                                        updatedAt: serverTimestamp()
                                    });
                                    console.log(`Deducted ${totalDeduct} from ${pName} batch ${bNo}`);
                                } else {
                                    console.warn(`No stock found for ${pName} batch ${bNo}`);
                                }
                            }
                        }
                    }
                } catch (stockError) {
                    console.error("Error updating stock during bill save:", stockError);
                    alert("Bill saved, but Stock Sync failed: " + stockError.message);
                }
            }
            alert("Bill saved successfully!");
            navigate('/bills');
        } catch (error) {
            console.error("Error saving bill:", error);
            alert("Failed to save bill. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <DashboardLayout title={isReadOnly ? "View Bill" : "Create Bill"}>
            {/* Action Buttons */}
            <div className="mb-4 flex justify-end items-center gap-4 print:hidden">
                <label className="flex items-center gap-2 text-sm text-gray-700 font-medium cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={excludePts} 
                        onChange={(e) => setExcludePts(e.target.checked)} 
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    Exclude PTS from Print
                </label>
                {!isReadOnly && (
                    <label className="flex items-center gap-2 text-sm text-indigo-700 font-bold cursor-pointer bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200 shadow-sm hover:bg-indigo-100 transition-all">
                        <input 
                            type="checkbox" 
                            checked={syncWithStock} 
                            onChange={(e) => setSyncWithStock(e.target.checked)} 
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        Sync with Stock
                    </label>
                )}
                <button 
                    onClick={handlePrint}
                    className="bg-gray-100 text-gray-800 border border-gray-300 px-4 py-2 rounded shadow hover:bg-gray-200 transition"
                >
                    Print Bill
                </button>
                {!isReadOnly && (
                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 transition disabled:opacity-50"
                    >
                        {isSaving ? "Saving..." : "Save Bill"}
                    </button>
                )}
            </div>

            {/* Print Container (Landscape styled) */}
            <style type="text/css">
                {`
                @media print {
                    @page { size: landscape; margin: 0; }
                    body { font-size: 10px; }
                    input, select { border: none !important; appearance: none; -moz-appearance: none; -webkit-appearance: none; background: transparent !important; }
                    .print-border { border: 1px solid #000; }
                    .print-border-b { border-bottom: 1px solid #000; }
                    .print-border-r { border-right: 1px solid #000; }
                    .page-break { page-break-before: always; }
                    ::-webkit-scrollbar { display: none; }
                }
                `}
            </style>

            <div className={`bg-white p-2 md:p-8 rounded shadow-lg print:shadow-none print:pt-8 print:px-8 print:m-0 w-full max-w-[1200px] mx-auto text-sm border print:border-black ${isReadOnly ? 'pointer-events-none' : ''}`} id="bill-content">
                {/* Headers */}
                <div className="text-center font-bold mb-4 print:mb-2 print:leading-tight relative">
                    <h1 className="text-xl print:text-lg">INTEGRITAS RESEARCH</h1>
                    <p className="text-xs print:text-[10px]">INTEGRITAS RESEARCH (HO-DELHI) BALAJI NAGAR DIGAPAHANDI-761012(ODISHA). PH. 8249660880</p>
                    <p className="text-xs print:text-[10px]">FSSAI.No. : 12026011000049 * GSTIN No. 21FDQPS7606E1ZC</p>
                </div>

                {/* Top User Input Section */}
                <div className="flex justify-between border-t border-b print:border-black py-2 mb-2 print:py-1 print:mb-1">
                    <div className="w-1/2 pr-4 print:leading-tight">
                        <div className="flex items-center mb-1 print:mb-0 relative">
                            <span className="font-bold underline whitespace-nowrap mr-2">BILL TO :</span>
                            <div className="relative w-full">
                                <input 
                                    className="w-full font-bold uppercase focus:outline-none border-b print:border-none border-gray-200" 
                                    placeholder="Name (e.g., M/S ANAND KRISHNA)" 
                                    name="name" 
                                    value={header.name} 
                                    onChange={(e) => {
                                        handleHeaderChange(e);
                                        setShowSuggestions(true);
                                    }}
                                    onFocus={() => setShowSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                    autoComplete="off"
                                />
                                {showSuggestions && !isReadOnly && header.name && (
                                    <ul className="absolute z-50 w-full bg-white border border-gray-300 rounded-b-lg shadow-lg max-h-60 overflow-y-auto mt-1 left-0 print:hidden text-left font-normal normal-case">
                                        {savedCustomers
                                            .filter(c => c.name.toLowerCase().includes(header.name.toLowerCase()))
                                            .map((c, i) => (
                                                <li 
                                                    key={i} 
                                                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        setHeader(prev => ({
                                                            ...prev,
                                                            name: c.name,
                                                            address1: c.address1 || prev.address1,
                                                            address2: c.address2 || prev.address2,
                                                            fssai: c.fssai || prev.fssai,
                                                            gstin: c.gstin || prev.gstin,
                                                            phone: c.phone || prev.phone,
                                                        }));
                                                        setShowSuggestions(false);
                                                    }}
                                                >
                                                    <div className="font-bold uppercase text-gray-800">{c.name}</div>
                                                    <div className="text-xs text-gray-500 uppercase">{c.address1} {c.address2}</div>
                                                </li>
                                            ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                        <input className="w-full uppercase focus:outline-none mb-1 print:mb-0 border-b print:border-none border-gray-200 block" placeholder="Address Line 1" name="address1" value={header.address1} onChange={handleHeaderChange} />
                        <div className="flex items-center mb-1 print:mb-0">
                            <input className="w-full uppercase focus:outline-none border-b print:border-none border-gray-200" placeholder="Address Line 2 (City, State, Pin)" name="address2" value={header.address2} onChange={handleHeaderChange} />
                            <span className="whitespace-nowrap mx-2">PH : </span>
                            <input className="w-40 focus:outline-none border-b print:border-none border-gray-200" name="phone" value={header.phone} onChange={handleHeaderChange} />
                        </div>
                        <div className="flex items-center">
                            <span className="whitespace-nowrap">FSSAI.No. : </span>
                            <input className="w-full ml-1 focus:outline-none border-b print:border-none border-gray-200" name="fssai" value={header.fssai} onChange={handleHeaderChange} />
                            <span className="whitespace-nowrap mx-2">GSTIN No. : </span>
                            <input className="w-full ml-1 focus:outline-none border-b print:border-none border-gray-200" name="gstin" value={header.gstin} onChange={handleHeaderChange} />
                        </div>
                    </div>
                    <div className="w-1/2 pl-4 border-l print:border-black">
                        <table className="w-full mt-2 print:mt-0 text-left print:leading-tight">
                            <tbody>
                                <tr>
                                    <td className="w-12 pb-1 print:pb-0 whitespace-nowrap">No. :</td>
                                    <td className="w-[30%] pb-1 print:pb-0"><input className="w-full focus:outline-none border-b print:border-none border-gray-200" name="no" value={header.no} onChange={handleHeaderChange} placeholder="IR/..." /></td>
                                    <td className="w-12 pb-1 print:pb-0 pl-2 whitespace-nowrap">Date :</td>
                                    <td className="w-[30%] pb-1 print:pb-0"><input type="date" className="w-full focus:outline-none border-b print:border-none border-gray-200 print:text-[10px]" name="date" value={header.date} onChange={handleHeaderChange} /></td>
                                </tr>
                                <tr>
                                    <td className="w-[70px] pb-1 print:pb-0 whitespace-nowrap">Transport :</td>
                                    <td className="pb-1 print:pb-0"><input className="w-full focus:outline-none border-b print:border-none border-gray-200" name="transport" value={header.transport} onChange={handleHeaderChange} /></td>
                                    <td className="w-24 pb-1 print:pb-0 pl-2 whitespace-nowrap">No. of Cases :</td>
                                    <td className="pb-1 print:pb-0"><input className="w-full focus:outline-none border-b print:border-none border-gray-200" name="noOfCases" value={header.noOfCases} onChange={handleHeaderChange} /></td>
                                </tr>
                                <tr>
                                    <td className="w-16 pb-1 print:pb-0 whitespace-nowrap">L.R.No. :</td>
                                    <td className="pb-1 print:pb-0"><input className="w-full focus:outline-none border-b print:border-none border-gray-200" name="lrNo" value={header.lrNo} onChange={handleHeaderChange} /></td>
                                    <td className="w-24 pb-1 print:pb-0 pl-2 whitespace-nowrap">L.R.No. Date :</td>
                                    <td className="pb-1 print:pb-0"><input className="w-full focus:outline-none border-b print:border-none border-gray-200" name="lrNoDate" value={header.lrNoDate} onChange={handleHeaderChange} /></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <h2 className="text-center font-bold text-lg print:text-base underline mb-2 print:mb-1 tracking-widest">GST INVOICE</h2>

                {/* Products Table */}
                <div className="w-full overflow-x-auto min-h-[300px] print:min-h-0">
                    <table className="w-full border-collapse border border-black text-xs print:text-[10px]">
                        <thead>
                            <tr className="border-b border-black bg-gray-100 print:bg-transparent">
                                <th className="border-r border-black p-1 text-center w-8">Sl.No.</th>
                                <th className="border-r border-black p-1 text-left min-w-[150px]">Products</th>
                                <th className="border-r border-black p-1 text-center w-16">HSN</th>
                                <th className="border-r border-black p-1 text-center w-12">PACK</th>
                                <th className="border-r border-black p-1 text-center w-20">B.NO.</th>
                                <th className="border-r border-black p-1 text-center w-16">EXP.</th>
                                <th className="border-r border-black p-1 text-right w-16">Quantity</th>
                                <th className="border-r border-black p-1 text-right w-16">F. Qunt</th>
                                <th className="border-r border-black p-1 text-right w-16">MRP</th>
                                <th className="border-r border-black p-1 text-right w-16">PTR</th>
                                <th className={`border-r border-black p-1 text-right w-16 ${excludePts ? 'print:hidden' : ''}`}>PTS</th>
                                <th className="border-r border-black p-1 text-right w-12">GST%</th>
                                <th className="p-1 text-right w-24">Amount(Rs.)</th>
                                {!isReadOnly && <th className="print:hidden w-8"></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => (
                                <tr key={item.id} className="border-b border-gray-200 print:border-dotted print:border-gray-400 align-top">
                                    <td className="border-r border-black p-1 text-center">{index + 1}</td>
                                    <td className="border-r border-black p-0 relative">
                                        <select 
                                            className="w-full h-full p-1 focus:outline-none bg-transparent print:hidden"
                                            value={item.product}
                                            onChange={(e) => updateItem(index, 'product', e.target.value)}
                                        >
                                            <option value=""></option>
                                            {PRODUCT_NAMES.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                        <div className="hidden print:block p-1 text-left uppercase whitespace-normal">
                                            {item.product}
                                        </div>
                                    </td>
                                    <td className="border-r border-black p-0"><input className="w-full text-center focus:outline-none bg-transparent" value={item.hsn} onChange={(e) => updateItem(index, 'hsn', e.target.value)} /></td>
                                    <td className="border-r border-black p-0"><input className="w-full text-center focus:outline-none bg-transparent" value={item.pack} onChange={(e) => updateItem(index, 'pack', e.target.value)} /></td>
                                    <td className="border-r border-black p-0 relative">
                                        <select 
                                            className="w-full h-full p-1 focus:outline-none bg-transparent print:hidden"
                                            value={item.bno}
                                            onChange={(e) => updateItem(index, 'bno', e.target.value)}
                                        >
                                            <option value=""></option>
                                            {availableStocks
                                                .filter(s => s.productName === item.product && s.closingQuantity > 0)
                                                .map(s => (
                                                    <option key={s.id} value={s.batchNo}>
                                                        {s.batchNo} ({s.closingQuantity})
                                                    </option>
                                                ))
                                            }
                                        </select>
                                        <div className="hidden print:block p-1 text-center uppercase">
                                            {item.bno}
                                        </div>
                                    </td>
                                    <td className="border-r border-black p-0"><input className="w-full text-center focus:outline-none bg-transparent" value={item.exp} onChange={(e) => updateItem(index, 'exp', e.target.value)} placeholder="MM/YY" /></td>
                                    <td className="border-r border-black p-0"><input type="number" className="w-full text-right p-1 focus:outline-none bg-transparent" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} /></td>
                                    <td className="border-r border-black p-0"><input type="number" className="w-full text-right p-1 focus:outline-none bg-transparent" value={item.fQunt} onChange={(e) => updateItem(index, 'fQunt', e.target.value)} /></td>
                                    <td className="border-r border-black p-0"><input type="number" step="0.01" className="w-full text-right p-1 focus:outline-none bg-transparent" value={item.mrp} onChange={(e) => updateItem(index, 'mrp', e.target.value)} /></td>
                                    <td className="border-r border-black p-0"><input type="number" step="0.01" className="w-full text-right p-1 focus:outline-none bg-indigo-50 print:bg-transparent" value={(item.ptr || 0).toFixed(2)} onChange={(e) => updateItem(index, 'ptr', e.target.value)} /></td>
                                    <td className={`border-r border-black p-0 ${excludePts ? 'print:hidden' : ''}`}><input type="number" step="0.01" className="w-full text-right p-1 focus:outline-none bg-indigo-50 print:bg-transparent" value={(item.pts || 0).toFixed(2)} onChange={(e) => updateItem(index, 'pts', e.target.value)} /></td>
                                    <td className="border-r border-black p-0"><input type="number" className="w-full text-right p-1 focus:outline-none bg-transparent" value={item.gstPercent} onChange={(e) => updateItem(index, 'gstPercent', e.target.value)} /></td>
                                    <td className="p-0 border-r border-black print:border-none"><input type="number" step="0.01" className="w-full text-right p-1 font-bold focus:outline-none bg-indigo-50 print:bg-transparent" value={(item.amount || 0).toFixed(2)} onChange={(e) => updateItem(index, 'amount', e.target.value)} /></td>
                                    {!isReadOnly && (
                                        <td className="print:hidden text-center">
                                            <button onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700 w-full font-bold">X</button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {!isReadOnly && (
                    <div className="print:hidden mt-2 mb-4">
                        <button onClick={addItem} className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded border border-blue-200 hover:bg-blue-100">+ Add Row</button>
                    </div>
                )}

                {/* Optional Page Break spacer */}
                {items.length > 7 && <div className="page-break hidden print:block"></div>}

                {/* Footer Section */}
                <div className={`border border-black flex text-xs ${items.length > 7 ? 'border-t print:mt-8' : 'border-t-0'}`}>
                    {/* Terms & Conditions */}
                    <div className="w-2/3 border-r border-black p-2 flex flex-col justify-between">
                        <div className="text-[10px] leading-tight">
                            <p>TERMS : 1. Genral Warrenty : U/s 19(3) of the Drug & Cosmetics Act 1940. We hereby given this warrenty that the goods specified and contained in this invoice do not contravene in any way the provision of Sec. 18 of the Drug & Cosmetics Act 1940.</p>
                            <p>2. Subject to Bhubneshwar & Delhi Jurisdictionn Only.</p>
                        </div>
                        <div className="mt-4 font-bold border-t border-dotted border-gray-400 pt-2">
                            <p>Amount in Words : {numberToWords(totals.netTotal) || 'ZERO'}</p>
                            <p className="mt-2">REMARKS : <input className="focus:outline-none border-b print:border-none w-64" /></p>
                        </div>
                    </div>
                    {/* Calculations */}
                    <div className="w-1/3">
                        <table className="w-full font-bold text-right">
                            <tbody>
                                <tr className="border-b print:border-dotted border-gray-300">
                                    <td className="p-1 border-r border-black" colSpan="2">Total :</td>
                                    <td className="p-1 w-24">{totals.total.toFixed(2)}</td>
                                </tr>
                                <tr className="border-b print:border-dotted border-gray-300">
                                    <td className="p-1 text-left">Less : DIST. DIS.</td>
                                    <td className="p-1 border-r border-black flex justify-end items-center"><input type="number" step="0.1" name="distDisPercent" value={footer.distDisPercent} onChange={handleFooterChange} className="w-12 text-right focus:outline-none print:hidden bg-indigo-50 border-b border-indigo-200" /><span className="hidden print:inline">{footer.distDisPercent}</span> %</td>
                                    <td className="p-1">{totals.distDis.toFixed(2)}</td>
                                </tr>
                                <tr className="border-b border-black">
                                    <td className="p-1 border-r border-black" colSpan="2">G.TOTAL</td>
                                    <td className="p-1">{totals.gTotal.toFixed(2)}</td>
                                </tr>
                                <tr className="border-b print:border-dotted border-gray-300">
                                    <td className="p-1 text-left">Add : SGST</td>
                                    <td className="p-1 border-r border-black flex justify-end items-center"><input type="number" step="0.1" name="sgstPercent" value={footer.sgstPercent} onChange={handleFooterChange} className="w-12 text-right focus:outline-none print:hidden bg-indigo-50 border-b border-indigo-200" /><span className="hidden print:inline">{footer.sgstPercent}</span> %</td>
                                    <td className="p-1">{totals.sgst.toFixed(2)}</td>
                                </tr>
                                <tr className="border-b print:border-dotted border-gray-300">
                                    <td className="p-1 text-left">Add : CGST</td>
                                    <td className="p-1 border-r border-black flex justify-end items-center"><input type="number" step="0.1" name="cgstPercent" value={footer.cgstPercent} onChange={handleFooterChange} className="w-12 text-right focus:outline-none print:hidden bg-indigo-50 border-b border-indigo-200" /><span className="hidden print:inline">{footer.cgstPercent}</span> %</td>
                                    <td className="p-1">{totals.cgst.toFixed(2)}</td>
                                </tr>
                                <tr className="border-b border-black">
                                    <td className="p-1 text-left">Add : IGST</td>
                                    <td className="p-1 border-r border-black flex justify-end items-center"><input type="number" step="0.1" name="igstPercent" value={footer.igstPercent} onChange={handleFooterChange} className="w-12 text-right focus:outline-none print:hidden bg-indigo-50 border-b border-indigo-200" /><span className="hidden print:inline">{footer.igstPercent}</span> %</td>
                                    <td className="p-1">{totals.igst.toFixed(2)}</td>
                                </tr>
                                <tr className="border-b border-black">
                                    <td className="p-1 border-r border-black" colSpan="2">SUB TOTAL</td>
                                    <td className="p-1">{totals.subTotal.toFixed(2)}</td>
                                </tr>
                                <tr className="border-b border-black">
                                    <td className="p-1 border-r border-black" colSpan="2">R/O</td>
                                    <td className="p-1">{(totals.ro > 0 ? "+" : "")}{totals.ro.toFixed(2)}</td>
                                </tr>
                                <tr className="bg-gray-100 print:bg-transparent">
                                    <td className="p-2 border-r border-black" colSpan="2">NET TOTAL AMOUNT :</td>
                                    <td className="p-2">{totals.netTotal.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Signatures */}
                <div className="flex justify-between p-4 pt-12 items-end border border-t-0 border-black text-xs font-bold">
                    <div className="text-center w-1/3">
                        <p>Received above goods in good order & condition</p>
                        <p className="mt-8 pt-2 border-t border-black inline-block px-4">Signature of Receiver</p>
                    </div>
                    <div className="text-center w-1/3">
                        <p className="mb-8">E.& O.E.</p>
                    </div>
                    <div className="text-center w-1/3">
                        <p className="mb-8">FOR INTEGRITAS RESEARCH</p>
                        <p className="border-t border-black inline-block px-4 pt-2">Authorized Signatory</p>
                    </div>
                </div>

            </div>
        </DashboardLayout>
    );
}
