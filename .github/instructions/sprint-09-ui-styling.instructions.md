---
name: sprint-09-ui-styling
description: "Use when styling or creating CSS/SCSS for Sprint 9 trading UI components. Enforces the Sage and forest theme: CSS custom properties only, no hard-coded colors, 8/10/12px radius, token-based spacing, accessible status badges, and WCAG AA contrast."
applyTo: "sprint-09-trading-ui/src/**/*.scss|sprint-09-trading-ui/src/**/styles.css|sprint-09-trading-ui/src/**/*.component.scss"
---

# Sprint 9 UI Styling (Sage and Forest Theme)

## Global Setup

### 1. Define Theme Tokens in Global Stylesheet

Create or update `src/styles.css` (or `src/styles.scss`) with theme tokens as CSS custom properties.

**File: `src/styles.css`**

```css
/* Sage and Forest Theme Tokens */
:root {
  /* Neutral surfaces */
  --bg: #f3f5ef;           /* Page background, input fill */
  --surface: #fcfdf9;      /* Cards, nav bar */
  --line: #d8dfcf;         /* All borders and dividers */
  
  /* Text */
  --text: #1f2a22;         /* Primary text */
  --muted: #66736a;        /* Labels, secondary text, headers */
  
  /* Accent: Deep green */
  --accent: #2f6b4f;       /* Primary button, focus ring, active nav */
  --on-accent: #ffffff;    /* Text on accent backgrounds */
  
  /* Status: FILLED (green) */
  --ok: #2f6b4f;
  --ok-bg: #e0eee5;
  
  /* Status: NEW (blue) */
  --new: #345f8a;
  --new-bg: #e2ecf5;
  
  /* Status: REJECTED (red) */
  --reject: #a5382c;
  --reject-bg: #f8e5e1;
  
  /* Status: CANCELLED (gray) */
  --cancel: #5f6a62;
  --cancel-bg: #e8ebe4;
}

/* Global styles */
* {
  box-sizing: border-box;
}

body {
  font-family: "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 13px;
  color: var(--text);
  background-color: var(--bg);
  margin: 0;
  padding: 0;
}

/* Respect motion preferences */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 2. Component Global Styles

```css
/* Inputs */
input, textarea, select {
  font-family: inherit;
  font-size: inherit;
  color: var(--text);
  background-color: var(--bg);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 8px 12px;
  transition: border-color 0.2s;
}

input:focus, textarea:focus, select:focus {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-color: var(--accent);
}

input:disabled, textarea:disabled, select:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Read-only fields (dashed border, muted text) */
input:read-only {
  border: 1px dashed var(--muted);
  color: var(--muted);
  background-color: var(--surface);
}

/* Buttons */
button {
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: opacity 0.2s;
}

/* Primary button */
button.primary {
  background-color: var(--accent);
  color: var(--on-accent);
}

button.primary:hover {
  opacity: 0.9;
}

button.primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Secondary/outline button */
button.secondary {
  background-color: var(--surface);
  color: var(--text);
  border: 1px solid var(--line);
}

button.secondary:hover {
  background-color: var(--bg);
}

/* Segmented control */
.segmented-control {
  display: inline-flex;
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
}

.segmented-control button {
  flex: 1;
  padding: 8px 14px;
  border: none;
  border-radius: 0;
  background-color: var(--bg);
  color: var(--text);
  margin: 0;
  border-right: 1px solid var(--line);
}

.segmented-control button:last-child {
  border-right: none;
}

.segmented-control button.selected {
  background-color: var(--accent);
  color: var(--on-accent);
}

/* Labels */
label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 4px;
}

/* Field hints / errors */
.field-hint {
  font-size: 13px;
  color: var(--muted);
  margin-top: 4px;
}

.field-error {
  font-size: 13px;
  color: var(--reject);
  margin-top: 4px;
}

/* Cards */
.card {
  background-color: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 14px;
}

