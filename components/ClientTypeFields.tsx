'use client';

import { useState } from 'react';

interface ClientTypeFieldsProps {
  defaultType?: 'persoana_fizica' | 'persoana_juridica';
  defaultCui?: string;
  defaultRegCom?: string;
}

// Toggles CUI/Reg. Com. visibility — those fields only make sense for
// persoana_juridica; hiding them for persoana_fizica avoids confusing the
// (majority) individual-client case with company-only paperwork fields.
export default function ClientTypeFields({ defaultType = 'persoana_fizica', defaultCui = '', defaultRegCom = '' }: ClientTypeFieldsProps) {
  const [isCompany, setIsCompany] = useState(defaultType === 'persoana_juridica');

  return (
    <>
      <select
        name="client_type"
        defaultValue={defaultType}
        onChange={(e) => setIsCompany(e.target.value === 'persoana_juridica')}
        className="border rounded-xl px-4 py-2 bg-white"
        data-testid="client-type"
      >
        <option value="persoana_fizica">Persoană fizică</option>
        <option value="persoana_juridica">Persoană juridică</option>
      </select>
      {isCompany && (
        <>
          <input
            name="cui"
            placeholder="CUI (ex: RO12345678)"
            defaultValue={defaultCui}
            className="border rounded-xl px-4 py-2"
            data-testid="client-cui"
          />
          <input
            name="reg_com"
            placeholder="Reg. Com. (opțional)"
            defaultValue={defaultRegCom}
            className="border rounded-xl px-4 py-2"
            data-testid="client-reg-com"
          />
        </>
      )}
    </>
  );
}
