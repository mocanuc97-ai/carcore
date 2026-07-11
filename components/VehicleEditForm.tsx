'use client';

import { toast } from 'sonner';
import { updateVehicle } from '@/app/(dashboard)/vehicles/[id]/actions';
import SubmitButton from '@/components/SubmitButton';

interface VehicleEditFormProps {
  vehicleId: string;
  make: string;
  model: string;
  vin: string;
  licensePlate: string;
  year: number | null;
  mileage: number | null;
  color: string;
}

export default function VehicleEditForm({
  vehicleId,
  make,
  model,
  vin,
  licensePlate,
  year,
  mileage,
  color,
}: VehicleEditFormProps) {
  const handleSubmit = async (formData: FormData) => {
    const result = await updateVehicle(vehicleId, formData);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success('Mașină actualizată');
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <form action={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <input name="make" defaultValue={make} placeholder="Marcă" required className="border rounded-xl px-4 py-2" />
      <input name="model" defaultValue={model} placeholder="Model" required className="border rounded-xl px-4 py-2" />
      <input name="vin" defaultValue={vin} placeholder="Serie caroserie (VIN)" className="border rounded-xl px-4 py-2" />
      <input name="license_plate" defaultValue={licensePlate} placeholder="Număr înmatriculare" className="border rounded-xl px-4 py-2" />
      <input name="year" type="number" defaultValue={year || ''} placeholder="An" min={1950} max={currentYear + 1} className="border rounded-xl px-4 py-2" />
      <input name="mileage" type="number" defaultValue={mileage || ''} placeholder="Km" min={0} max={2000000} className="border rounded-xl px-4 py-2" />
      <input name="color" defaultValue={color} placeholder="Culoare" className="border rounded-xl px-4 py-2 col-span-1 sm:col-span-2" />
      <SubmitButton pendingText="Se salvează..." className="bg-black text-white rounded-xl px-4 py-2 col-span-1 sm:col-span-2 disabled:opacity-50">
        Salvează
      </SubmitButton>
    </form>
  );
}