/* Banners */
.banner {
  border-radius: 8px;
  padding: 12px 14px;
  margin: 10px 0;
  font-size: 13px;
  line-height: 1.5;
}

.banner.error {
  background-color: var(--reject-bg);
  color: var(--reject);
  border: 1px solid var(--reject);
}

.banner.info {
  background-color: var(--new-bg);
  color: var(--new);
  border: 1px solid var(--new);
}

/* Tables */
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

thead {
  background-color: var(--bg);
}

th {
  padding: 10px;
  text-align: left;
  color: var(--muted);
  font-weight: 600;
  border-bottom: 1px solid var(--line);
}

td {
  padding: 10px;
  border-bottom: 1px solid var(--line);
  color: var(--text);
}

/* Tabular numerals for financial data */
.numeric {
  font-variant-numeric: tabular-nums;
}
```

## Component Patterns

### Navigation Bar

**File: `src/components/nav-bar/nav-bar.component.ts`**

```typescript
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-nav-bar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="nav-bar">
      <div class="nav-brand">Fauxtrade</div>
      <div class="nav-links">
        <a routerLink="/dashboard" 
           routerLinkActive="active"
           [routerLinkActiveOptions]="{ exact: true }">
          Dashboard
        </a>
        <a routerLink="/order-ticket"
           routerLinkActive="active">
          Order ticket
        </a>
        <a routerLink="/blotter"
           routerLinkActive="active">
          Blotter
        </a>
      </div>
      <div class="nav-user">
        <span class="username">{{ currentUser$ | async as user }}</span>
        <a (click)="onSignOut()" href="javascript:void(0)">Sign out</a>
      </div>
    </nav>
  `,
  styles: [`
    .nav-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background-color: var(--surface);
      border-bottom: 1px solid var(--line);
      padding: 0 16px;
      height: 56px;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    
    .nav-brand {
      font-weight: 600;
      font-size: 15px;
      color: var(--text);
    }
    
    .nav-links {
      display: flex;
      gap: 24px;
    }
    
    .nav-links a {
      text-decoration: none;
      color: var(--muted);
      font-size: 13px;
      padding-bottom: 8px;
      border-bottom: 2px solid transparent;
      transition: color 0.2s;
    }
    
    .nav-links a:hover {
      color: var(--text);
    }
    
    .nav-links a.active {
      color: var(--text);
      border-bottom-color: var(--accent);
    }
    
    .nav-user {
      display: flex;
      align-items: center;
      gap: 16px;
      font-size: 13px;
    }
    
    .username {
      color: var(--text);
    }
    
    .nav-user a {
      color: var(--accent);
      text-decoration: none;
    }
    
    .nav-user a:hover {
      text-decoration: underline;
    }
  `]
})
export class NavBarComponent {
  // Implementation
}
```

### Status Badge

**File: `src/components/status-badge/status-badge.component.ts`**

