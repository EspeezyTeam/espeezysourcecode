'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createServerSupabaseClient } from '@/utils/supabase/server'
import { validateEmailRateLimit } from '@/utils/email-rate-limit'

export async function login(formData: FormData) {
  const supabase = await createServerSupabaseClient()

  const honeypot = formData.get('hp_field') as string;
  if (honeypot) {
    redirect(`/login?error=${encodeURIComponent('Security protocol triggered: Automated access denied.')}`)
  }

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const supabase = await createServerSupabaseClient()

  const honeypot = formData.get('hp_field') as string;
  if (honeypot) {
    redirect(`/login?error=${encodeURIComponent('Security protocol triggered: Automated access denied.')}`)
  }

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const school_id = formData.get('school_id') as string
  const legal_accepted = formData.get('legal_accepted') === 'on'

  if (!legal_accepted) {
    redirect(`/login?error=${encodeURIComponent('You must accept the legal policies to continue.')}`)
  }

  const requestHeaders = await headers()
  const ip =
    requestHeaders.get('x-forwarded-for')?.split(',')[0].trim() ||
    requestHeaders.get('x-real-ip') ||
    'unknown'

  const limit = validateEmailRateLimit(email, ip)
  if (!limit.allowed) {
    redirect(
      `/login?error=${encodeURIComponent(limit.message ?? 'Too many signup attempts. Please try again later.')}`
    )
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        school_id,
        legal_accepted: true
      }
    }
  })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
