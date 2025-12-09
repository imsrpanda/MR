import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import Button from '../ui/Button';
import Card from '../ui/Card';
import ColorfulText from '../ui/ColorfulText';

const LEAVE_TYPES = [
    { value: 'sick', label: 'Sick Leave', color: 'text-red-600', bg: 'bg-red-50' },
    { value: 'casual', label: 'Casual Leave', color: 'text-blue-600', bg: 'bg-blue-50' },
    { value: 'earned', label: 'Earned Leave', color: 'text-green-600', bg: 'bg-green-50' },
    { value: 'unpaid', label: 'Unpaid Leave', color: 'text-gray-600', bg: 'bg-gray-50' },
];

export default function LeaveApplicationForm({ onSuccess }) {
    const { currentUser, userData } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [quotas, setQuotas] = useState({});

    const [formData, setFormData] = useState({
        type: 'sick',
        startDate: '',
        endDate: '',
        reason: ''
    });

    useEffect(() => {
        if (userData?.leaveQuota) {
            setQuotas(userData.leaveQuota);
        }
    }, [userData]);

    const calculateDays = (start, end) => {
        if (!start || !end) return 0;
        const startDate = new Date(start);
        const endDate = new Date(end);
        const diffTime = Math.abs(endDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return diffDays > 0 ? diffDays : 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const days = calculateDays(formData.startDate, formData.endDate);
            if (days <= 0) throw new Error("End date must be after start date");

            if (formData.type !== 'unpaid') {
                const available = quotas[formData.type] || 0;
                if (days > available) {
                    throw new Error(`Insufficient ${formData.type} leave balance. Available: ${available} days.`);
                }
            }

            await addDoc(collection(db, 'leaves'), {
                userId: currentUser.uid,
                userEmail: currentUser.email,
                userName: userData?.name || currentUser.email,
                type: formData.type,
                startDate: formData.startDate,
                endDate: formData.endDate,
                days: days,
                reason: formData.reason,
                status: 'pending',
                createdAt: serverTimestamp()
            });

            setFormData({
                type: 'sick',
                startDate: '',
                endDate: '',
                reason: ''
            });

            if (onSuccess) onSuccess();

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const daysRequested = calculateDays(formData.startDate, formData.endDate);

    return (
        <div className="transform transition-all duration-300 md:hover:scale-[1.01]">
            <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-gray-100">
                <div className="relative mb-6">
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-indigo-50 rounded-full blur-2xl opacity-50"></div>
                    <h3 className="text-xl font-bold text-gray-900 relative z-10">
                        <ColorfulText text="Apply for Leave" />
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">Submit your leave request for approval</p>
                </div>

                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-r-md text-sm mb-6 animate-pulse">
                        <p className="font-bold">Error</p>
                        <p>{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6 p-4 sm:p-6">
                    {/* Leave Type Selection */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Select Leave Type</label>
                        <div className="relative">
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className="w-full rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white focus:border-indigo-500 focus:ring-indigo-500 transition-all shadow-sm py-3 px-4 appearance-none"
                            >
                                {LEAVE_TYPES.map(type => (
                                    <option key={type.value} value={type.value}>
                                        {type.label} (Available: {quotas[type.value] || 0} days)
                                    </option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Date Selection */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <div className="group">
                            <label className="block text-sm font-medium text-gray-700 mb-1 group-focus-within:text-indigo-600 transition-colors">Start Date</label>
                            <input
                                type="date"
                                required
                                value={formData.startDate}
                                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                className="w-full rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white focus:border-indigo-500 focus:ring-indigo-500 transition-all shadow-sm py-2.5"
                            />
                        </div>
                        <div className="group">
                            <label className="block text-sm font-medium text-gray-700 mb-1 group-focus-within:text-indigo-600 transition-colors">End Date</label>
                            <input
                                type="date"
                                required
                                value={formData.endDate}
                                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                className="w-full rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white focus:border-indigo-500 focus:ring-indigo-500 transition-all shadow-sm py-2.5"
                            />
                        </div>
                    </div>

                    {/* Duration Summary */}
                    <div className={`
                        rounded-lg p-4 transition-all duration-300
                        ${daysRequested > 0 ? 'bg-indigo-50 opacity-100 translate-y-0' : 'bg-transparent opacity-0 -translate-y-2 h-0 p-0 overflow-hidden'}
                    `}>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-indigo-900">Total Duration</span>
                            <span className="text-lg font-bold text-indigo-600">{daysRequested} Days</span>
                        </div>
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Leave</label>
                        <textarea
                            required
                            rows={3}
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            className="w-full rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white focus:border-indigo-500 focus:ring-indigo-500 transition-all shadow-sm resize-none"
                            placeholder="Please provide a detailed reason..."
                        />
                    </div>

                    {/* Submit Button */}
                    <div className="pt-2">
                        <Button
                            type="submit"
                            loading={loading}
                            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transform hover:-translate-y-0.5 transition-all shadow-md hover:shadow-lg"
                        >
                            Submit Application
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
}
