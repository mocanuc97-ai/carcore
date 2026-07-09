'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/supabase/server';
import { parseCsvToRecords } from '@/lib/csv/parse';
import { revalidatePath } from 'next/cache';

const REQUIRED_COLUMNS = ['nume_client', 'telefon_client', 'marca', 'model'];
const MAX_ROWS = 2000;

export interface ImportResult {
  error?: string;
  clientsCreated: number;
  clientsMatched: number;
  vehiclesCreated: number;
  vehiclesSkippedDuplicate: number;
  rowErrors: string[];
}

const EMPTY_RESULT: Omit<ImportResult, 'error'> = {
  clientsCreated: 0,
  clientsMatched: 0,
  vehiclesCreated: 0,
  vehiclesSkippedDuplicate: 0,
  rowErrors: [],
};

export async function importClientsAndVehicles(formData: FormData): Promise<ImportResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: 'Nu ești autentificat', ...EMPTY_RESULT };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Selectează un fișier CSV', ...EMPTY_RESULT };
  }

  const text = await file.text();
  const records = parseCsvToRecords(text);

  if (records.length === 0) {
    return { error: 'Fișierul e gol sau nu are un rând de antet (header)', ...EMPTY_RESULT };
  }

  const headers = Object.keys(records[0]);
  const missingColumns = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  if (missingColumns.length > 0) {
    return {
      error: `Lipsesc coloanele obligatorii din antet: ${missingColumns.join(', ')}. Descarcă șablonul pentru formatul corect.`,
      ...EMPTY_RESULT,
    };
  }

  if (records.length > MAX_ROWS) {
    return { error: `Fișierul are ${records.length} rânduri, limita e ${MAX_ROWS}. Împarte-l în fișiere mai mici.`, ...EMPTY_RESULT };
  }

  const supabase = await createClient();
  const tenantId = profile.tenant_id;

  const { data: existingClients } = await supabase
    .from('clients')
    .select('id, phone')
    .eq('tenant_id', tenantId);
  const clientIdByPhone = new Map<string, string>((existingClients || []).map((c) => [c.phone, c.id]));

  const { data: existingVehicles } = await supabase
    .from('vehicles')
    .select('vin, license_plate')
    .eq('tenant_id', tenantId);
  const existingVins = new Set((existingVehicles || []).map((v) => v.vin).filter(Boolean));
  const existingPlates = new Set((existingVehicles || []).map((v) => v.license_plate).filter(Boolean));

  const rowErrors: string[] = [];
  const newClientsByPhone = new Map<string, { name: string; phone: string; email: string | null; address: string | null }>();
  interface PendingVehicle {
    clientPhone: string;
    make: string;
    model: string;
    year: number | null;
    vin: string | null;
    license_plate: string | null;
    mileage: number | null;
    color: string | null;
  }
  const pendingVehicles: PendingVehicle[] = [];
  let vehiclesSkippedDuplicate = 0;

  records.forEach((r, idx) => {
    const lineNumber = idx + 2; // +1 for 0-index, +1 for header row
    const name = r['nume_client'];
    const phone = r['telefon_client'];
    const make = r['marca'];
    const model = r['model'];

    if (!name || !phone || !make || !model) {
      rowErrors.push(`Rândul ${lineNumber}: lipsește un câmp obligatoriu (nume_client, telefon_client, marca sau model)`);
      return;
    }

    const vin = r['vin'] || null;
    const licensePlate = r['numar_inmatriculare'] || null;

    if ((vin && existingVins.has(vin)) || (licensePlate && existingPlates.has(licensePlate))) {
      vehiclesSkippedDuplicate++;
      return;
    }

    if (!clientIdByPhone.has(phone) && !newClientsByPhone.has(phone)) {
      newClientsByPhone.set(phone, {
        name,
        phone,
        email: r['email_client'] || null,
        address: r['adresa_client'] || null,
      });
    }

    const yearRaw = r['an'];
    const mileageRaw = r['km'];

    pendingVehicles.push({
      clientPhone: phone,
      make,
      model,
      year: yearRaw && !isNaN(Number(yearRaw)) ? Number(yearRaw) : null,
      vin,
      license_plate: licensePlate,
      mileage: mileageRaw && !isNaN(Number(mileageRaw)) ? Number(mileageRaw) : null,
      color: r['culoare'] || null,
    });

    // Prevent re-matching the same VIN/plate twice within this same file.
    if (vin) existingVins.add(vin);
    if (licensePlate) existingPlates.add(licensePlate);
  });

  let clientsCreated = 0;
  if (newClientsByPhone.size > 0) {
    const { data: inserted, error } = await supabase
      .from('clients')
      .insert(
        Array.from(newClientsByPhone.values()).map((c) => ({
          tenant_id: tenantId,
          name: c.name,
          phone: c.phone,
          email: c.email,
          address: c.address,
        }))
      )
      .select('id, phone');

    if (error) {
      return { error: `Eroare la crearea clienților: ${error.message}`, ...EMPTY_RESULT };
    }

    clientsCreated = inserted?.length || 0;
    (inserted || []).forEach((c) => clientIdByPhone.set(c.phone, c.id));
  }

  const clientsMatched = pendingVehicles.reduce((set, v) => {
    if (!newClientsByPhone.has(v.clientPhone)) set.add(v.clientPhone);
    return set;
  }, new Set<string>()).size;

  let vehiclesCreated = 0;
  if (pendingVehicles.length > 0) {
    const rowsToInsert = pendingVehicles
      .map((v) => {
        const clientId = clientIdByPhone.get(v.clientPhone);
        if (!clientId) return null;
        return {
          tenant_id: tenantId,
          client_id: clientId,
          make: v.make,
          model: v.model,
          year: v.year,
          vin: v.vin,
          license_plate: v.license_plate,
          mileage: v.mileage,
          color: v.color,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rowsToInsert.length > 0) {
      const { data: insertedVehicles, error } = await supabase.from('vehicles').insert(rowsToInsert).select('id');
      if (error) {
        return { error: `Eroare la crearea vehiculelor: ${error.message}`, ...EMPTY_RESULT };
      }
      vehiclesCreated = insertedVehicles?.length || 0;
    }
  }

  revalidatePath('/clients');
  revalidatePath('/vehicles');

  return {
    clientsCreated,
    clientsMatched,
    vehiclesCreated,
    vehiclesSkippedDuplicate,
    rowErrors,
  };
}