```typescript
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

type OrderStatus = 'NEW' | 'FILLED' | 'REJECTED' | 'CANCELLED';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span [ngClass]="['badge', status.toLowerCase()]"
          [attr.data-status]="status">
      <span class="marker" [ngClass]="'marker-' + status.toLowerCase()"></span>
      {{ status }}
    </span>
  `,
  styles: [`
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 99px;
      font-size: 11.5px;
      font-weight: 600;
      white-space: nowrap;
    }
    
    /* NEW: Blue with filled dot (pulsing) */
    .badge.new {
      background-color: var(--new-bg);
      color: var(--new);
    }
    
    .marker-new {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: var(--new);
      animation: pulse 1.5s ease-in-out infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    
    @media (prefers-reduced-motion: reduce) {
      .marker-new {
        animation: none;
      }
    }
    
    /* FILLED: Green with diamond */
    .badge.filled {
      background-color: var(--ok-bg);
      color: var(--ok);
    }
    
    .marker-filled {
      display: inline-block;
      width: 6px;
      height: 6px;
      background-color: var(--ok);
      transform: rotate(45deg);
    }
    
    /* REJECTED: Red with dash */
    .badge.rejected {
      background-color: var(--reject-bg);
      color: var(--reject);
    }
    
    .marker-rejected {
      display: inline-block;
      width: 6px;
      height: 2px;
      background-color: var(--reject);
    }
    
    /* CANCELLED: Gray with hollow circle */
    .badge.cancelled {
      background-color: var(--cancel-bg);
      color: var(--cancel);
    }
    
    .marker-cancelled {
      display: inline-block;
      width: 6px;
      height: 6px;
      border: 1.5px solid var(--cancel);
      border-radius: 50%;
      background-color: transparent;
    }
  `]
})
export class StatusBadgeComponent {
  @Input() status: OrderStatus = 'NEW';
}
```

### Error Banner

**File: `src/components/error-banner/error-banner.component.ts`**

```typescript
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-error-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="message"
         class="banner error"
         role="alert">
      {{ message }}
    </div>
  `,
  styles: [`
    .banner {
      border-radius: 8px;
      padding: 12px 14px;
      margin: 10px 0;
      font-size: 13px;
      line-height: 1.5;
    }
    
    .banner.error {
      background-color: var(--reject-bg);
      color: var(--reject);
      border: 1px solid var(--reject);
    }
  `]
})
export class ErrorBannerComponent {
  @Input() message: string = '';
}
```

### Form Field with Validation

**File: `src/components/form-field/form-field.component.ts`**

```typescript
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, AbstractControl } from '@angular/forms';

@Component({
  selector: 'app-form-field',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="form-field">
      <label [for]="fieldId">{{ label }}</label>
      <ng-content></ng-content>
      <span *ngIf="hint && !hasError" class="field-hint">
        {{ hint }}
      </span>
      <span *ngIf="hasError" class="field-error" [id]="fieldId + '-error'">
        {{ errorMessage }}
      </span>
    </div>
  `,
  styles: [`
    .form-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 10px;
    }
    
    label {
      font-size: 13px;
      font-weight: 600;
      color: var(--text);
    }
    
    .field-hint {
      font-size: 13px;
      color: var(--muted);
      margin-top: 4px;
    }
    
    .field-error {
      font-size: 13px;
      color: var(--reject);
      margin-top: 4px;
    }
  `]
})
export class FormFieldComponent {
  @Input() fieldId: string = '';
  @Input() label: string = '';
  @Input() hint: string = '';
  @Input() errorMessage: string = '';
  @Input() control: AbstractControl | null = null;
  
  get hasError(): boolean {
    return this.control ? (this.control.invalid && this.control.touched) : false;
  }
}
```

## Color Usage Rules

### ✅ CORRECT: CSS Custom Properties

```typescript
// Component style
styles: [`
  .my-component {
    background-color: var(--surface);
    color: var(--text);
    border: 1px solid var(--line);
    border-radius: 10px;
  }
  
  .my-button {
    background-color: var(--accent);
    color: var(--on-accent);
  }
`]
```

### ❌ WRONG: Hard-Coded Colors

```typescript
// DO NOT DO THIS
styles: [`
  .my-component {
    background-color: #fcfdf9;      // Hard-coded, not maintainable
    color: #1f2a22;                // Hard-coded
    border: 1px solid #d8dfcf;     // Hard-coded
  }
`]
```

## Spacing Rules

### ✅ CORRECT: Multiples of 2 or 4

```typescript
styles: [`
  .card {
    padding: 14px;        // 14 = 4 × 3.5 (7 × 2) ✓
    margin: 10px 0;       // 10 = 5 × 2 ✓
    gap: 8px;            // 8 = 4 × 2 ✓
  }
`]
```

### ❌ WRONG: Arbitrary Spacing

```typescript
styles: [`
  .card {
    padding: 15px;       // Not a multiple of 2 or 4
    margin: 11px 0;      // Not a multiple of 2 or 4
    gap: 9px;           // Not a multiple of 2 or 4
  }
`]
```

## Radius Rules

### ✅ CORRECT: Use Specified Radiuses

```typescript
styles: [`
  .page-frame { border-radius: 12px; }
  .card { border-radius: 10px; }
  .input { border-radius: 8px; }
  .button { border-radius: 8px; }
  .banner { border-radius: 8px; }
  .badge { border-radius: 99px; }  /* Pill shape */
`]
```

### ❌ WRONG: Random Radius Values

```typescript
styles: [`
  .card { border-radius: 11px; }    // Should be 10px
  .input { border-radius: 6px; }    // Should be 8px
  .button { border-radius: 4px; }   // Should be 8px
`]
```

## Typography Rules

### ✅ CORRECT: Use Font Variants

```typescript
styles: [`
  .price {
    font-size: 13px;
    font-variant-numeric: tabular-nums;  /* Align figures */
  }
  
  .heading {
    font-size: 15px;
    font-weight: 600;
  }
  
  .key-figure {
    font-size: 20px;
    font-variant-numeric: tabular-nums;
  }
`]
```

### ❌ WRONG: No Font Variants

```typescript
styles: [`
  .price {
    font-size: 13px;
    /* Figures won't align: 10.25 vs 88.4 look misaligned */
  }
`]
```

## Status Badge Implementation

### ✅ CORRECT: Word + Shape Marker

All four statuses must be visually distinct WITHOUT colour alone.

```typescript
// NEW: Blue with filled dot (pulsing)
// ● (filled circle, animated pulse)

