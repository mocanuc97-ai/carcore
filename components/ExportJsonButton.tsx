'use client';

interface ExportJsonButtonProps {
  data: unknown;
  filename: string;
  label?: string;
}

export default function ExportJsonButton({ data, filename, label = 'Export JSON' }: ExportJsonButtonProps) {
  const handleExport = () => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700"
    >
      {label}
    </button>
  );
}
