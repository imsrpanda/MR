import React from 'react';

const COLORS = [
    'text-red-500',
    'text-orange-500',
    'text-amber-500',
    'text-green-500',
    'text-emerald-500',
    'text-teal-500',
    'text-cyan-500',
    'text-sky-500',
    'text-blue-500',
    'text-indigo-500',
    'text-violet-500',
    'text-purple-500',
    'text-fuchsia-500',
    'text-pink-500',
    'text-rose-500'
];

export default function ColorfulText({ text, className = "" }) {
    return (
        <span className={`inline-flex ${className}`}>
            {text.split('').map((char, index) => (
                <span
                    key={index}
                    className={`${COLORS[index % COLORS.length]} transition-colors duration-300 hover:scale-110 inline-block`}
                >
                    {char === ' ' ? '\u00A0' : char}
                </span>
            ))}
        </span>
    );
}
