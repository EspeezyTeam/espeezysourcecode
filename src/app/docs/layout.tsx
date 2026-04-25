'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Menu, X, ChevronRight, BookOpen, Zap, 
  Shield, Users, Milestone, Activity, Sparkles,
  Search, ArrowLeft
} from 'lucide-react'

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const pathname = usePathname()

  const sections = [
    {
      title: 'Getting Started',
      items: [
        { label: 'Introduction', href: '/docs' },
        { label: 'Quick Start', href: '/docs/getting-started' },
        { label: 'Installation', href: '/docs/installation' },
      ]
    },
    {
      title: 'Features (ELI12)',
      items: [
        { label: 'Kanban Boards', href: '/docs/features/kanban' },
        { label: 'Academic Roadmap', href: '/docs/features/roadmap' },
        { label: 'Peer Network', href: '/docs/features/network' },
        { label: 'Marketplace', href: '/docs/features/marketplace' },
        { label: 'Skirmish Games', href: '/docs/features/skirmish' },
        { label: 'Smart Search', href: '/docs/features/search' },
      ]
    },
    {
      title: 'Infrastructure',
      items: [
        { label: 'Stripe Integration', href: '/docs/infra/payments' },
        { label: 'Supabase Sync', href: '/docs/infra/sync' },
        { label: 'Real-time Presence', href: '/docs/infra/presence' },
      ]
    }
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#f3f4f6' }}>
      
      {/* Search Header */}
      <header style={{ 
        height: '64px', borderBottom: '1px solid #222', 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 2rem', position: 'sticky', top: 0, zIndex: 1000,
        background: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(12px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: '#f3f4f6' }}>
            <div style={{ width: '28px', height: '28px', background: '#10b981', borderRadius: '6px' }} />
            <span style={{ fontWeight: 700, fontSize: '1rem' }}>Espeezy <span style={{ color: '#666', fontWeight: 500 }}>Docs</span></span>
          </Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
           <button 
             onClick={() => setIsSidebarOpen(!isSidebarOpen)}
             className="hide-desktop"
             style={{ background: 'none', border: 'none', color: '#f3f4f6', cursor: 'pointer' }}
           >
              {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
           </button>
        </div>
      </header>

      <div style={{ display: 'flex', maxWidth: '1440px', margin: '0 auto' }}>
        
        {/* Sidebar */}
        <aside style={{ 
          width: '280px', height: 'calc(100vh - 64px)', 
          borderRight: '1px solid #222', padding: '2rem',
          position: 'sticky', top: '64px',
          overflowY: 'auto'
        }} className="docs-sidebar">
           {sections.map((section, idx) => (
             <div key={idx} style={{ marginBottom: '2.5rem' }}>
                <h4 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', marginBottom: '1rem' }}>
                  {section.title}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                   {section.items.map((item, i) => {
                     const active = pathname === item.href
                     return (
                       <Link 
                         key={i} 
                         href={item.href}
                         style={{
                           textDecoration: 'none',
                           fontSize: '0.875rem',
                           color: active ? '#10b981' : '#9ca3af',
                           fontWeight: active ? 600 : 500,
                           padding: '0.25rem 0',
                           transition: 'color 0.2s',
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'space-between'
                         }}
                         className="docs-link"
                       >
                         {item.label}
                         {active && <ChevronRight size={14} />}
                       </Link>
                     )
                   })}
                </div>
             </div>
           ))}
        </aside>

        {/* Content */}
        <main style={{ flex: 1, padding: '3rem 4rem', maxWidth: '900px' }} className="docs-main">
           {children}
        </main>
      </div>

      <style jsx>{`
        .docs-link:hover { color: #f3f4f6 !important; }
        
        @media (max-width: 1024px) {
          .docs-sidebar {
            position: fixed;
            left: ${isSidebarOpen ? '0' : '-100%'};
            top: 64px;
            bottom: 0;
            background: #0a0a0a;
            z-index: 900;
            transition: left 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            width: 80%;
          }
          .docs-main {
            padding: 2rem 1.5rem;
          }
          .hide-desktop { display: block !important; }
        }
        
        @media (min-width: 1025px) {
          .hide-desktop { display: none !important; }
        }
      `}</style>
    </div>
  )
}
