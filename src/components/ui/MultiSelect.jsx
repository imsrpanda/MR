import React, { useState, useRef, useEffect } from 'react';

export default function MultiSelect({ label, options, value = [], onChange, disabled = false, placeholder = "Select items..." }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (option) => {
        if (!value.includes(option)) {
            onChange([...value, option]);
        }
        setIsOpen(false);
    };

    const handleRemove = (optionToRemove) => {
        onChange(value.filter(item => item !== optionToRemove));
    };

    const availableOptions = options.filter(opt => !value.includes(opt));

    return (
        <div className="w-full relative" ref={containerRef}>
            {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}

            <div
                className={`min-h-[42px] w-full px-3 py-2 border border-gray-300 rounded-lg bg-white flex flex-wrap gap-2 items-center cursor-pointer transition-all ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'hover:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500'}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                {value.length === 0 && <span className="text-gray-500 text-sm">{placeholder}</span>}

                {value.map((item) => (
                    <span key={item} className="inline-flex items-center px-2 py-1 rounded bg-indigo-100 text-indigo-800 text-sm border border-indigo-200">
                        {item}
                        {!disabled && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemove(item);
                                }}
                                className="ml-1 text-indigo-600 hover:text-indigo-900 focus:outline-none rounded-full p-0.5 hover:bg-indigo-200 transition-colors"
                            >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </span>
                ))}

                <div className="flex-1"></div>

                <div className="text-gray-400">
                    <svg className={`h-5 w-5 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            {isOpen && !disabled && (
                <div className="absolute z-50 mt-1 w-full bg-white shadow-xl max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm animate-in fade-in zoom-in-95 duration-100 origin-top">
                    {availableOptions.length === 0 ? (
                        <div className="py-2 px-3 text-gray-500 italic">No more options</div>
                    ) : (
                        availableOptions.map((option) => (
                            <div
                                key={option}
                                className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-indigo-50 text-gray-900 transition-colors"
                                onClick={() => handleSelect(option)}
                            >
                                <span className="block truncate font-normal">
                                    {option}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
