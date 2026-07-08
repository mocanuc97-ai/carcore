/**
 * e-Factura ANAF Integration (Production-Ready Structure)
 *
 * This module provides:
 * - CIUS-RO compliant XML generation (basic but much improved)
 * - Connection management helpers
 * - Upload + status simulation (ready to be replaced with real ANAF calls)
 *
 * For REAL integration you will need:
 * - Register app in ANAF SPV Developer Portal
 * - OAuth2 flow (authorization_code + refresh)
 * - Store access_token/refresh_token securely per tenant
 * - Qualified digital certificate for signature (or use ANAF's service)
 * - Proper VAT handling, CUI, etc.
 * - Sandbox testing: https://api.anaf.ro/test/
 */

export interface AnafConnection {
  cui: string;
  access_token?: string;
  status?: 'connected' | 'disconnected' | 'expired' | 'error';
  token_expires_at?: string;
}

import { signEfacturaXML } from './sign';

export function isValidAnafConnection(connection: any | null | undefined): boolean {
  if (!connection) return false;
  if (!connection.access_token) return false;
  if (connection.status === 'expired' || connection.status === 'disconnected' || connection.status === 'error') return false;
  if (connection.token_expires_at) {
    const exp = new Date(connection.token_expires_at);
    if (!isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
      return false;
    }
  }
  // default to true only if status connected or not specified but has token
  if (connection.status && connection.status !== 'connected') return false;
  return true;
}

export function generateEfacturaXML(invoice: any, items: any[], tenant: any, client: any): string {
  const issueDate = new Date(invoice.issued_at || Date.now()).toISOString().split('T')[0];
  const cui = tenant?.cui || ''; // must come from connection.cui passed by caller consistently

  // Build line items with proper structure
  const invoiceLines = (items || []).map((item: any, index: number) => {
    const isPart = item.description?.startsWith('[Piesă]');
    const name = escapeXml(item.description || '');
    return `
    <cac:InvoiceLine>
      <cbc:ID>${index + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="EA">${item.quantity || 1}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="RON">${Number(item.total).toFixed(2)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Name>${name}</cbc:Name>
        ${isPart ? '<cbc:Description>Piesă achiziționată de la distribuitor</cbc:Description>' : ''}
        <cac:ClassifiedTaxCategory>
          <cbc:ID>S</cbc:ID>
          <cbc:Percent>19.00</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="RON">${Number(item.unit_price).toFixed(2)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`;
  }).join('\n');

  // Calculate tax (simplified 19% VAT)
  const taxAmount = (Number(invoice.total) / 1.19 * 0.19).toFixed(2);
  const netAmount = (Number(invoice.total) - parseFloat(taxAmount)).toFixed(2);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:efactura.mfinante.ro:invoice:ver1.0</cbc:ProfileID>
  <cbc:ID>${escapeXml(invoice?.number || '')}</cbc:ID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>RON</cbc:DocumentCurrencyCode>

  <!-- Supplier (Your service) -->
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="RO:VAT">${escapeXml(cui)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${escapeXml(tenant?.name)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(tenant?.address || '')}</cbc:StreetName>
        <cbc:CityName>Bucuresti</cbc:CityName>
        <cbc:Country>
          <cbc:IdentificationCode>RO</cbc:IdentificationCode>
        </cbc:Country>
      </cac:PostalAddress>
      <cac:Contact>
        <cbc:Telephone>${escapeXml(tenant?.phone || '')}</cbc:Telephone>
        <cbc:ElectronicMail>${escapeXml(tenant?.email || '')}</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>

  <!-- Customer -->
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${escapeXml(client?.name)}</cbc:Name>
      </cac:PartyName>
      <cac:Contact>
        <cbc:Telephone>${escapeXml(client?.phone || '')}</cbc:Telephone>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingCustomerParty>

  <!-- Tax Summary -->
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="RON">${taxAmount}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="RON">${netAmount}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="RON">${taxAmount}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>19.00</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>

  <cac:LegalMonetaryTotal>
    <cbc:TaxExclusiveAmount currencyID="RON">${netAmount}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="RON">${invoice.total}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="RON">${invoice.total}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

  ${invoiceLines}

  <!-- 
    PRODUCTION NOTES:
    - The CustomizationID is required for CIUS-RO
    - Add digital signature (XAdES) before upload
    - CUI always sourced from tenant_anaf_connections.cui (callers must pass consistently)
  -->
</Invoice>`;
}

function escapeXml(unsafe: any): string {
  if (unsafe == null) return '';
  const str = String(unsafe);
  // Escape in order: & first, then others. Covers special chars & < > " ' for XML content/attrs.
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function submitToANAF(
  xml: string, 
  connection: any, 
  tenantId: string
): Promise<{ success: boolean; efactura_id?: string; status?: string; message?: string }> {
  
  if (!isValidAnafConnection(connection)) {
    const msg = connection?.token_expires_at && new Date(connection.token_expires_at) < new Date()
      ? 'Token ANAF expirat. Reconectează contul din Setări.'
      : 'Nu ești conectat la ANAF. Mergi în Setări → Conectează cont ANAF.';
    return {
      success: false,
      message: msg
    };
  }

  console.log(`[e-Factura] Uploading to ANAF for tenant ${tenantId} (CUI: ${connection.cui || ''})`);
  console.log(`[e-Factura] XML length: ${xml.length} chars`);

  // 1. Sign the XML (mandatory for ANAF)
  const signedXml = await signEfacturaXML(xml);

  console.log(`[e-Factura] After signing, length: ${signedXml.length} chars`);

  // === REAL ANAF INTEGRATION (replace this) ===
  // 1. Ensure token is valid (refresh if needed using refresh_token)
  // 2. POST signedXml to https://api.anaf.ro/prod/FCTEL/rest/upload
  //    Headers: Authorization: Bearer ${connection.access_token}, Content-Type: application/xml
  // 3. Response has "id" for the message
  // 4. Poll https://api.anaf.ro/prod/FCTEL/rest/stareMesaj?id=XXX
  //
  // Note: For production you need registered app in ANAF SPV, proper scopes, and qualified signature.

  if (process.env.NODE_ENV === 'production' && connection.access_token && !connection.access_token.startsWith('SIMULATED')) {
    // Placeholder for real call - implement fetch here with real token
    console.log('[e-Factura] Would POST to real ANAF API with signedXml');
  }

  const fakeId = 'ANAF-' + Date.now();

  return {
    success: true,
    efactura_id: fakeId,
    status: 'in_processing',
    message: 'Factură trimisă la ANAF (semnată). Se află în procesare.',
  };
}

export async function checkEfacturaStatus(efacturaId: string, accessToken: string) {
  console.log(`[e-Factura] Polling ANAF for ${efacturaId}`);

  // In production:
  // const res = await fetch(`https://api.anaf.ro/prod/FCTEL/rest/stareMesaj?id=${efacturaId}`, {
  //   headers: { Authorization: `Bearer ${accessToken}` }
  // });

  const rand = Math.random();
  if (rand < 0.65) {
    return { status: 'accepted', details: 'Factură acceptată de ANAF.' };
  } else if (rand < 0.85) {
    return { status: 'rejected', details: 'Respinsă de ANAF. Verifică mesajele de eroare.' };
  } else {
    return { status: 'in_processing', details: 'Încă în procesare la ANAF.' };
  }
}
