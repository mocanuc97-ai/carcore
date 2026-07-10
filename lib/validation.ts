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

// Service creation/update
export const serviceSchema = z.object({
  name: z.string().trim().min(1, 'Numele serviciului este obligatoriu'),
  price: positiveNumber,
  duration_minutes: z.preprocess(
    (val) => (val === '' || val == null ? null : val),
    z.coerce.number().int().positive().nullable().optional()
  ),
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
