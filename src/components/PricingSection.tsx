'use client'

import { useState } from 'react'
import { Sparkles, CheckCircle2, ArrowRight, Zap, Crown, Rocket } from 'lucide-react'

interface PricingSectionProps {
  showTitle?: boolean
  isLanding?: boolean
}

const PLANS = [
  {
    id: 'free',
    name: 'Starter',
    icon: <Zap size={20} />,
    price: '£0',
    period: '/forever',
    tagline: 'Everything you need to stop carrying your team.',
    cta: 'Get Started Free',
    highlight: false,
    features: [
      'Unlimited group projects',
      'Individual contribution tracking',
      'Task assignment & deadlines',
      'Real-time collaboration',
      'Basic analytics dashboard',
      'Mobile app access',
      'Up to 5 team members per project',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: <Rocket size={20} />,
    price: '£3.99',
    period: '/month',
    tagline: 'For students who refuse to settle for average.',
    cta: 'Upgrade to Pro',
    highlight: true,
    badge: 'Most Popular',
    features: [
      'Everything in Starter, plus:',
      'Unlimited team members',
      'AI-powered contribution analysis',
      'Advanced analytics & heatmaps',
      'Peer review & rating system',
      'Export reports as PDF',
      'Priority support',
      'Custom group branding',
    ],
  },
  {
    id: 'institution',
    name: 'Institution',
    icon: <Crown size={20} />,
    price: '£49',
    period: '/year per seat',
    tagline: 'Built for universities and departments at scale.',
    cta: 'Contact Sales',
    highlight: false,
    features: [
      'Everything in Pro, plus:',
      'LMS integration (Canvas, Moodle, Blackboard)',
      'Educator admin dashboard',
      'Bulk student onboarding',
      'Academic integrity reports',
      'Custom SSO / SAML',
      'Dedicated account manager',
      'SLA & uptime guarantee',
    ],
  },
]

export default function PricingSection({ showTitle = true, isLanding = false }: PricingSectionProps) {
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null)

  const handleSelectPlan = (planId: string) => {
    if (planId === 'free') {
      window.location.href = '/preregister'
    } else if (planId === 'institution') {
      window.location.href = 'mailto:sales@espeezy.com?subject=Institution Plan Inquiry'
    } else {
      window.location.href = '/preregister'
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '4rem' }}>

      {showTitle && (
        <div style={{ color: 'white', display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: isLanding ? 'center' : 'left' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isLanding ? 'center' : 'flex-start',
            gap: '0.75rem',
            fontSize: '0.8rem',
            color: 'var(--brand)',
            fontWeight: 900,
            textTransform: 'uppercase' as const,
            letterSpacing: '2px'
          }}>
            <Sparkles size={18} /> Simple, honest pricing
          </div>
          <h2 style={{ fontSize: 'clamp(2.2rem, 5vw, 4rem)', lineHeight: 1, fontWeight: 950, letterSpacing: '-0.05em', color: 'white', margin: 0 }}>
            Free for students.<br />
            <span style={{ color: 'var(--brand)' }}>Powerful for everyone.</span>
          </h2>
          <p style={{
            maxWidth: '640px',
            margin: isLanding ? '0 auto' : '0',
            color: 'rgba(255,255,255,0.5)',
            fontSize: '1.1rem',
            fontWeight: 500,
            lineHeight: 1.6
          }}>
            We know you&apos;re a student. We know budgets are tight. That&apos;s why the core platform is free — forever. No hidden fees, no trial that expires, no bait-and-switch.
          </p>
        </div>
      )}

      {/* ── Trust bar ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '2.5rem',
        flexWrap: 'wrap',
        padding: '1.25rem 0',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        {[
          { value: '100%', label: 'Free tier — no card required' },
          { value: '256-bit', label: 'SSL encryption on all data' },
          { value: 'GDPR', label: 'Fully compliant' },
          { value: '99.9%', label: 'Uptime SLA on Pro+' },
        ].map((stat, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 950, color: 'var(--brand)', letterSpacing: '-0.02em' }}>{stat.value}</div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── Plan cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {PLANS.map((plan) => {
          const isHovered = hoveredPlan === plan.id
          const isPro = plan.highlight

          return (
            <div
              key={plan.id}
              onMouseEnter={() => setHoveredPlan(plan.id)}
              onMouseLeave={() => setHoveredPlan(null)}
              style={{
                position: 'relative',
                padding: '2.5rem 2rem',
                borderRadius: '24px',
                background: isPro
                  ? 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(16,185,129,0.02) 100%)'
                  : 'rgba(255,255,255,0.015)',
                border: isPro
                  ? '2px solid rgba(16,185,129,0.3)'
                  : `1px solid rgba(255,255,255,${isHovered ? '0.12' : '0.06'})`,
                backdropFilter: 'blur(20px)',
                display: 'flex',
                flexDirection: 'column' as const,
                gap: '1.5rem',
                transition: 'all 0.3s ease',
                transform: isHovered ? 'translateY(-4px)' : 'none',
                boxShadow: isPro
                  ? '0 20px 60px rgba(16,185,129,0.1)'
                  : isHovered
                    ? '0 20px 40px rgba(0,0,0,0.3)'
                    : 'none',
              }}
            >
              {/* Badge */}
              {plan.badge && (
                <div style={{
                  position: 'absolute',
                  top: '-12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  padding: '6px 20px',
                  background: 'var(--brand)',
                  borderRadius: '100px',
                  fontSize: '0.7rem',
                  fontWeight: 900,
                  color: 'white',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.15em',
                  whiteSpace: 'nowrap' as const,
                  boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                }}>
                  {plan.badge}
                </div>
              )}

              {/* Header */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: isPro ? 'var(--brand)' : 'rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isPro ? 'white' : 'rgba(255,255,255,0.5)',
                  }}>
                    {plan.icon}
                  </div>
                  <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em' }}>{plan.name}</span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                  {plan.tagline}
                </p>
              </div>

              {/* Price */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                <span style={{
                  fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
                  fontWeight: 950,
                  color: 'white',
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                }}>
                  {plan.price}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 700, fontSize: '0.85rem' }}>
                  {plan.period}
                </span>
              </div>

              {/* CTA */}
              <button
                onClick={() => handleSelectPlan(plan.id)}
                style={{
                  width: '100%',
                  padding: '0.95rem',
                  borderRadius: '14px',
                  background: isPro
                    ? 'linear-gradient(135deg, var(--brand) 0%, #059669 100%)'
                    : 'rgba(255,255,255,0.06)',
                  color: isPro ? 'white' : 'rgba(255,255,255,0.8)',
                  fontWeight: 900,
                  fontSize: '0.9rem',
                  border: isPro ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s',
                  boxShadow: isPro ? '0 8px 24px rgba(16,185,129,0.25)' : 'none',
                  letterSpacing: '-0.01em',
                }}
              >
                {plan.cta} <ArrowRight size={16} />
              </button>

              {/* Features */}
              <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' as const, gap: '0.85rem' }}>
                {plan.features.map((feature, i) => (
                  <li key={i} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    fontSize: '0.83rem',
                    color: i === 0 && plan.id !== 'free' ? 'var(--brand)' : 'rgba(255,255,255,0.65)',
                    fontWeight: i === 0 && plan.id !== 'free' ? 800 : 600,
                    lineHeight: 1.4,
                  }}>
                    <CheckCircle2 size={15} style={{
                      color: isPro ? 'var(--brand)' : 'rgba(255,255,255,0.25)',
                      flexShrink: 0,
                      marginTop: '2px',
                    }} />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      {/* ── Bottom guarantee ── */}
      <div style={{
        textAlign: 'center',
        padding: '2rem',
        borderRadius: '20px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}>
        <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.6 }}>
          🎓 <strong style={{ color: 'white' }}>Student-first promise:</strong> The free tier is not a trial. It&apos;s a full product. We believe every student deserves access to world-class collaboration tools — regardless of budget. Pro exists for those who want more, not because we&apos;re gating the basics.
        </p>
      </div>
    </div>
  )
}
