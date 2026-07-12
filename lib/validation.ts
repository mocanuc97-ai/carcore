import { z } from 'zod';

// Common positive number schema for prices and quantities (must be > 0). Using simple coerce + checks for Zod v4 compat.
export const positiveNumber = z.coerce
  .number()
  .positive('Trebuie să fie mai mare decât 0')
  .finite('Valoare invalidă');

// Optional non-negative for some fields like duration, cost
export const nonNegativeNumber = z.coerce
  .number()
  .nonnegative('Trebuie să fie >= 0')
  .finite('Valoare invalidă');

// Markup (%) applied to received supplier invoice parts — bounded to prevent
// a stray extreme value from overflowing numeric(10,2) on the resulting
// selling_price (found via QA testing: an unbounded value like 1e15 passed
// validation but crashed the insert with a silently-swallowed Postgres error).
export const markupPercentSchema = z.coerce
  .number()
  .nonnegative('Adaosul nu poate fi negativ')
  .max(1000, 'Adaos prea mare (maxim 1000%)')
  .finite('Valoare invalidă');

// Service creation/update
export const serviceSchema = z.object({
  name: z.string().trim().min(1, 'Numele serviciului este obligatoriu'),
  price: positiveNumber,
  duration_minutes: z.preprocess(
    (val) => (val === '' || val == null ? null : val),
    z.coerce.number().int().positive().nullable().optional()
  ),
});

// Client creation/update — client_type drives whether CUI is expected (persoana_juridica).
export const clientSchema = z.object({
  name: z.string().trim().min(1, 'Numele este obligatoriu'),
  phone: z.string().trim().min(1, 'Telefonul este obligatoriu'),
  email: z.preprocess((v) => (v === '' || v == null ? null : v), z.string().email('Email invalid').nullable().optional()),
  address: z.preprocess((v) => (v === '' || v == null ? null : v), z.string().nullable().optional()),
  client_type: z.enum(['persoana_fizica', 'persoana_juridica']).default('persoana_fizica'),
  cui: z.preprocess((v) => (v === '' || v == null ? null : v), z.string().trim().nullable().optional()),
  reg_com: z.preprocess((v) => (v === '' || v == null ? null : v), z.string().trim().nullable().optional()),
});

// Vehicle creation/update — year and mileage are optional but, when present,
// must be within a sane range (found via QA testing: -5 and 9999 were
// previously accepted with no validation at all).
const currentYear = new Date().getFullYear();
export const vehicleSchema = z.object({
  make: z.string().trim().min(1, 'Marca este obligatorie'),
  model: z.string().trim().min(1, 'Modelul este obligatoriu'),
  year: z.preprocess(
    (val) => (val === '' || val == null ? null : val),
    z.coerce.number().int().min(1950, 'An prea vechi').max(currentYear + 1, 'An invalid').nullable().optional()
  ),
  mileage: z.preprocess(
    (val) => (val === '' || val == null ? null : val),
    z.coerce.number().int().nonnegative('Km nu poate fi negativ').max(2000000, 'Valoare km neverosimilă').nullable().optional()
  ),
});

// Part purchase (inventory)
export const partPurchaseSchema = z.object({
  name: z.string().trim().min(1, 'Numele piesei este obligatoriu'),
  distributor: z.string().trim().optional().or(z.literal('').transform(() => null)),
  qty: positiveNumber,
  price: positiveNumber, // purchase price
});

// Add part to intervention
export const partToInterventionSchema = z.object({
  intervention_id: z.string().min(1, 'Intervenția este obligatorie'),
  name: z.string().trim().min(1, 'Numele piesei este obligatoriu'),
  distributor: z.string().trim().optional().or(z.literal('').transform(() => null)),
  qty: positiveNumber,
  purchase_price: nonNegativeNumber, // cost can be 0?
  selling_price: positiveNumber,
});

// Invoice manual part item (from formData)
export const invoicePartItemSchema = z.object({
  name: z.string().trim().min(1, 'Nume piesă obligatoriu'),
  qty: positiveNumber,
  price: positiveNumber, // selling
  cost: nonNegativeNumber,
});

// Labor ("manoperă") line item on an invoice — hours worked at a given rate.
// Bounded for the same reason as markupPercentSchema: an unbounded value
// (found via QA testing: "99999999" hours passed client-side with no error
// and produced a 14+ billion RON total) overflows numeric(10,2) on `total`.
export const invoiceLaborItemSchema = z.object({
  hours: positiveNumber.max(1000, 'Ore manoperă prea multe (maxim 1000)'),
  rate: positiveNumber.max(100000, 'Tarif manoperă prea mare (maxim 100000 RON/oră)'),
});

// Intervention catalog entry (editable per-tenant quick-pick list)
export const interventionCatalogSchema = z.object({
  name: z.string().trim().min(1, 'Numele este obligatoriu').max(200, 'Nume prea lung'),
});

// For invoice creation validation
export const createInvoiceSchema = z.object({
  client_id: z.string().min(1, 'Clientul este obligatoriu'),
  intervention_id: z.string().optional().nullable(),
  service_ids: z.array(z.string()).optional(),
  // parts will be validated separately in array
});

// Helper to validate form data entries for invoice parts
export function parseAndValidateInvoiceParts(
  partNames: string[],
  partQtys: string[],
  partPrices: string[],
  partCosts: string[]
) {
  const items: Array<{ description: string; quantity: number; unit_price: number; cost: number; total: number }> = [];
  const errors: string[] = [];

  for (let i = 0; i < partNames.length; i++) {
    const name = (partNames[i] || '').trim();
    if (!name) continue;

    const parseResult = invoicePartItemSchema.safeParse({
      name,
      qty: partQtys[i],
      price: partPrices[i],
      cost: partCosts[i] || '0',
    });

    if (!parseResult.success) {
      errors.push(`Piesa "${name}": ${parseResult.error.issues.map(e => e.message).join(', ')}`);
      continue;
    }

    const { qty, price, cost } = parseResult.data;
    items.push({
      description: `[Piesă] ${name}`,
      quantity: qty,
      unit_price: price,
      cost,
      total: qty * price,
    });
  }

  return { items, errors };
}

// Helper to validate form data entries for invoice labor ("manoperă") lines
export function parseAndValidateInvoiceLabor(laborHours: string[], laborRates: string[]) {
  const items: Array<{ description: string; quantity: number; unit_price: number; total: number }> = [];
  const errors: string[] = [];

  for (let i = 0; i < laborHours.length; i++) {
    const hoursRaw = (laborHours[i] || '').trim();
    // An empty or zero row means "not filled in" — skip it silently like the
    // parts parser skips rows with no name, rather than letting it reach
    // validation (which would reject 0 as non-positive and abort the whole
    // invoice submission over an unused labor row).
    if (!hoursRaw || Number(hoursRaw) === 0) continue;

    const parseResult = invoiceLaborItemSchema.safeParse({
      hours: hoursRaw,
      rate: laborRates[i],
    });

    if (!parseResult.success) {
      errors.push(`Manoperă: ${parseResult.error.issues.map((e) => e.message).join(', ')}`);
      continue;
    }

    const { hours, rate } = parseResult.data;
    items.push({
      description: `Manoperă (${hours} h)`,
      quantity: hours,
      unit_price: rate,
      total: Math.round(hours * rate * 100) / 100,
    });
  }

  return { items, errors };
}
