// Non-blocking "complete your data" hints. These fields are all optional at the
// database level (a client/vehicle is fully usable without them), but missing
// them makes invoicing, reminders, and service history less useful — so we flag
// it visually instead of enforcing it, per the product decision to never block
// the user's workflow over it.

interface ClientCompletenessInput {
  email?: string | null;
  address?: string | null;
}

export function getClientMissingFields(client: ClientCompletenessInput): string[] {
  const missing: string[] = [];
  if (!client.email) missing.push('email');
  if (!client.address) missing.push('adresă');
  return missing;
}

interface VehicleCompletenessInput {
  vin?: string | null;
  year?: number | null;
  license_plate?: string | null;
}

export function getVehicleMissingFields(vehicle: VehicleCompletenessInput): string[] {
  const missing: string[] = [];
  if (!vehicle.vin) missing.push('serie caroserie (VIN)');
  if (!vehicle.year) missing.push('an fabricație');
  if (!vehicle.license_plate) missing.push('număr înmatriculare');
  return missing;
}
