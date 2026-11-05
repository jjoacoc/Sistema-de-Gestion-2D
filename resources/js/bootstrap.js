// Axios: librería para hacer peticiones al servidor (guardar, borrar, mover prendas...)
import axios from 'axios';

// La dejamos disponible en toda la página como window.axios
window.axios = axios;

// Esta cabecera le indica a Laravel que la petición viene de JavaScript
window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

// Token de seguridad (CSRF): se envía automáticamente en TODAS las peticiones de Axios.
// Lo lee de la etiqueta <meta name="csrf-token"> que está en la plantilla principal.
const token = document.head.querySelector('meta[name="csrf-token"]');

if (token) {
    window.axios.defaults.headers.common['X-CSRF-TOKEN'] = token.content;
}