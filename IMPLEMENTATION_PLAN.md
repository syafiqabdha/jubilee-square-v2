# Implementation Plan: Tenant Interactivity & Digital Signage Live Controls

## Overview
Enhance tenant directory engagement and digital signage with WhatsApp integration, detailed schedules, floor plan highlighting, and live signage controls.

## Changes Required

### 1. WhatsApp Click-to-Chat Integration

#### A. Update Tenant Type Schema (`packages/shared/src/types.ts`)
- Already has `whatsapp: string | null` field ✓
- Need to validate format in components

#### B. Tenant Card Enhancement (`apps/web/src/components/DirectorySection.astro`)
- Add WhatsApp CTA button when `tenant.whatsapp` exists
- Format as `https://wa.me/{cleanNumber}` with proper icon
- Position in card footer alongside status badge

#### C. Tenant Drawer Enhancement (`apps/web/src/components/TenantDrawer.astro`)
- Add WhatsApp button in action group (line 51-58)
- Render alongside existing Call button
- Use same styling and icon pattern

### 2. Full 7-Day Schedule Breakdown

#### A. Tenant Drawer (`apps/web/src/components/TenantDrawer.astro`)
- Already has 7-day schedule display (lines 92-98, 274-317) ✓
- Add real-time open/closed indicators per day
- Enhance visual hierarchy with icons and better spacing
- Show special notes when available

### 3. Floor Plan Highlight on Drawer Open

#### A. Tenant Drawer Component
- Already has floor map callout (lines 68-82) ✓
- Add new prop/data attribute to pass floor level for highlighting
- When drawer opens, emit event or call function to highlight tenant location on BuildingFloorExplorer

#### B. BuildingFloorExplorer Component Integration
- Read `apps/web/src/components/BuildingFloorExplorer.astro` to understand structure
- Add highlight state management
- Expose `highlightTenant(floorLevel, unitNumber)` function
- Add visual emphasis (glow, pulse, or scale animation) on target unit

### 4. Digital Signage Enhancements (`apps/web/src/pages/signage.astro`)

#### A. Rotating Promotion Slide Deck
- Add configurable interval controls (5s, 10s, 15s, 30s options)
- Implement auto-rotating carousel with smooth transitions
- Add pause/play controls
- Show progress indicators

#### B. Emergency Banner Component
- Create broadcast announcement banner component
- High-visibility styling with jubilee-red background
- Toggle controls (show/hide)
- Editable message text input
- WCAG AAA contrast maintained on dark canvas (`#0B0F19`)

### 5. Accessibility & Visual Standards
- Maintain WCAG 2.1 AAA contrast on signage dark canvas
- Test WhatsApp buttons with keyboard navigation
- Ensure screen reader compatibility
- Add proper ARIA labels and roles

## Implementation Order

1. ✅ Read and understand current codebase structure
2. Add WhatsApp CTAs to tenant cards and drawer
3. Enhance 7-day schedule with live indicators
4. Implement floor plan highlighting (if BuildingFloorExplorer allows)
5. Build signage slide rotation with controls
6. Add emergency banner component to signage
7. Test all interactions on mobile and desktop
8. Verify zero layout regressions
9. Run build and fix any errors

## Technical Notes

- Monorepo structure: changes span `apps/web` and potentially `packages/shared`
- Astro 5 SSR with Tailwind CSS
- TypeScript strict mode
- Brand colors: `--jubilee-navy` (#252F81), `--jubilee-red` (#C60A4D)
- Dark signage surface: `#0B0F19`
