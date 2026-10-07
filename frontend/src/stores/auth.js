import { defineStore } from 'pinia'
import { supabase } from '@/services/supabase'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    session: null
  }),
  actions: {
    async iniciarSesion(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      this.user = data.user
      this.session = data.session
    },
    async cerrarSesion() {
      await supabase.auth.signOut()
      this.user = null
      this.session = null
    },
    async cargarSesion() {
      const { data } = await supabase.auth.getSession()
      this.session = data.session
      this.user = data.session?.user ?? null
    }
  }
})