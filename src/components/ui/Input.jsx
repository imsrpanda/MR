import React from 'react';

export default function Input({ label, error, className = '', ...props }) {
    return (
        <div className={`w-full ${className}`}>
            {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
            <input
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                    }`}
                {...props}
            />
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
    );
}
