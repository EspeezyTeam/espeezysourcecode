/**
 * GET /api/student/certificate/[id]/pdf
 * Generate and stream a verifiable PDF certificate using jsPDF.
 *
 * Public endpoint — the certificate ID acts as the access token.
 * The PDF is generated on-the-fly (no stored file needed).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/server'
import jsPDF from 'jspdf'

export const dynamic = 'force-dynamic'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://espeezy.com'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(id)) return new NextResponse('Not found', { status: 404 })

  const svc = await createAdminClient()

  // Fetch certificate + profile
  const { data: cert } = await svc
    .from('certificates')
    .select('id, user_id, program_name, issue_date, graduation_year, gpa, achievements, blockchain_hash, revoked')
    .eq('id', id)
    .maybeSingle()

  if (!cert || cert.revoked) return new NextResponse('Certificate not found', { status: 404 })

  const { data: profile } = await svc
    .from('profiles')
    .select('display_name')
    .eq('id', cert.user_id)
    .maybeSingle()

  const displayName: string = profile?.display_name ?? 'Scholar'
  const issueDate = new Date(cert.issue_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  // ─── Build PDF ───────────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = 297
  const H = 210

  // Background
  doc.setFillColor(6, 10, 15)
  doc.rect(0, 0, W, H, 'F')

  // Decorative border
  doc.setDrawColor(16, 185, 129)
  doc.setLineWidth(0.8)
  doc.rect(10, 10, W - 20, H - 20, 'S')
  doc.setLineWidth(0.3)
  doc.rect(13, 13, W - 26, H - 26, 'S')

  // Header — brand
  doc.setTextColor(16, 185, 129)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('ESPEEZY  ·  ACADEMIC CREDENTIALS', W / 2, 28, { align: 'center' })

  // Title
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.text('Certificate of Completion', W / 2, 52, { align: 'center' })

  // Subtitle
  doc.setTextColor(160, 160, 160)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('This is to certify that', W / 2, 68, { align: 'center' })

  // Recipient name
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(26)
  doc.setFont('helvetica', 'bold')
  doc.text(displayName, W / 2, 84, { align: 'center' })

  // Program
  doc.setTextColor(160, 160, 160)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('has successfully completed', W / 2, 96, { align: 'center' })

  doc.setTextColor(16, 185, 129)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(cert.program_name, W / 2, 109, { align: 'center' })

  // GPA
  if (cert.gpa) {
    doc.setTextColor(200, 200, 200)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`GPA: ${cert.gpa.toFixed(2)}`, W / 2, 120, { align: 'center' })
  }

  // Achievements
  if (cert.achievements?.length) {
    doc.setTextColor(180, 180, 180)
    doc.setFontSize(9)
    const achText = cert.achievements.join('  ·  ')
    doc.text(achText, W / 2, 130, { align: 'center', maxWidth: 240 })
  }

  // Divider
  doc.setDrawColor(16, 185, 129)
  doc.setLineWidth(0.3)
  doc.line(60, 140, W - 60, 140)

  // Date + graduation year
  doc.setTextColor(160, 160, 160)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Issued: ${issueDate}`, 60, 148)
  if (cert.graduation_year) {
    doc.text(`Graduation Year: ${cert.graduation_year}`, W - 60, 148, { align: 'right' })
  }

  // Certificate ID and verify URL
  doc.setFontSize(7.5)
  doc.setTextColor(120, 120, 120)
  doc.text(`Certificate ID: ${cert.id}`, W / 2, 158, { align: 'center' })
  doc.text(`Verify at: ${APP_URL}/certificate/${cert.id}`, W / 2, 164, { align: 'center' })

  if (cert.blockchain_hash) {
    doc.setFontSize(6.5)
    doc.setTextColor(80, 80, 80)
    doc.text(`SHA-256: ${cert.blockchain_hash}`, W / 2, 170, { align: 'center' })
  }

  // Footer
  doc.setTextColor(40, 120, 80)
  doc.setFontSize(8)
  doc.text('Espeezy Academic Credentials  ·  espeezy.com  ·  Tamper-evident certificate', W / 2, H - 18, { align: 'center' })

  // ─── Return as PDF ─────────────────────────────────────────────────────────
  const pdfBytes = doc.output('arraybuffer')
  const safeFileName = displayName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)

  return new NextResponse(pdfBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="espeezy-certificate-${safeFileName}.pdf"`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
