import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function PublicBillView() {
    const { id } = useParams();
    const [billData, setBillData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const fetchBill = async () => {
            try {
                const docRef = doc(db, 'bills', id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setBillData(docSnap.data());
                } else {
                    setError(true);
                }
            } catch (err) {
                console.error("Error fetching bill", err);
                setError(true);
            } finally {
                setLoading(false);
            }
        };
        fetchBill();
    }, [id]);

    if (loading) return (
        <div className="flex justify-center items-center h-screen bg-gray-50">
            <div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
        </div>
    );
    
    if (error || !billData) return (
        <div className="flex flex-col justify-center items-center h-screen bg-gray-50 text-center p-8">
            <h1 className="text-3xl font-bold text-red-500 mb-4">Invoice Not Found</h1>
            <p className="text-gray-600">The invoice you are looking for does not exist or the link is invalid.</p>
        </div>
    );

    const { header, items, totals, footer } = billData;

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-8 flex justify-center">
            <div className="bg-white shadow-xl rounded-lg w-full max-w-4xl overflow-hidden">
                {/* Clean beautiful header */}
                <div className="bg-indigo-600 text-white p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">INTEGRITAS RESEARCH</h1>
                        <p className="text-indigo-200 text-sm mt-1">GST INVOICE</p>
                    </div>
                    <div className="md:text-right">
                        <p className="text-xl md:text-2xl font-bold">Amt: ₹{totals.netTotal.toLocaleString('en-IN')}</p>
                        <p className="text-indigo-200 text-sm">Date: {header.date}</p>
                    </div>
                </div>

                <div className="p-6 md:p-8">
                    {/* Bill To & Details */}
                    <div className="flex flex-col md:flex-row justify-between gap-8 mb-8 border-b pb-8">
                        <div>
                            <h3 className="text-gray-500 uppercase text-xs font-bold tracking-wider mb-2">Billed To</h3>
                            <p className="font-bold text-lg text-gray-900 uppercase">{header.name}</p>
                            <p className="text-gray-600 uppercase text-sm mt-1">{header.address1}</p>
                            <p className="text-gray-600 uppercase text-sm">{header.address2}</p>
                            {header.phone && <p className="text-gray-600 mt-2 text-sm text-gray-800 font-medium">Ph: {header.phone}</p>}
                            <div className="mt-3 text-xs text-gray-500 bg-gray-50 p-3 rounded">
                                {header.gstin && <p><strong>GSTIN:</strong> {header.gstin}</p>}
                                {header.fssai && <p><strong>FSSAI:</strong> {header.fssai}</p>}
                            </div>
                        </div>
                        <div className="md:text-right">
                            <h3 className="text-gray-500 uppercase text-xs font-bold tracking-wider mb-2">Invoice Details</h3>
                            <div className="text-sm bg-gray-50 p-4 rounded inline-block text-left w-full md:w-auto">
                                <p className="text-gray-800 mb-1"><span className="text-gray-500 w-20 inline-block">Invoice No:</span><span className="font-bold">{header.no}</span></p>
                                <p className="text-gray-800 mb-1"><span className="text-gray-500 w-20 inline-block">Transport:</span>{header.transport || '-'}</p>
                                <p className="text-gray-800 mb-1"><span className="text-gray-500 w-20 inline-block">LR No:</span>{header.lrNo || '-'}</p>
                                <p className="text-gray-800"><span className="text-gray-500 w-20 inline-block">Cases:</span>{header.noOfCases || '-'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="overflow-x-auto mb-8 rounded-lg border border-gray-200">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Sl</th>
                                    <th className="px-4 py-3 font-medium">Product</th>
                                    <th className="px-4 py-3 font-medium text-center">Batch/Exp</th>
                                    <th className="px-4 py-3 font-medium text-right">Qty</th>
                                    <th className="px-4 py-3 font-medium text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {items.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-normal min-w-[200px]">
                                            {item.product}
                                            <div className="text-xs text-gray-500 mt-1">
                                                HSN: {item.hsn} | Pack: {item.pack} | MRP: {item.mrp}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center text-gray-500 uppercase">
                                            {item.bno || '-'}<br/>
                                            <span className="text-xs mt-1 block">{item.exp}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {item.quantity}
                                            {item.fQunt > 0 && <span className="text-xs text-green-600 block mt-1">+{item.fQunt} Free</span>}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-gray-900 text-base">₹{(item.amount || 0).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Totals Section */}
                    <div className="flex flex-col md:flex-row justify-between gap-8">
                         <div className="w-full md:w-1/2 p-4 bg-gray-50 rounded-lg text-xs text-gray-600 self-start">
                             <p className="font-bold text-gray-900 mb-2">Terms & Conditions:</p>
                             <p>1. General Warranty: U/s 19(3) of the Drug & Cosmetics Act 1940. We hereby given this warranty that the goods specified and contained in this invoice do not contravene in any way the provision of Sec. 18 of the Drug & Cosmetics Act 1940.</p>
                             <p className="mt-2 text-red-500 font-medium">2. Subject to Bhubaneswar & Delhi Jurisdiction Only.</p>
                         </div>
                         <div className="w-full md:w-1/3">
                             <div className="space-y-3 text-sm">
                                 <div className="flex justify-between text-gray-600">
                                     <span>Subtotal</span>
                                     <span>₹{totals.total.toFixed(2)}</span>
                                 </div>
                                 <div className="flex justify-between text-red-500">
                                     <span>Dist. Discount ({footer.distDisPercent}%)</span>
                                     <span>- ₹{totals.distDis.toFixed(2)}</span>
                                 </div>
                                 <div className="flex justify-between text-gray-600">
                                     <span>SGST ({footer.sgstPercent}%)</span>
                                     <span>+ ₹{totals.sgst.toFixed(2)}</span>
                                 </div>
                                 <div className="flex justify-between text-gray-600">
                                     <span>CGST ({footer.cgstPercent}%)</span>
                                     <span>+ ₹{totals.cgst.toFixed(2)}</span>
                                 </div>
                                 {footer.igstPercent > 0 && (
                                     <div className="flex justify-between text-gray-600">
                                         <span>IGST ({footer.igstPercent}%)</span>
                                         <span>+ ₹{totals.igst.toFixed(2)}</span>
                                     </div>
                                 )}
                                 <div className="flex justify-between border-t-2 border-indigo-200 pt-3 text-xl font-black text-indigo-700">
                                     <span>Net Total</span>
                                     <span>₹{totals.netTotal.toFixed(2)}</span>
                                 </div>
                             </div>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
