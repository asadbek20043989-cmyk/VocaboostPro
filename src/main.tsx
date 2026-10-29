import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { VerifyCertificate, certIdFromLocation } from './components/VerifyCertificate';
import './index.css';

// PWA Service Worker ro'yxatga olish (Offline rejim va kesh)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// QR kod orqali kelganlar ilovaga kirmasdan, to'g'ridan-to'g'ri sertifikat sahifasini ko'radi
const certId = certIdFromLocation();
createRoot(document.getElementById('root')!).render(certId ? <VerifyCertificate id={certId} /> : <App />);
