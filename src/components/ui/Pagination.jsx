import React from 'react';

export default function Pagination({
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [10, 25, 50, 100],
    loading = false
}) {
    if (!totalItems || totalItems === 0) return null;

    const fromItem = (currentPage - 1) * pageSize + 1;
    const toItem = Math.min(currentPage * pageSize, totalItems);

    // Calculate visible page numbers (up to 5 around current page)
    const getPageNumbers = () => {
        const pages = [];
        const maxPagesToShow = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

        if (endPage - startPage + 1 < maxPagesToShow) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }
        return pages;
    };

    const pages = getPageNumbers();

    return (
        <div className="px-6 py-4 border-t border-gray-100/70 bg-white/50 backdrop-blur-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
            {/* Left: Summary and Page Size */}
            <div className="flex items-center gap-3 text-gray-500 text-xs sm:text-sm">
                <span>
                    Showing <strong className="text-gray-900 font-semibold">{fromItem}</strong> to{' '}
                    <strong className="text-gray-900 font-semibold">{toItem}</strong> of{' '}
                    <strong className="text-gray-900 font-semibold">{totalItems}</strong> entries
                </span>

                {onPageSizeChange && (
                    <div className="flex items-center gap-1.5 ml-2 border-l border-gray-200 pl-3">
                        <span className="text-gray-400">Rows:</span>
                        <select
                            value={pageSize}
                            onChange={(e) => onPageSizeChange(Number(e.target.value))}
                            disabled={loading}
                            className="px-2 py-1 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                        >
                            {pageSizeOptions.map(size => (
                                <option key={size} value={size}>{size}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Right: Page Controls */}
            <div className="flex items-center gap-1">
                {/* Previous */}
                <button
                    type="button"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage <= 1 || loading}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 text-xs font-medium transition-colors shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Previous Page"
                >
                    ‹ Prev
                </button>

                {/* First page indicator if not in list */}
                {pages[0] > 1 && (
                    <>
                        <button
                            type="button"
                            onClick={() => onPageChange(1)}
                            disabled={loading}
                            className="w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 text-xs font-medium transition-colors cursor-pointer"
                        >
                            1
                        </button>
                        {pages[0] > 2 && <span className="px-1 text-gray-400 text-xs">...</span>}
                    </>
                )}

                {/* Page numbers */}
                {pages.map(page => (
                    <button
                        key={page}
                        type="button"
                        onClick={() => onPageChange(page)}
                        disabled={loading}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all shadow-2xs cursor-pointer ${
                            page === currentPage
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        {page}
                    </button>
                ))}

                {/* Last page indicator if not in list */}
                {pages[pages.length - 1] < totalPages && (
                    <>
                        {pages[pages.length - 1] < totalPages - 1 && <span className="px-1 text-gray-400 text-xs">...</span>}
                        <button
                            type="button"
                            onClick={() => onPageChange(totalPages)}
                            disabled={loading}
                            className="w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 text-xs font-medium transition-colors cursor-pointer"
                        >
                            {totalPages}
                        </button>
                    </>
                )}

                {/* Next */}
                <button
                    type="button"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages || loading}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 text-xs font-medium transition-colors shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Next Page"
                >
                    Next ›
                </button>
            </div>
        </div>
    );
}
