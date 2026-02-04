# Icon Migration Guide

## Setup Complete ✅

The unified `Icon` component is ready to use. It supports both Lucide library icons and custom SVG icons.

**Installed:**
- `lucide-react-native` package
- Custom Icon component at `src/shared/components/Icon.tsx`

## Usage

### Import the Icon component

```typescript
import { Icon } from '../../../shared/components';
```

### Use Lucide icons

```typescript
<Icon
  name="Camera"
  size={20}
  color={dynamicTheme.colors.text.primary}
/>
```

### Use custom icons

```typescript
<Icon
  name="CustomCamera"
  size={24}
  color={dynamicTheme.colors.text.tertiary}
/>
```

## Custom Icons Available

The following custom icons are currently registered:

| Icon Name | Source | Why Custom? |
|-----------|--------|-------------|
| `CustomCamera` | PhotoGallery.tsx | Preferred visual design |
| `CustomGallery` | PhotoGallery.tsx | Preferred visual design |

## Migration Pattern

### Before (Inline SVG):

```typescript
import Svg, { Path } from 'react-native-svg';

<Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
  <Path
    d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
    stroke={dynamicTheme.colors.text.tertiary}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  />
  <Path
    d="M12 17a4 4 0 100-8 4 4 0 000 8z"
    stroke={dynamicTheme.colors.text.tertiary}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  />
</Svg>
```

### After (Icon component):

```typescript
import { Icon } from '../../../shared/components';

<Icon name="Camera" size={20} color={dynamicTheme.colors.text.tertiary} />
```

**Result:**
- 12 lines → 1 line
- Cleaner code
- Type-safe icon names
- Consistent sizing and coloring

## Adding More Custom Icons

To add a new custom icon to the registry:

1. Open `src/shared/components/Icon.tsx`
2. Add to the `CustomIcons` object:

```typescript
const CustomIcons = {
  CustomCamera: (props: any) => (
    <Svg viewBox="0 0 24 24" fill="none" {...props}>
      {/* SVG paths */}
    </Svg>
  ),

  // Add your new custom icon here:
  CustomYourIcon: (props: any) => (
    <Svg viewBox="0 0 24 24" fill="none" {...props}>
      {/* Your SVG paths */}
    </Svg>
  ),
};
```

3. Use it: `<Icon name="CustomYourIcon" size={24} />`

## Available Lucide Icons

See full list at: https://lucide.dev/icons/

Common icons from the audit:
- `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`
- `X`, `Check`, `Plus`, `Minus`
- `Camera`, `Image` (Gallery)
- `MapPin` (Location)
- `Circle` (Status)
- `Bookmark` (Type)
- `Calendar` (Due Date)
- `Star` (Rating)
- `Flag` (Priority)
- `ChevronDown`, `ChevronUp`, `ChevronLeft`, `ChevronRight`
- `Trash2` (Delete)
- `Settings`, `Search`, `Filter`
- `MoreVertical` (vertical dots)
- `Eye`, `EyeOff`

## Migration Priority

Based on the audit report (`svg-icon-audit.html`):

**High Priority (most frequent):**
1. Navigation arrows (ArrowLeft, ChevronDown, etc.) - 8 files
2. Camera/Gallery - PhotoGallery.tsx, AttributesPicker.tsx
3. Status icons - MetadataBar.tsx, AttributesPicker.tsx
4. Common actions (Plus, X, Trash2) - Multiple files

**Medium Priority:**
5. Attribute icons (MapPin, Star, Flag, Calendar, Bookmark)
6. UI controls (Settings, Search, Filter)

**Low Priority:**
7. One-off icons in specific screens

## Next Steps

1. Review `apps/mobile/svg-icon-audit.html` to identify which icons to migrate
2. Decide which additional custom icons (if any) to add to the registry
3. Migrate files one at a time, testing after each change
4. Run `npm run type-check:mobile` after migrations to ensure type safety

## Type Safety

The Icon component provides full TypeScript support:

```typescript
// ✅ Valid - icon exists
<Icon name="Camera" size={20} />

// ❌ Type error - icon doesn't exist
<Icon name="NonExistentIcon" size={20} />
//    ^^^^ Type error: "NonExistentIcon" is not assignable to type IconName
```

## Performance

**Bundle size comparison:**
- Lucide: ~25KB (tree-shakeable, only icons you use)
- FontAwesome: ~2MB (entire library)
- Custom SVG: Minimal overhead per icon

**Recommended:** Use Lucide for most icons, reserve custom icons for specific design preferences.
