'use client'

import React from 'react'
import Link from 'next/link'
import { Sparkles, ArrowRight, BookOpen, Fingerprint } from 'lucide-react'

export default function DocsHome() {
  return (
    <div className="docs-content">
      <div style={{ marginBottom: '4rem' }}>
        <div style={{ 
          display: 'inline-flex', padding: '6px 12px', background: 'rgba(16, 185, 129, 0.1)', 
          color: '#10b981', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, 
          marginBottom: '1rem', letterSpacing: '1px' 
        }}>
           THE Espeezy ARCHIVE
        </div>
        <h1 style={{ fontSize: '3rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: '1.5rem', color: '#f3f4f6' }}>
          Welcome to the Espeezy Documentation.
        </h1>
        <p style={{ fontSize: '1.25rem', color: '#9ca3af', lineHeight: 1.6, maxWidth: '700px' }}>
          The official technical guide for students, researchers, and technical leads. 
          Learn how to professionalize your academic collaboration through our real-time persistence protocol.
        </p>
      </div>

      <section style={{ marginBottom: '4rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>The Documentation Pipeline</h2>
        <div style={{ background: '#111', padding: '2rem', borderRadius: '16px', border: '1px solid #222' }}>
           <p style={{ margin: 0, color: '#9ca3af', lineHeight: 1.7 }}>
             <strong style={{ color: '#f3f4f6' }}>Auto-Sync Architecture:</strong> This documentation site is powered by a 
             &quot;Documentation as Code&quot; pipeline. Every page you see here is stored directly in the GitHub repository. 
             When a developer pushes an update to GitHub, the documentation site updates automatically. 
             This ensures the manual is always as up-to-date as the code.
           </p>
        </div>
      </section>

      <section style={{ marginBottom: '4rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Explaining Espeezy (ELI12)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
           <div style={{ padding: '1.5rem', background: '#111', borderRadius: '12px', border: '1px solid #222' }}>
              <div style={{ color: '#10b981', marginBottom: '1rem' }}><Sparkles size={24} /></div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>What is it?</h3>
              <p style={{ fontSize: '0.9rem', color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
                Think of Espeezy as a super-powered school project app. It&apos;s a place where you and your friends can work together on a technical project without ever losing your work.
              </p>
           </div>
           <div style={{ padding: '1.5rem', background: '#111', borderRadius: '12px', border: '1px solid #222' }}>
              <div style={{ color: '#10b981', marginBottom: '1rem' }}><BookOpen size={24} /></div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Why use it?</h3>
              <p style={{ fontSize: '0.9rem', color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
                Shared Google Docs can get messy. Espeezy uses professional tools (like Kanban and Roadmaps) to make sure everyone knows exactly what to do and when to do it.
              </p>
           </div>
        </div>
      </section>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <Link href="/docs/getting-started" style={{ 
          background: '#10b981', color: '#0a0a0a', padding: '0.75rem 1.5rem', 
          borderRadius: '8px', textDecoration: 'none', fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: '0.5rem'
        }}>
          Quick Start Guide <ArrowRight size={18} />
        </Link>
        <Link href="/docs/features/kanban" style={{ 
          color: '#f3f4f6', border: '1px solid #222', padding: '0.75rem 1.5rem', 
          borderRadius: '8px', textDecoration: 'none', fontWeight: 600
        }}>
          Explore Features
        </Link>
      </div>

      <style jsx>{`
        .docs-content {
          animation: fadeIn 0.5s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
