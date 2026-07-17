# BotIcon Component Documentation

## Overview
Professional AI Trading Bot Icon for TK AI FINANCE dashboard. A scalable, glassmorphism-friendly SVG icon with purple/blue gradient accents matching the brand identity.

## Features
- **Scalable:** Multiple size presets (xs, sm, md, lg, xl, 2xl) or custom pixel sizes
- **Gradient Design:** Purple-to-blue gradient matching brand colors (#a78bfa → #3b82f6)
- **Glassmorphism Compatible:** Soft glow effects and subtle shadows
- **Dark Theme Optimized:** Designed for dark backgrounds with accent highlights
- **Professional Look:** Modern AI/robot design, not cartoonish
- **Animated Option:** Optional pulse animation for active states
- **Accessibility:** Proper SVG structure with viewBox for responsive scaling

## Usage

### Basic Import
```jsx
import BotIcon from '@/components/BotIcon';
```

### Size Presets
```jsx
<BotIcon size="xs" />   {/* 20px */}
<BotIcon size="sm" />   {/* 24px */}
<BotIcon size="md" />   {/* 32px (default) */}
<BotIcon size="lg" />   {/* 48px */}
<BotIcon size="xl" />   {/* 64px */}
<BotIcon size="2xl" />  {/* 80px */}
```

### Custom Pixel Size
```jsx
<BotIcon size={40} />
<BotIcon size={56} />
```

### With Animation
```jsx
<BotIcon size="md" animated={true} />
```

### With Custom CSS Class
```jsx
<BotIcon size="lg" className="text-primary" />
```

## Current Implementation Locations

### 1. **HomePage Header** (Primary Logo)
- **File:** `apps/web/src/pages/HomePage.jsx`
- **Location:** Top-left header next to "TK AI FINANCE" title
- **Size:** 18px
- **Purpose:** Main dashboard branding
- **Context:** Replaces Activity icon in header badge

```jsx
<div className="icon-badge grid h-9 w-9 place-items-center gradient-accent text-white">
  <BotIcon size={18} />
</div>
```

### 2. **Bot Control Panel** (Status Indicator)
- **File:** `apps/web/src/pages/HomePage.jsx`
- **Location:** Bot status badge in BotControl component
- **Size:** 13px
- **Purpose:** Visual indicator for bot status
- **Context:** Shows "Bot Durumu: [Status]" with icon

```jsx
<div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${botStatus.cls}`}>
  <BotIcon size={13} /> Bot Durumu: {botStatus.label}
</div>
```

### 3. **Sidebar Bot Status Card** (Connection Indicator)
- **File:** `apps/web/src/pages/HomePage.jsx`
- **Location:** Bottom of left sidebar
- **Size:** 18px
- **Purpose:** Bot connection status display
- **Context:** Shows "TK AI Bot" with online/offline indicator

```jsx
<div className="icon-badge grid h-9 w-9 place-items-center gradient-accent text-white">
  <BotIcon size={18} />
</div>
```

### 4. **Not Connected State** (Large Hero Icon)
- **File:** `apps/web/src/pages/HomePage.jsx`
- **Location:** NotConnected component (displayed when Binance not connected)
- **Size:** 40px
- **Purpose:** Large visual prompt to connect
- **Context:** Centered in glass panel with call-to-action

```jsx
<div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20">
  <BotIcon size={40} />
</div>
```

### 5. **Account Page Header** (Settings Icon)
- **File:** `apps/web/src/pages/AccountPage.jsx`
- **Location:** Top-left header of Account Settings page
- **Size:** 18px
- **Purpose:** Consistent branding across pages
- **Context:** Replaces Activity icon in account header

```jsx
<div className="icon-badge grid h-9 w-9 place-items-center gradient-accent text-white">
  <BotIcon size={18} />
</div>
```

## Design Specifications

### Dimensions
- **Viewbox:** 64x64 (scalable to any size)
- **Stroke Width:** 1.2px (main elements), 0.8px (details)
- **Padding:** 12px from edges (internal spacing)

### Colors
- **Primary Gradient:** #a78bfa (purple) → #3b82f6 (blue)
- **Opacity Variations:** 0.1 (subtle), 0.6 (medium), 1.0 (full)
- **Glow Filter:** Gaussian blur 1.5px for soft edges

### Components
- **Head:** Circle with gradient border (8px radius)
- **Eyes:** Small circles (2px radius) with glow
- **Antennae:** Thin lines (1.2px) with dots
- **Torso:** Vertical rectangle with gradient border
- **Arms/Legs:** Lines with circle joints
- **Chest Panel:** Small detail rectangle
- **Power Indicator:** Center dot (1px)
- **Glow Ring:** Subtle outer ring (0.6px, 10% opacity)

## Styling Integration

### Icon Badge Container
The icon is typically placed in `.icon-badge` containers:
```css
.icon-badge {
  display: grid;
  place-items: center;
  border-radius: 0.85rem;
  background: linear-gradient(135deg, hsl(255 92% 76% / 0.22), hsl(217 91% 60% / 0.18));
  color: hsl(255 92% 82%);
  border: 1px solid hsl(255 92% 76% / 0.28);
}
```

### Light Mode Support
The icon automatically adapts to light mode through CSS variables:
- Gradient colors remain consistent
- Glow effects scale appropriately
- Background containers adjust opacity

## Animation Options

### Pulse Animation (Optional)
```jsx
<BotIcon size="md" animated={true} />
```

Applies Tailwind's `animate-pulse` class for subtle breathing effect.

### Custom Animations
You can add custom animations via className:
```jsx
<BotIcon size="md" className="animate-spin" />
```

## Accessibility
- **SVG Structure:** Proper viewBox for responsive scaling
- **No Alt Text Needed:** Icon is decorative or paired with text labels
- **Color Contrast:** Gradient ensures visibility on dark backgrounds
- **Focus States:** Parent elements handle focus rings

## Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- SVG filters supported (glow effect)
- CSS gradients supported
- Responsive scaling via viewBox

## Performance
- **File Size:** ~5KB (inline SVG)
- **Rendering:** GPU-accelerated gradients
- **No External Dependencies:** Pure SVG/React
- **Lazy Loading:** Component code-splits with React.lazy

## Future Enhancements
- [ ] Animated antennae movement
- [ ] Blinking eyes effect
- [ ] Pulsing power indicator
- [ ] Interactive hover states
- [ ] Multiple color variants (success/warning/error)
- [ ] SVG export for other uses (favicon, logo, etc.)

## Related Components
- `ThemeToggle` - Theme switcher in header
- `NotificationBell` - Notification indicator
- `BotControl` - Bot status and control panel
- `ConnectionPanel` - Binance connection management

## Version History
- **v1.0** (2026-07-17) - Initial professional bot icon design
  - Glassmorphism-friendly SVG
  - Purple/blue gradient
  - Multiple size presets
  - Glow effects
  - Used in 5 key locations across dashboard
