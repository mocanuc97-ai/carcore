import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CarCore — Management service auto',
    short_name: 'CarCore',
    description: 'Programări, istoric intervenții, facturare și e-Factura pentru service-uri auto',
    start_url: '/',
    display: 'standalone',
    background_color: '#18181b',
    theme_color: '#18181b',
    lang: 'ro',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
