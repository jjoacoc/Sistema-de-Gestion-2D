// Configuración base de Laravel (incluye Axios para las peticiones al servidor)
import './bootstrap';

// Alpine.js: interactividad ligera directamente en las vistas
import Alpine from 'alpinejs';

// Componente de la página del almacén (estado y comportamiento)
import almacen from './almacen/pagina.js';

// Registramos el componente ANTES de iniciar Alpine; en la vista se usa con x-data="almacen"
Alpine.data('almacen', almacen);

// Lo dejamos disponible en toda la página y lo iniciamos una sola vez
window.Alpine = Alpine;
Alpine.start();