/**
 * Simulates ANAF SPV's incoming e-Factura message inbox (the real endpoint
 * would be GET listaMesajeFactura + descarcare for each message id). Used to
 * generate a plausible "new invoice arrived from a parts supplier" event for
 * the auto-registration skill, without a real ANAF sandbox account.
 */

export interface ReceivedSupplierInfo {
  cui: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface ReceivedInvoiceItemInput {
  description: string;
  quantity: number;
  unit_price: number;
}

export interface SimulatedReceivedInvoice {
  external_id: string;
  number: string;
  issued_at: string;
  supplier: ReceivedSupplierInfo;
  items: ReceivedInvoiceItemInput[];
  total: number;
}

const SUPPLIERS: ReceivedSupplierInfo[] = [
  { cui: 'RO18547293', name: 'AutoPiese București SRL', address: 'Str. Industriilor 12, București', phone: '0212345678', email: 'comenzi@autopiesebuc.ro' },
  { cui: 'RO22910384', name: 'MotoParts Distribution SRL', address: 'Bd. Timișoara 45, București', phone: '0213456789', email: 'vanzari@motoparts.ro' },
  { cui: 'RO30581147', name: 'EuroCar Piese SRL', address: 'Str. Depozitelor 8, Cluj-Napoca', phone: '0264123456', email: 'office@eurocarpiese.ro' },
];

const PART_CATALOG: Array<{ name: string; priceRange: [number, number] }> = [
  { name: 'Plăcuțe frână față', priceRange: [80, 180] },
  { name: 'Plăcuțe frână spate', priceRange: [70, 150] },
  { name: 'Filtru ulei', priceRange: [15, 40] },
  { name: 'Filtru aer', priceRange: [20, 55] },
  { name: 'Filtru combustibil', priceRange: [25, 60] },
  { name: 'Filtru habitaclu', priceRange: [20, 45] },
  { name: 'Amortizor față', priceRange: [150, 350] },
  { name: 'Disc frână', priceRange: [90, 220] },
  { name: 'Curea distribuție', priceRange: [120, 280] },
  { name: 'Bujie', priceRange: [10, 30] },
  { name: 'Baterie auto 60Ah', priceRange: [300, 500] },
  { name: 'Ulei motor 5W30 (1L)', priceRange: [25, 45] },
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

export function simulateIncomingEfacturaMessage(): SimulatedReceivedInvoice {
  const supplier = pick(SUPPLIERS);
  const itemCount = randomInt(2, 4);
  const items: ReceivedInvoiceItemInput[] = [...PART_CATALOG]
    .sort(() => Math.random() - 0.5)
    .slice(0, itemCount)
    .map((part) => ({
      description: part.name,
      quantity: randomInt(1, 10),
      unit_price: randomInt(part.priceRange[0], part.priceRange[1]),
    }));

  const total = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const now = Date.now();

  return {
    external_id: `ANAF-IN-${now}-${randomInt(1000, 9999)}`,
    number: `FF-${new Date(now).getFullYear()}-${String(now).slice(-6)}`,
    issued_at: new Date(now).toISOString(),
    supplier,
    items,
    total,
  };
}
