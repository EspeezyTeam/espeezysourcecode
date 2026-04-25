import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact | Espeezy',
  description: 'Contact Espeezy support and business team.',
}

export default function ContactPage() {
  return (
    <main style={{ maxWidth: '880px', margin: '0 auto', padding: '3rem 1.25rem 4rem', lineHeight: 1.6 }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Contact Espeezy</h1>
      <p>
        For support, business verification, or account questions, use the channels below.
      </p>

      <h2 style={{ marginTop: '2rem' }}>Support</h2>
      <p>Email: support@espeezy.com</p>

      <h2 style={{ marginTop: '2rem' }}>Business</h2>
      <p>Email: business@espeezy.com</p>

      <h2 style={{ marginTop: '2rem' }}>Address</h2>
      <p>Espeezy (Online Service)</p>

      <h2 style={{ marginTop: '2rem' }}>Response Time</h2>
      <p>We typically respond within 1-2 business days.</p>
    </main>
  )
}
