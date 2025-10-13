# 🌓 Professional Dark Mode Implementation Guide

## Overview
This application features a comprehensive, professional dark mode system following industry best practices.

## Features

### ✅ Implemented
- **Automatic Theme Detection**: Respects system preferences
- **Manual Toggle**: User can override system settings
- **Persistent Storage**: Theme preference saved in localStorage
- **Smooth Transitions**: 200ms ease transitions for all theme changes
- **Accessibility**: Respects `prefers-reduced-motion`
- **Professional Color Palette**: WCAG AA compliant contrast ratios
- **Comprehensive Variables**: 50+ CSS variables for consistent theming

## Usage

### For Users
1. **Toggle Dark Mode**: Click the sun/moon icon in the navigation sidebar
2. **Auto-Detection**: Theme automatically matches your system preference
3. **Persistence**: Your choice is remembered across sessions

### For Developers

#### Using CSS Variables
```css
/* Always use CSS variables for colors */
.my-component {
  background: var(--card);
  color: var(--text);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
}
```

#### Available Variables

**Backgrounds:**
- `--bg`: Main background
- `--bg-secondary`: Secondary background
- `--card`: Card/surface background
- `--card-hover`: Card hover state

**Text:**
- `--text`: Primary text
- `--text-secondary`: Secondary text
- `--text-muted`: Muted/disabled text
- `--text-placeholder`: Placeholder text

**Borders:**
- `--border`: Standard borders
- `--border-light`: Light borders

**Brand Colors:**
- `--primary`: Primary brand color
- `--primary-hover`: Primary hover state
- `--primary-light`: Primary light variant
- `--primary-contrast`: Text on primary background

**Status Colors:**
- `--success` / `--success-light`
- `--warning` / `--warning-light`
- `--error` / `--error-light`
- `--info` / `--info-light`

**Shadows:**
- `--shadow-sm`: Small shadow
- `--shadow`: Default shadow
- `--shadow-md`: Medium shadow
- `--shadow-lg`: Large shadow

**Tables:**
- `--table-header`: Table header background
- `--table-row-hover`: Row hover state
- `--table-border`: Table borders

**Inputs:**
- `--input-bg`: Input background
- `--input-border`: Input border
- `--input-focus`: Input focus color
- `--input-disabled`: Disabled input background

#### Utility Classes

**Cards:**
```html
<div class="card">
  <!-- Automatically themed card -->
</div>
```

**Buttons:**
```html
<button class="btn btn-primary">Primary Button</button>
```

**Badges:**
```html
<span class="badge badge-success">Success</span>
<span class="badge badge-warning">Warning</span>
<span class="badge badge-error">Error</span>
<span class="badge badge-info">Info</span>
```

**Alerts:**
```html
<div class="alert alert-success">Success message</div>
<div class="alert alert-warning">Warning message</div>
<div class="alert alert-error">Error message</div>
<div class="alert alert-info">Info message</div>
```

**Tables:**
```html
<table class="table">
  <thead>
    <tr>
      <th>Column 1</th>
      <th>Column 2</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Data 1</td>
      <td>Data 2</td>
    </tr>
  </tbody>
</table>
```

## Best Practices

### ✅ DO

1. **Always use CSS variables for colors**
   ```css
   ✅ color: var(--text);
   ❌ color: #000000;
   ```

2. **Use semantic variable names**
   ```css
   ✅ background: var(--card);
   ❌ background: var(--bg-1e293b);
   ```

3. **Test in both themes**
   - Always check your UI in light and dark mode
   - Ensure sufficient contrast ratios

4. **Use utility classes when possible**
   ```html
   ✅ <div class="card">...</div>
   ❌ <div style="background: white">...</div>
   ```

### ❌ DON'T

1. **Don't use hardcoded colors**
   ```css
   ❌ color: #ffffff;
   ❌ background: rgb(255, 255, 255);
   ```

2. **Don't create theme-specific classes**
   ```css
   ❌ .dark-mode-header { }
   ✅ Use CSS variables instead
   ```

3. **Don't override theme colors inline**
   ```html
   ❌ <div style="color: black">
   ✅ <div className="text-primary">
   ```

## Adding Dark Mode to New Components

### Step 1: Use CSS Variables
```css
.my-new-component {
  background: var(--card);
  color: var(--text);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
}

.my-new-component:hover {
  background: var(--card-hover);
}
```

### Step 2: Test Both Themes
1. Open the app
2. Toggle dark mode
3. Verify all colors, shadows, and borders work correctly
4. Check contrast ratios with browser dev tools

### Step 3: Document Any Custom Variables
If you need component-specific theme variables:

```css
:root {
  --my-component-bg: var(--card);
  --my-component-accent: var(--primary);
}

.dark {
  --my-component-bg: var(--bg-secondary);
  --my-component-accent: var(--primary-light);
}
```

## Accessibility

### Contrast Ratios
- **Light Mode**: Minimum 4.5:1 for normal text
- **Dark Mode**: Minimum 4.5:1 for normal text
- **Large Text**: Minimum 3:1

### Reduced Motion
Users who prefer reduced motion will not see theme transitions:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
  }
}
```

## Browser Support
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Opera (latest)

## Troubleshooting

### Theme not switching?
1. Check console for errors
2. Verify `data-theme` attribute on `<html>` element
3. Clear localStorage: `localStorage.removeItem('theme')`

### Colors look wrong?
1. Ensure you're using CSS variables, not hardcoded colors
2. Check if component has inline styles overriding theme
3. Verify variable names match the ones in `index.css`

### Transition issues?
1. Check if `prefers-reduced-motion` is set in your OS
2. Verify transition properties are correct
3. Some properties don't transition (like `display`)

## Resources
- [WCAG Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [CSS Variables MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)

## Maintainers
For questions or issues with dark mode, contact the frontend team.

Last Updated: 2025-10-13
