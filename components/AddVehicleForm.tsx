'use client';

import { useRef } from 'react';
import { toast } from 'sonner';
import { addVehicleToClient } from '@/app/(dashboard)/clients/[id]/actions';
import SubmitButton from '@/components/SubmitButton';

export default function AddVehicleForm({ clientId }: { clientId: string }) {
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (formData: FormData) => {
    const result = await addVehicleToClient(clientId, formData);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success('Mașină adăugată');
      formRef.current?.reset();
    }
  };

  return (
    <form ref={formRef} action={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
      <input name="make" placeholder="Marcă" required className="border rounded-xl px-4 py-2" />
      <input name="model" placeholder="Model" required className="border rounded-xl px-4 py-2" />
      <input name="vin" placeholder="Serie caroserie (VIN)" className="border rounded-xl px-4 py-2" />
      <input name="license_plate" placeholder="Nr. înmatriculare" className="border rounded-xl px-4 py-2" />
      <input name="year" type="number" placeholder="An" min={1950} max={new Date().getFullYear() + 1} className="border rounded-xl px-4 py-2" />
      <input name="mileage" type="number" placeholder="Km" min={0} max={2000000} className="border rounded-xl px-4 py-2" />
      <SubmitButton pendingText="Se adaugă..." className="bg-black text-white rounded-xl px-4 py-2 disabled:opacity-50">
        + Adaugă mașină
      </SubmitButton>
    </form>
  );
}
