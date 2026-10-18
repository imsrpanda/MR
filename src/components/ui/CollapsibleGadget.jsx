import React from 'react';
import Card from './Card';

export default function CollapsibleGadget({
    title,
    subtitle,
    icon,
    badge,
    isOpen,
    onToggle,
    isLoading = false,
    onRefresh,
    borderAccent = 'border-indigo-500',
    headerActions,
    children,
    className = 'mb-6',
    lazyPrompt = 'Click to expand and load data on demand'
}) {
    return (
        <Card className={`border-l-4 ${borderAccent} bg-white/70 backdrop-blur-lg shadow-lg border-white/60 transition-all duration-200 overflow-hidden ${className}`}>
            <div 
                className={`p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 cursor-pointer select-none transition-colors ${
                    isOpen ? 'border-b border-gray-100/60 bg-white/50' : 'hover:bg-white/60'
                }`}
                onClick={onToggle}
            >
                <div className="flex items-center gap-3">
                    {icon && (
                        <div className="w-10 h-10 rounded-xl bg-indigo-50/80 flex items-center justify-center text-xl shadow-xs shrink-0">
                            {icon}
                        </div>
                    )}
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">{title}</h3>
                            {badge && (
                                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border shadow-2xs ${badge.colorClass || 'bg-indigo-50 text-indigo-700 border-indigo-100'}`}>
                                    {badge.text || badge}
                                </span>
                            )}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                            {isOpen ? subtitle : (subtitle ? `${subtitle} • ${lazyPrompt}` : lazyPrompt)}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0" onClick={(e) => e.stopPropagation()}>
                    {headerActions}
                    
                    {onRefresh && isOpen && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRefresh();
                            }}
                            disabled={isLoading}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-gray-600 hover:text-indigo-600 hover:bg-white rounded-lg border border-gray-200 text-xs font-medium transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                            title="Re-fetch fresh data from server"
                        >
                            <span className={isLoading ? 'animate-spin inline-block' : ''}>🔄</span>
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={onToggle}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-2xs cursor-pointer ${
                            isOpen 
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                                : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'
                        }`}
                    >
                        <span>{isOpen ? 'Collapse' : 'Expand & Load'}</span>
                        <span className={`transform transition-transform duration-200 text-[10px] ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                </div>
            </div>

            {isOpen && (
                <div className="p-4 sm:p-6 transition-all duration-200">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                            <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                            <span className="text-sm font-medium">Fetching on demand from Firebase...</span>
                            <span className="text-xs text-gray-400 mt-1">Response will be cached for this session</span>
                        </div>
                    ) : (
                        children
                    )}
                </div>
            )}
        </Card>
    );
}
