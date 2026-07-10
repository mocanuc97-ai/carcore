'use client';

import { useRef } from 'react';
import { toast } from 'sonner';
import { addClient } from '@/app/(dashboard)/clients/add-action';
import ClientTypeFields from '@/components/ClientTypeFields';
import SubmitButton from '@/components/SubmitButton';

export default function AddClientForm() {
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (formData: FormData) => {
    const result = await addClient(formData);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success('Client adăugat');
      formRef.current?.reset();
    }
  };

  return (
    <form ref={formRef} action={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <input name="name" placeholder="Nume complet" required maxLength={100} className="border rounded-xl px-4 py-2" data-testid="client-name" />
      <input name="phone" placeholder="Telefon" required maxLength={30} className="border rounded-xl px-4 py-2" data-testid="client-phone" />
      <input name="email" placeholder="Email (opțional)" className="border rounded-xl px-4 py-2" data-testid="client-email" />
      <input name="address" placeholder="Adresă (opțional)" className="border rounded-xl px-4 py-2" data-testid="client-address" />
      <ClientTypeFields />
      <SubmitButton pendingText="Se adaugă..." className="bg-black text-white rounded-xl disabled:opacity-50" data-testid="add-client">
        Adaugă
      </SubmitButton>
    </form>
  );
}
