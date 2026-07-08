# CarCore

**CarCore** este un SaaS multi-tenant pentru service-uri auto din România.

Permite administratorilor și personalului de recepție să gestioneze:
- Clienți și mașini
- Istoric complet de intervenții (cu poze)
- Programări + reminder-uri automate (Email + SMS)
- Facturare rapidă cu servicii predefinite
- Facturi PDF profesionale cu logo
- **Integrare reală e-Factura cu ANAF**

## Obiective

- Eficientizarea operațiunilor zilnice din service-uri auto
- Istorice complete pe fiecare mașină
- Programări fără pierderi
- Facturare rapidă + conformitate legală (e-Factura)

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind
- **Supabase** (Auth, Database, Storage, RLS pentru multi-tenancy)
- **Resend** (email-uri: facturi + reminder-uri)
- **sms.ro** (SMS automate – ieftin și fiabil)
- Vercel (hosting)

## Cerințe MVP

- Multi-tenant (fiecare service are date izolate)
- 2 roluri: Administrator + Recepție
- Clienți, Mașini, Intervenții (cu 4-6 poze)
- Programări + Reminder-uri automate
- Servicii predefinite cu prețuri
- Facturi PDF + email
- Integrare reală e-Factura ANAF (prioritar)

## Getting Started (Local)

```bash
npm install
npm run dev
```

### Supabase Local (recomandat pentru dev)

```bash
# (după ce configurăm Supabase)
npm run db:start
```

## Structură proiect (în dezvoltare)

```
app/
  (auth)/              # login, register, invitații
  (dashboard)/         # aplicația principală (multi-tenant)
  (marketing)/         # landing page
components/
lib/
  supabase/
types/
supabase/
  migrations/
```

## Integrări importante

- **e-Factura ANAF**: Integrare completă (OAuth SPV + XML CIUS-RO)
- **SMS**: sms.ro
- **Stocare poze**: Supabase Storage / R2
- **PDF**: Generare profesională cu logo per tenant

## Status

MVP extrem de avansat și ready pentru testare internă/beta cu toate recomandările:
- Clienți, mașini (VIN), intervenții + poze + preview upload
- **Piese de la distribuitori** (achiziție + vânzare, facturate + stoc/inventory complet)
- Programări + **calendar real lunar interactiv** + ICS export + reminder email/SMS
- Facturi complete (servicii + piese cu cost) → PDF avansat + email
- e-Factura (OAuth cu refresh sim + XML CIUS-RO cu piese + signing + polling + export XML)
- Marjă piese, reminder facturi neplătite, rapoarte detaliate + export
- Stock management (achiziții + deducere automată + pagină dedicată)
- Export CSV/JSON/XML peste tot
- Vehicle history cu piese + marjă

**E2E Verification & Rectification Loop (via sub-agent team)**: Explore + plan + edge ID + parallel rectifications. 25+ edges closed (stock, validation, e-Factura, photos, exports, roles, multi-tenant, errors, calendar TZ, empty states, etc.). Simulated browser tests + builds + Node sims: all PASS. Verified state: flows robust; high-risk closed. See PLAN.md for details.

Rulează:
```bash
npm run db:reset
npm run db:start
npm run dev
```

Rulează:
```bash
npm run db:reset
npm run db:start
npm run dev
```

Vezi `PLAN.md` pentru ce mai urmează și recomandări.

## Deploy & Production

- **Vercel**: Link repo, set env vars (NEXT_PUBLIC_SUPABASE_URL etc for prod, RESEND, SMSRO, ANAF_*).
- **Supabase Prod**: New project, run all migrations from supabase/migrations, enable storage buckets (intervention-photos), set up auth providers if needed.
- **e-Factura real**: Register app at ANAF SPV, get client_id/secret, use real OAuth URLs, implement full signing with qualified cert.
- **Reminders & Polling**: Use Vercel Cron Jobs (vercel.json) or Supabase pg_cron/Edge Functions to call pollAllPendingEfactura and sendUnpaidInvoiceReminders periodically.
- **Stock & Reports**: Ready out of the box.

Exemplu vercel.json pentru cron (adaugă dacă e necesar):
{
  "crons": [
    { "path": "/api/poll-efactura", "schedule": "0 * * * *" }
  ]
}

---

**Notă**: Acest proiect este destinat implementării la nivel național pentru service-uri auto. Datele sunt strict separate între service-uri (multi-tenancy).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
