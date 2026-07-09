import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoicePDF } from './pdf';

export interface GenerateInvoicePDFInput {
  invoice: {
    number: string;
    issued_at: string;
    total: number;
  };
  client: {
    name: string;
    phone: string;
    email?: string;
  };
  tenant: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    logo_url?: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
    cost?: number;
  }>;
}

// Wires real React PDF from pdf.tsx (logo, services/parts breakdown with margin).
// Falls back to text stub ONLY on render failure.
export async function generateInvoicePDF(input: GenerateInvoicePDFInput): Promise<Buffer> {
  try {
    // Use renderToBuffer for direct Buffer (pdf fn's toBuffer is stream)
    // cast to satisfy DocumentProps type (InvoicePDF renders <Document>)
    const docElement = React.createElement(InvoicePDF, {
      invoice: input.invoice,
      client: input.client,
      tenant: input.tenant,
      items: input.items,
    }) as unknown as Parameters<typeof renderToBuffer>[0];
    const buffer: Buffer = await renderToBuffer(docElement);
    return buffer;
  } catch (err) {
    console.error('Real PDF generation failed (pdf.tsx), falling back to text stub:', err);
    // Fallback only if fail
    const lines = [
      `FACTURĂ ${input.invoice.number}`,
      `Data: ${new Date(input.invoice.issued_at).toLocaleDateString('ro-RO')}`,
      `Service: ${input.tenant.name}`,
      '',
      `Client: ${input.client.name} (${input.client.phone})`,
      '',
      ...input.items.map(i => `${i.description} ×${i.quantity} — ${i.total} RON`),
      '',
      `TOTAL: ${input.invoice.total} RON`,
    ];
    return Buffer.from(lines.join('\n'), 'utf-8');
  }
}
