'use client';

import { toast } from 'sonner';

interface ExportButtonProps {
  data: any[];
  filename: string;
  label?: string;
}

export default function ExportButton({ data, filename, label = 'Export CSV' }: ExportButtonProps) {
  const exportToCSV = () => {
    if (!data || data.length === 0) return;

    // Size guard for large exports (prevent browser crash on huge datasets)
    // For very large data (>10k rows), consider server-side chunking/streaming exports or pagination filters.
    const MAX_ROWS = 10000;
    if (data.length > MAX_ROWS) {
      toast.error(`Export prea mare (${data.length} rânduri > ${MAX_ROWS}). Filtrează datele. Chunking recomandat pentru volume mari.`);
      return;
    }
    if (data.length > 5000) {
      toast.warning(`Export mare (${data.length} rânduri). Poate dura.`);
    }

    const headers = Object.keys(data[0] || {});

    // Proper CSV escaping: double internal quotes, wrap fields containing , " or \n
    const escapeCSV = (val: any): string => {
      if (val == null) return '""';
      let str = typeof val === 'object' ? JSON.stringify(val) : String(val);
      const needsQuote = /["\n,]/.test(str);
      str = str.replace(/"/g, '""'); // escape quotes by doubling
      return needsQuote ? `"${str}"` : `"${str}"`; // always quote for safety/compat
    };

    const rows = data.map(row => 
      headers.map(h => escapeCSV(row[h])).join(',')
    );

    const csvContent = [headers.map(h => escapeCSV(h)).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exportat ${data.length} rânduri CSV`);
  };

  return (
    <button 
      onClick={exportToCSV}
      className="px-4 py-2 bg-green-600 text-white text-sm rounded-xl hover:bg-green-700"
    >
      {label}
    </button>
  );
}
