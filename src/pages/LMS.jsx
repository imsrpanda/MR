import React, { useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import LeaveApplicationForm from '../components/lms/LeaveApplicationForm';
import LeaveList from '../components/lms/LeaveList';
import QuotaManager from '../components/lms/QuotaManager';
import Card from '../components/ui/Card';

export default function LMS() {
    const { userRole } = useAuth();
    const [activeTab, setActiveTab] = useState('apply');

    const tabs = [
        { id: 'apply', label: 'Apply Leave', roles: ['user'] },
        { id: 'my-leaves', label: 'My Leaves', roles: ['user'] },
        { id: 'manage-leaves', label: 'Manage Leaves', roles: ['admin'] },
        { id: 'quotas', label: 'Manage Quotas', roles: ['admin'] },
    ];

    const allowedTabs = tabs.filter(tab => tab.roles.includes(userRole));

    // Redirect if active tab is not allowed
    if (!allowedTabs.find(tab => tab.id === activeTab) && allowedTabs.length > 0) {
        setActiveTab(allowedTabs[0].id);
    }

    return (
        <DashboardLayout title="Leave Management System">
            <div className="space-y-6">
                {/* Tabs */}
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-4 overflow-x-auto p-2" aria-label="Tabs">
                        {allowedTabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    whitespace-nowrap py-3 px-6 border-b-2 font-medium text-sm transition-all duration-200 rounded-t-lg
                                    active:scale-95 transform
                                    ${activeTab === tab.id
                                        ? 'border-indigo-500 text-indigo-700 bg-indigo-50'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}
                                `}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Content */}
                <div className="mt-6">
                    {activeTab === 'apply' && (
                        <div className="max-w-2xl">
                            <LeaveApplicationForm onSuccess={() => setActiveTab('my-leaves')} />
                        </div>
                    )}

                    {activeTab === 'my-leaves' && (
                        <LeaveList mode="my-leaves" />
                    )}

                    {activeTab === 'manage-leaves' && (
                        <LeaveList mode="manage" />
                    )}

                    {activeTab === 'quotas' && (
                        <QuotaManager />
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
