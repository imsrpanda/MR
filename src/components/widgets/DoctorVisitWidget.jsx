import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import Card from '../ui/Card';

const ITEMS_PER_PAGE = 10;

export default function DoctorVisitWidget() {
    const [doctorVisits, setDoctorVisits] = useState([]);
    const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
    const [loading, setLoading] = useState(true);
    const printRef = useRef(null);

    useEffect(() => {
        // Subscribe to Visits with status "Visited"
        const qVisits = query(collection(db, "visits"), where("status", "==", "Visited"));
        const unsubscribe = onSnapshot(qVisits, (snapshot) => {
            // Create a map to count visits per doctor
            const doctorCountMap = {};
            const doctorNameMap = {}; // Store doctor names and types

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const doctorId = data.docId || data.id; // Use docId if available
                const doctorName = data.name || 'Unknown Doctor';
                const doctorType = data.type || 'Doctor';

                if (doctorId) {
                    doctorCountMap[doctorId] = (doctorCountMap[doctorId] || 0) + 1;
                    doctorNameMap[doctorId] = {
                        name: doctorName,
                        type: doctorType
                    };
                } else if (doctorName && doctorName !== 'Unknown Doctor') {
                    // Fallback: use doctor name as key if docId is not available
                    doctorCountMap[doctorName] = (doctorCountMap[doctorName] || 0) + 1;
                    doctorNameMap[doctorName] = {
                        name: doctorName,
                        type: doctorType
                    };
                }
            });

            // Convert to array, sort by count (descending), and set state
            const sortedDoctors = Object.entries(doctorCountMap)
                .map(([id, count]) => ({
                    id,
                    name: doctorNameMap[id]?.name || id,
                    type: doctorNameMap[id]?.type || 'Doctor',
                    visitCount: count
                }))
                .sort((a, b) => b.visitCount - a.visitCount);

            setDoctorVisits(sortedDoctors);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const displayedDoctors = doctorVisits.slice(0, displayCount);
    const hasMore = displayCount < doctorVisits.length;

    const handleShowMore = () => {
        setDisplayCount(prev => prev + ITEMS_PER_PAGE);
    };

    const handlePrint = () => {
        if (!printRef.current) return;
        
        const printWindow = window.open('', '_blank');
        const printContent = printRef.current.innerHTML;
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Doctor Visits Report</title>
                <style>
                    body {
                        font-family: 'Arial', sans-serif;
                        margin: 20px;
                        color: #333;
                    }
                    h1 {
                        text-align: center;
                        color: #1f2937;
                        margin-bottom: 10px;
                        font-size: 24px;
                    }
                    .report-info {
                        text-align: center;
                        color: #666;
                        margin-bottom: 20px;
                        font-size: 12px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }
                    th {
                        background-color: #f3f4f6;
                        padding: 12px;
                        text-align: left;
                        font-weight: 600;
                        border-bottom: 2px solid #d1d5db;
                        font-size: 13px;
                        text-transform: uppercase;
                    }
                    td {
                        padding: 12px;
                        border-bottom: 1px solid #e5e7eb;
                        font-size: 13px;
                    }
                    tr:last-child td {
                        border-bottom: 2px solid #d1d5db;
                    }
                    .rank {
                        text-align: center;
                        font-weight: 600;
                        color: #e11d48;
                    }
                    .type-doctor {
                        background-color: #dbeafe;
                        color: #1e40af;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 11px;
                        font-weight: 600;
                    }
                    .type-chemist {
                        background-color: #dcfce7;
                        color: #166534;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 11px;
                        font-weight: 600;
                    }
                    .visits {
                        text-align: right;
                        font-weight: bold;
                        color: #be123c;
                        font-size: 14px;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 30px;
                        color: #999;
                        font-size: 11px;
                        border-top: 1px solid #e5e7eb;
                        padding-top: 15px;
                    }
                    @media print {
                        body {
                            margin: 0;
                            padding: 10mm;
                        }
                    }
                </style>
            </head>
            <body>
                <h1>👨‍⚕️ Doctor Visits Report</h1>
                <div class="report-info">
                    Generated on ${new Date().toLocaleString()}
                </div>
                ${printContent}
                <div class="footer">
                    <p>This is an auto-generated report from Integritas MR System</p>
                </div>
            </body>
            </html>
        `);
        
        printWindow.document.close();
        setTimeout(() => {
            printWindow.print();
        }, 250);
    };

    if (loading) {
        return (
            <Card className="p-6 mb-8 bg-white/60 backdrop-blur-lg shadow-lg border-white/50 border-l-4 border-rose-500">
                <div className="flex items-center justify-center h-40">
                    <div className="text-gray-500">Loading doctor visit data...</div>
                </div>
            </Card>
        );
    }

    if (doctorVisits.length === 0) {
        return (
            <Card className="p-6 mb-8 bg-white/60 backdrop-blur-lg shadow-lg border-white/50 border-l-4 border-rose-500">
                <div className="flex items-center justify-center h-40">
                    <div className="text-gray-500">No doctor visit data available yet.</div>
                </div>
            </Card>
        );
    }

    return (
        <Card className="p-0 overflow-hidden flex flex-col mb-8 border-l-4 border-rose-500 bg-white/60 backdrop-blur-lg shadow-lg border-white/50">
            {/* Header */}
            <div className="p-6 border-b border-gray-100/50 flex justify-between items-center bg-gradient-to-r from-rose-50 to-pink-50/30">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <span className="text-2xl">👨‍⚕️</span>
                        Doctor Visits Summary
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">Top doctors by visit frequency</p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg"
                        title="Print as PDF"
                    >
                        <span className="text-lg">🖨️</span>
                        <span className="hidden sm:inline">Print</span>
                    </button>
                    <div className="text-right">
                        <p className="text-2xl font-bold text-rose-600">{doctorVisits.length}</p>
                        <p className="text-xs text-gray-500">Total Doctors</p>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto" ref={printRef}>
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50/50 text-gray-500 uppercase border-b border-gray-100/50">
                        <tr>
                            <th className="px-6 py-3 font-medium">Rank</th>
                            <th className="px-6 py-3 font-medium">Doctor Name</th>
                            <th className="px-6 py-3 font-medium">Type</th>
                            <th className="px-6 py-3 font-medium text-right">Visits</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {displayedDoctors.map((doctor, index) => (
                            <tr
                                key={doctor.id}
                                className="hover:bg-white/40 transition-colors"
                            >
                                <td className="px-6 py-4">
                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-rose-100 text-rose-600 font-semibold text-xs">
                                        {index + 1}
                                    </div>
                                </td>
                                <td className="px-6 py-4 font-medium text-gray-900">
                                    {doctor.name}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        doctor.type === 'Doctor'
                                            ? 'bg-blue-100 text-blue-800'
                                            : doctor.type === 'Chemist'
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-gray-100 text-gray-800'
                                    }`}>
                                        {doctor.type}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <span className="font-bold text-rose-600 text-lg">
                                            {doctor.visitCount}
                                        </span>
                                        <div className="w-16 bg-gray-200 rounded-full h-2 overflow-hidden">
                                            <div
                                                className="bg-gradient-to-r from-rose-400 to-pink-500 h-full rounded-full transition-all duration-300"
                                                style={{
                                                    width: `${(doctor.visitCount / displayedDoctors[0].visitCount) * 100}%`
                                                }}
                                            />
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Show More Button */}
            {hasMore && (
                <div className="p-4 border-t border-gray-100/50 text-center bg-gray-50/30">
                    <button
                        onClick={handleShowMore}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                        <span>Show More</span>
                        <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                            {displayCount}/{doctorVisits.length}
                        </span>
                    </button>
                </div>
            )}

            {/* Footer Info */}
            {!hasMore && doctorVisits.length > ITEMS_PER_PAGE && (
                <div className="p-4 border-t border-gray-100/50 text-center text-xs text-gray-500 bg-gray-50/30">
                    Showing all {doctorVisits.length} doctors
                </div>
            )}
        </Card>
    );
}
