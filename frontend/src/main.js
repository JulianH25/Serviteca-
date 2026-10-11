import './assets/main.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { auth0 } from './services/auth0'

createApp(App).use(createPinia()).use(auth0).use(router).mount('#app')