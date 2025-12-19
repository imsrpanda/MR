import React from 'react';

export default function Card({ children, className = '', ...props }) {
    return (
        <div className={`bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden ${className}`} {...props}>
            {children}
        </div>
    );
}
