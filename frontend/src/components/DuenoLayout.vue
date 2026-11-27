<script setup>
import { auth0 } from '@/services/auth0'

const salir = () =>
  auth0.logout({ logoutParams: { returnTo: `${window.location.origin}/login` } })
</script>

<template>
  <div class="d-app">
    <header class="d-top">
      <strong class="d-marca">Serviteca · Dueño</strong>
      <nav class="d-nav">
        <RouterLink :to="{ name: 'dueno' }" exact-active-class="on">Resumen</RouterLink>
        <RouterLink :to="{ name: 'dueno-pagos' }" exact-active-class="on">Pagos</RouterLink>
        <RouterLink :to="{ name: 'dueno-personal' }" exact-active-class="on">Personal</RouterLink>
        <RouterLink :to="{ name: 'dueno-clientes' }" exact-active-class="on">Clientes</RouterLink>
        <RouterLink :to="{ name: 'dueno-inventario' }" exact-active-class="on">Inventario</RouterLink>
        <RouterLink :to="{ name: 'dueno-reportes' }" exact-active-class="on">Reportes</RouterLink>
      </nav>
      <div class="d-acciones">
        <RouterLink :to="{ name: 'ordenes' }" class="d-link">Ir al taller</RouterLink>
        <button @click="salir">Cerrar sesión</button>
      </div>
    </header>
    <main class="d-main">
      <RouterView />
    </main>
  </div>
</template>

<style>
.d-app { min-height: 100vh; background: #f3f4f6; }
.d-top { display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; padding: .75rem 1.5rem; background: #111827; color: #fff; }
.d-marca { font-size: 1.05rem; }
.d-nav { display: flex; gap: .25rem; flex: 1; flex-wrap: wrap; }
.d-nav a { color: #d1d5db; text-decoration: none; padding: .4rem .8rem; border-radius: 6px; }
.d-nav a.on { background: #2563eb; color: #fff; }
.d-acciones { display: flex; align-items: center; gap: .75rem; }
.d-link { color: #d1d5db; text-decoration: none; }
.d-acciones button { padding: .4rem .9rem; cursor: pointer; border-radius: 6px; border: 1px solid #4b5563; background: transparent; color: #fff; }
.d-main { padding: 1.5rem; max-width: 1300px; margin: 0 auto; }

.d-pag h1 { margin: 0 0 1rem; font-size: 1.4rem; }
.d-filtros { display: flex; gap: .75rem; align-items: flex-end; flex-wrap: wrap; margin-bottom: 1rem; }
.d-filtros label { display: flex; flex-direction: column; font-size: .85rem; color: #374151; gap: .2rem; }
.d-filtros input, .d-filtros select { padding: .4rem; border: 1px solid #d1d5db; border-radius: 6px; }
.d-filtros button { padding: .5rem 1rem; cursor: pointer; border-radius: 6px; border: 1px solid #d1d5db; background: #fff; }
.d-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 1rem; margin-bottom: 1rem; }
.d-card h2 { margin: 0 0 .75rem; font-size: 1rem; }
.d-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
.d-kpi { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: .9rem; display: flex; flex-direction: column; gap: .2rem; }
.d-kpi span { color: #6b7280; font-size: .8rem; }
.d-kpi strong { font-size: 1.3rem; }
.d-kpi.warn strong { color: #b45309; }
.d-scroll { overflow-x: auto; }
.d-tabla { width: 100%; border-collapse: collapse; font-size: .9rem; }
.d-tabla th, .d-tabla td { padding: .5rem; border-bottom: 1px solid #f3f4f6; text-align: left; vertical-align: top; }
.d-tabla th { color: #6b7280; font-size: .75rem; text-transform: uppercase; }
.d-tabla .num { text-align: right; white-space: nowrap; }
.d-tabla tr.click { cursor: pointer; }
.d-tabla tr.click:hover { background: #f9fafb; }
.d-tabla tr.sel { background: #eff6ff; }
.d-vacio { color: #9ca3af; text-align: center; padding: 1rem; }
.d-error { background: #fee2e2; color: #b91c1c; padding: .75rem; border-radius: 8px; margin-bottom: 1rem; }
.d-badge { display: inline-block; padding: .1rem .5rem; border-radius: 999px; background: #e5e7eb; font-size: .75rem; }
.d-chips { display: flex; flex-wrap: wrap; gap: .4rem; }
.d-chip { background: #f3f4f6; border-radius: 6px; padding: .25rem .5rem; font-size: .8rem; }
.d-dos { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem; }
.d-dato { display: flex; flex-direction: column; font-size: .85rem; color: #6b7280; }
.d-dato b { color: #111827; font-size: .95rem; font-weight: 600; }
.d-datos { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: .75rem; margin-bottom: 1rem; }
.d-pos { color: #15803d; }
.d-neg { color: #b45309; }
</style>
