import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: '#111',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    borderBottom: '1px solid #eee',
    paddingBottom: 15,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  company: {
    fontSize: 10,
    color: '#555',
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 9,
    color: '#666',
    marginBottom: 2,
  },
  value: {
    fontSize: 11,
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f8f8',
    padding: 8,
    borderBottom: '1px solid #ddd',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottom: '1px solid #eee',
  },
  col1: { flex: 3 },
  col2: { flex: 1, textAlign: 'right' },
  col3: { flex: 1, textAlign: 'right' },
  total: {
    marginTop: 15,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    fontSize: 14,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 40,
    fontSize: 9,
    color: '#666',
    textAlign: 'center',
  },
});

interface InvoicePDFProps {
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
    unit_price: number; // selling price
    total: number;
    cost?: number; // purchase price for parts
  }>;
}

export const InvoicePDF = ({ invoice, client, tenant, items }: InvoicePDFProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>FACTURĂ</Text>
          <Text style={{ marginTop: 4, fontSize: 10 }}>Nr. {invoice.number}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {tenant.logo_url && (
            <Image 
              src={tenant.logo_url} 
              style={{ width: 80, height: 40, marginBottom: 4, objectFit: 'contain' }} 
            />
          )}
          <Text style={styles.company}>{tenant.name}</Text>
          {tenant.address && <Text style={styles.company}>{tenant.address}</Text>}
          {tenant.phone && <Text style={styles.company}>Tel: {tenant.phone}</Text>}
          {tenant.email && <Text style={styles.company}>{tenant.email}</Text>}
        </View>
      </View>

      {/* Client & Invoice Info */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 }}>
        <View style={styles.section}>
          <Text style={styles.label}>Client</Text>
          <Text style={styles.value}>{client.name}</Text>
          <Text style={styles.value}>{client.phone}</Text>
          {client.email && <Text style={styles.value}>{client.email}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Data emitere</Text>
          <Text style={styles.value}>
            {new Date(invoice.issued_at).toLocaleDateString('ro-RO')}
          </Text>
        </View>
      </View>

      {/* Items Table - Services and Parts separated with margin for parts */}
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={styles.col1}>Descriere</Text>
          <Text style={styles.col2}>Cant.</Text>
          <Text style={styles.col3}>Preț vânz.</Text>
          <Text style={styles.col3}>Cost ach.</Text>
          <Text style={[styles.col3, { fontWeight: 'bold' }]}>Total</Text>
        </View>

        {/* Services */}
        {items.filter(i => !i.description?.includes('Piesă')).map((item, index) => (
          <View key={`svc-${index}`} style={styles.tableRow}>
            <Text style={styles.col1}>{item.description}</Text>
            <Text style={styles.col2}>{item.quantity}</Text>
            <Text style={styles.col3}>{item.unit_price} RON</Text>
            <Text style={styles.col3}>-</Text>
            <Text style={[styles.col3, { fontWeight: 'bold' }]}>{item.total} RON</Text>
          </View>
        ))}

        {/* Parts with full breakdown: selling, cost, margin */}
        {items.filter(i => i.description?.includes('Piesă')).length > 0 && (
          <View style={{ marginTop: 10 }}>
            <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 4 }}>Piese achiziționate de la distribuitori:</Text>
            {items.filter(i => i.description?.includes('Piesă')).map((item, index) => {
              const margin = (item.unit_price - (item.cost || 0)) * item.quantity;
              return (
                <View key={`part-${index}`} style={styles.tableRow}>
                  <Text style={styles.col1}>{item.description.replace('[Piesă] ', '')}</Text>
                  <Text style={styles.col2}>{item.quantity}</Text>
                  <Text style={styles.col3}>{item.unit_price} RON</Text>
                  <Text style={styles.col3}>{item.cost || 0} RON</Text>
                  <Text style={[styles.col3, { fontWeight: 'bold' }]}>{item.total} RON (marjă {margin})</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Total */}
      <View style={styles.total}>
        <Text>Total de plată: {invoice.total} RON</Text>
      </View>

      {/* Parts margin summary if any parts */}
      {items.some(i => i.description?.includes('Piesă')) && (
        <View style={{ marginTop: 10, fontSize: 9 }}>
          <Text style={{ fontWeight: 'bold' }}>Notă: Piesele au preț de achiziție și vânzare pentru calcul marjă intern.</Text>
        </View>
      )}

      {/* Footer */}
      <Text style={styles.footer}>
        Mulțumim pentru colaborare! • {tenant.name}
      </Text>
    </Page>
  </Document>
);
