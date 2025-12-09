import React from 'react';

export default function Button({ children, variant = 'primary', className = '', ...props }) {
    const baseStyles = "px-4 py-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
        primary: "bg-[#1776bf] text-[#ffffff] font-bold hover:bg-[#156aac] focus:ring-[#1776bf] shadow-lg shadow-indigo-500/30",
        secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-indigo-500",
        danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-lg shadow-red-500/30",
        ghost: "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}