// FILLED: Green with diamond
// ◇ (rotated square)

// REJECTED: Red with dash
// — (horizontal line)

// CANCELLED: Gray with hollow circle
// ○ (empty circle, border only)
```

### ❌ WRONG: Colour Alone

```typescript
// DO NOT DO THIS
// Status shown by color only, no shape marker
// Users with color blindness cannot distinguish
```

## Accessibility Checklist

- [ ] All inputs have visible labels (not placeholders alone)
- [ ] Label associated via `<label for="fieldId">` (not just proximity)
- [ ] Focus ring visible (2px `--accent` outline, 2px offset)
- [ ] All keyboard interactions work (tab, enter, arrows)
- [ ] Error messages linked with `aria-describedby`
- [ ] Error banners have `role="alert"`
- [ ] Status banners have `role="status"`
- [ ] Motion animations disabled under `prefers-reduced-motion`
- [ ] Contrast meets WCAG AA (4.5:1 for body text)

## Test Checklist

Before committing component styles:

```bash
# Visual tests
- [ ] Screenshot matches theme mockup
- [ ] Colors use CSS variables (inspect with DevTools)
- [ ] Spacing matches multiples of 2/4 (measure with DevTools)
- [ ] Radius values correct (12/10/8/99px as specified)
- [ ] Status badges show all four states with distinct markers

# Accessibility tests
- [ ] Tab through all inputs (focus visible)
- [ ] All labels present and associated
- [ ] WCAG AA contrast verified (#1f2a22 on #f3f5ef = 16.8:1 ✓)
- [ ] prefers-reduced-motion: animation disabled
- [ ] Screen reader announces banners (role="alert"/"status")

# Browser tests
- [ ] Light theme only (dark mode out of scope)
- [ ] No console errors or warnings
- [ ] Responsive (mobile/tablet/desktop)
```

## Summary

| Rule | Do | Don't |
|------|----|----|
| **Colors** | Use `var(--color)` | Hard-code `#hex` |
| **Spacing** | Multiples of 2 or 4 | Arbitrary values |
| **Radius** | 12/10/8/99px only | Random values |
| **Fonts** | 13px base, 15px headings, 20px figures | Inconsistent sizes |
| **Variants** | `font-variant-numeric: tabular-nums` on prices | Default proportional numerals |
| **Status** | Word + shape marker | Colour alone |
| **Focus** | Visible 2px outline | No focus ring |
| **Motion** | Respect `prefers-reduced-motion` | Always animate |
| **Contrast** | ≥4.5:1 WCAG AA | Low contrast text |
