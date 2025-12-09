import React, { useState, useRef, useEffect } from 'react';
import Button from './Button';

export default function ColumnToggle({ columns, visibleColumns, onChange }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [dropdownRef]);

    const toggleColumn = (columnId) => {
        if (visibleColumns.includes(columnId)) {
            // Don't allow hiding all columns? Or maybe just let them do it.
            // Let's allow it for now, or maybe prevent the last one from being hidden if we want to be safe.
            onChange(visibleColumns.filter(id => id !== columnId));
        } else {
            onChange([...visibleColumns, columnId]);
        }
    };

    return (
        <div className="relative inline-block text-left" ref={dropdownRef}>
            <Button variant="secondary" size="sm" onClick={() => setIsOpen(!isOpen)}>
                Customize Columns
            </Button>

            {isOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                    <div className="py-1" role="menu" aria-orientation="vertical">
                        {columns.map((col) => (
                            <label key={col.id} className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                    checked={visibleColumns.includes(col.id)}
                                    onChange={() => toggleColumn(col.id)}
                                />
                                {col.label}
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
