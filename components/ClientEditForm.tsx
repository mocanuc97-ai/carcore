'use client';

import { toast } from 'sonner';
import { updateClient } from '@/app/(dashboard)/clients/[id]/actions';
import SubmitButton from '@/components/SubmitButton';
import ClientTypeFields from '@/components/ClientTypeFields';

interface ClientEditFormProps {
  clientId: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  clientType: 'persoana_fizica' | 'persoana_juridica';
  cui: string;
  regCom: string;
}

export default function ClientEditForm({ clientId, name, phone, email, address, notes, clientType, cui, regCom }: ClientEditFormProps) {
  const handleSubmit = async (formData: FormData) => {
    const result = await updateClient(clientId, formData);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success('Client actualizat');
    }
  };

  return (
    <form action={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <input name="name" defaultValue={name} placeholder="Nume complet" required maxLength={100} className="border rounded-xl px-4 py-2" />
      <input name="phone" defaultValue={phone} placeholder="Telefon" required maxLength={30} className="border rounded-xl px-4 py-2" />
      <input name="email" defaultValue={email} placeholder="Email" className="border rounded-xl px-4 py-2" />
      <input name="address" defaultValue={address} placeholder="Adresă" className="border rounded-xl px-4 py-2" />
      <ClientTypeFields defaultType={clientType} defaultCui={cui} defaultRegCom={regCom} />
      <textarea
        name="notes"
        defaultValue={notes}
        placeholder="Notițe"
        className="border rounded-xl px-4 py-2 md:col-span-2"
        rows={2}
      />
      <SubmitButton pendingText="Se salvează..." className="bg-black text-white rounded-xl px-4 py-2 md:col-span-2 disabled:opacity-50">
        Salvează
      </SubmitButton>
    </form>
  );
}
