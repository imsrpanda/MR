import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase/firebase';
import Card from '../ui/Card';
import Button from '../ui/Button';

import ColorfulText from '../ui/ColorfulText';

export default function DashboardLayout({ children, title, backgroundClass = "bg-gray-50" }) {
    const { userRole, currentUser, userData } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogout = async () => {
        await signOut(auth);
        navigate('/login');
    };

    const navItems = [
        { label: 'Super Admin', path: '/super-admin', roles: ['super_admin'] },
        { label: 'Admin', path: '/admin', roles: ['admin'] },
        { label: 'Bills', path: '/bills', roles: ['admin'] },
        { label: 'Dashboard', path: '/dashboard', roles: ['user'] },
        { label: 'Master', path: '/master', roles: ['admin', 'user'] },
        { label: 'DCR', path: '/dcr', roles: ['admin', 'user'] },
        { label: 'LMS', path: '/lms', roles: ['admin', 'user'] },
    ];

    const NavContent = () => (
        <>
            <div className="p-6 border-b border-gray-100/50 bg-white/50 backdrop-blur-sm">
                <h2 className="text-2xl font-bold"><ColorfulText text="Integritas MR" /></h2>
                <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider">{userRole}</p>
            </div>
            <div className="p-4 border-b border-gray-100/50 bg-gray-50/50 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-3 px-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold overflow-hidden">
                        {userData?.photoURL ? (
                            <img src={userData.photoURL} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            currentUser?.email?.[0].toUpperCase()
                        )}
                    </div>
                    <div className="overflow-hidden flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                            <p className="text-sm font-medium text-gray-900 truncate" title={currentUser?.email}>
                                {currentUser?.email}
                            </p>
                            <button
                                onClick={() => {
                                    navigate('/profile');
                                    setIsMobileMenuOpen(false);
                                }}
                                className="text-gray-400 hover:text-indigo-600 p-1 rounded-full hover:bg-gray-200 transition-colors"
                                title="Edit Profile"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                            </button>
                        </div>
                        <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wide">
                            {userRole?.replace('_', ' ')}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-100 bg-white/80 border border-gray-200 rounded-lg transition-colors text-left flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                </button>
            </div>
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                    if (!item.roles.includes(userRole)) return null;
                    return (
                        <button
                            key={item.path}
                            onClick={() => {
                                navigate(item.path);
                                setIsMobileMenuOpen(false);
                            }}
                            className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${location.pathname === item.path ? 'bg-indigo-50/80 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50/80'
                                }`}
                        >
                            {item.label}
                        </button>
                    );
                })}
            </nav>
        </>
    );

    return (
        <div className={`min-h-screen print:min-h-0 print:h-auto print:block flex ${backgroundClass}`}>
            {/* Desktop Sidebar */}
            <aside className="print:hidden w-64 bg-white border-r border-gray-200 hidden md:flex flex-col">
                <NavContent />
            </aside>

            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-40 md:hidden">
                    {/* Backdrop */}
                    <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setIsMobileMenuOpen(false)} />
                    {/* Sidebar */}
                    <aside className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl flex flex-col z-50">
                        <NavContent />
                    </aside>
                </div>
            )}

            {/* Mobile Header */}
            <div className="flex-1 flex flex-col min-w-0 print:block print:w-full print:flex-none">
                <header className="print:hidden bg-white shadow-sm border-b border-gray-200 md:hidden flex items-center justify-between p-4 sticky top-0 z-30">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsMobileMenuOpen(true)} className="text-gray-500 hover:text-gray-700 focus:outline-none">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <h1 className="text-lg font-bold"><ColorfulText text="Integritas MR" /></h1>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 p-4 md:p-8 overflow-y-auto print:overflow-visible print:block print:p-0">
                    <div className="max-w-7xl mx-auto">
                        {title && <h1 className="print:hidden text-xl md:text-3xl font-bold text-gray-900 mb-6 md:mb-8">{title}</h1>}
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
