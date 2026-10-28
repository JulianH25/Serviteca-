import './assets/main.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { auth0 } from './services/auth0'

// Si el navegador restaura la página desde su caché (botón atrás), recarga para revalidar la sesión
window.addEventListener('pageshow', (e) => {
  if (e.persisted) window.location.reload()
})

createApp(App).use(createPinia()).use(auth0).use(router).mount('#app')