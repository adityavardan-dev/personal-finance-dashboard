# XPENSE Design System
Version: 1.0

---

# Vision

XPENSE is a premium personal finance application that helps users understand where their money goes while making daily expense tracking effortless.

The interface should feel calm, modern, trustworthy and premium.

Visual Inspiration

• CRED
• Apple Wallet
• Linear
• Notion

The application should never resemble a traditional admin dashboard.

The interface should feel like a modern consumer fintech application where the user's financial status is understandable within 5 seconds.

Visual hierarchy should always prioritise the current month's spending before analytical information.

Every dashboard screen should immediately answer:

• How much have I spent?
• How much budget remains?
• What changed recently?
---

# Design Principles

Every screen should be

• Minimal
• Spacious
• Intentional
• Mobile First
• Responsive
• Accessible
• Consistent

The UI should encourage users to return daily.

---

# Theme

The application must automatically follow the operating system theme.

Supported

• Light
• Dark

Implementation

Use prefers-color-scheme.

Do NOT provide a manual light/dark toggle in Version 1.

The application should always feel native to the user's device.

System Theme Behaviour

XPENSE automatically follows the operating system appearance.

Light Mode

Backgrounds become light.

Cards become white.

Hero Card remains a dark emerald gradient.

Dark Mode

Background becomes zinc-950.

Cards become zinc-900.

Hero Card remains the primary focus using a slightly brighter emerald gradient.

No manual theme toggle exists in Version 1.

---

# Color Philosophy

90% of the interface should use neutral colors.

Accent colors exist only to communicate financial meaning.

Never use bright colors for decoration.

Financial information should be understandable at a glance.

---

# Color Tokens

Application Background

Background

Light

zinc-50

Dark

zinc-950

Surface

Light

white

Dark

zinc-900

Border

Light

zinc-200

Dark

zinc-800

Hero Gradient

from-emerald-950

via-emerald-900

to-emerald-800

Primary

emerald-500

Primary Hover

emerald-400

Secondary Text

zinc-500

Dark Secondary

zinc-400
---

# Financial Color Language

Remaining Budget

Green

Income

Blue

Expenses

Red

Warning

Amber

Neutral Information

Zinc

Never introduce random colors.

---

# Typography

Page Title

text-3xl
font-bold

Section Title

text-xl
font-semibold

KPI Number

text-5xl
font-bold

Body

text-base

Secondary

text-sm
text-zinc-500

Display

text-5xl

Hero KPI

text-4xl

Page Title

text-3xl

Card Title

text-lg

Body

text-base

Metadata

text-sm

Caption

text-xs

---

# Cards

All dashboard cards must share exactly one visual style.

rounded-3xl

border

border-zinc-200

dark:border-zinc-800

bg-white

dark:bg-zinc-900

shadow-sm

Padding

24px

Cards should never have different radii or shadow styles.

Use spacing instead of heavy borders.

---

# Buttons

Primary

rounded-full

Secondary

rounded-2xl

Touch Target

Minimum 44px

---

# Spacing

Between Components

space-y-6

Between Sections

gap-6

Page Padding

px-5

py-6

Desktop Content

max-w-7xl

mx-auto

---

# Responsive Breakpoints

Small Mobile

320px

Standard Mobile

375px

Large Mobile

425px

Tablet

768px

Desktop

1024px

Large Desktop

1440px

XPENSE follows a mobile-first responsive strategy.

Layouts should progressively enhance from one breakpoint to the next while maintaining the same visual hierarchy and interaction patterns.

# Dashboard Layout

Desktop

Header

↓

Hero Card

↓

Trend | Recent Activity

↓

Insight Banner

Tablet

Header

↓

Sidebar

↓

Hero Card

↓

Trend

↓

Recent Activity

↓

Insight Banner

Mobile

Header

↓

Hero Card

↓

Trend

↓

Recent Activity

↓

Bottom Navigation

---

# Hero Card

The Hero Card is always the primary visual element.

Desktop Height

220px

Tablet Height

200px

Mobile Height

180px

Contents

Current Month

Money Spent

Budget

Circular Progress Indicator

Linear Progress Bar

Days Remaining

The Hero Card always uses a dark emerald gradient regardless of application theme.

---

# Empty States

Never show

"No Data"

Instead show

Start tracking your first expense.

Your monthly journey starts here.

Set your monthly budget to begin.

---

# Motion

Animations should be subtle.

Hover

150ms

Cards

200ms

Progress

300ms

Respect prefers-reduced-motion.

---

# Accessibility

Semantic HTML

Keyboard Navigation

Good Contrast

Minimum 44px touch targets

Responsive typography

---

# Avoid

Bootstrap appearance

Corporate dashboards

Bright gradients

Heavy shadows

Glassmorphism

Neon colors

Large floating elements

Multiple accent colors

Visual clutter

---

# Personality

The application should feel

Calm

Premium

Simple

Modern

Trustworthy

Intentional

Every screen should answer

"Where is my money going?"

---

# Navigation

Charts

Version 1 uses rounded vertical bar charts.

Primary Bars

emerald-500

Secondary Bars

emerald-200

Grid

zinc-200

Dark

zinc-800

Avoid

Pie charts

3D charts

Multiple colours

Heavy grid lines

Legends

---

# Visual Hierarchy

Every dashboard should contain

One Primary Card

(Hero)

↓

Two Secondary Cards

(Trend + Recent Activity)

↓

One Supporting Banner

(Insight)

Never create multiple Hero Cards.

The user's eye should naturally move from Hero → Trend → Recent → Insight.

---

# Onboarding Flow

First Time User

Welcome

↓

Set Monthly Budget

↓

Choose Categories

↓

Dashboard
---

# Dashboard Composition Principles

Every dashboard screen follows the same composition:

1. Primary Focus
   - Hero Card

2. Analytical Layer
   - Spending Trend
   - Recent Activity

3. Contextual Layer
   - Insight Banner

There should only ever be one primary focus on a screen. Secondary cards should support the Hero Card rather than compete with it.
---