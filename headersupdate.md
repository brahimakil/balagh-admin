# Header Menu Colors Configuration

## Database Fields

The header menu colors are stored in the `websiteSettings` collection under these keys:

```javascript
{
  // ... other website settings
  headerMenuColor: "#333333",      // Normal menu link color (hex)
  headerMenuHoverColor: "#007bff"  // Hover/active menu link color (hex)
}
```

## Key Details

- **Collection**: `websiteSettings`
- **Document ID**: `main` 
- **Fields**:
  - `headerMenuColor`: Normal link color (hex format, default: #333333)
  - `headerMenuHoverColor`: Hover/active link color (hex format, default: #007bff)

## Usage in Frontend

To apply header menu colors in your user dashboard:

```javascript
// Get header menu colors
const getHeaderMenuColors = async () => {
  try {
    const doc = await getDoc(doc(db, 'websiteSettings', 'main'));
    if (doc.exists()) {
      const data = doc.data();
      return {
        normal: data.headerMenuColor || '#333333',
        hover: data.headerMenuHoverColor || '#007bff'
      };
    }
  } catch (error) {
    console.error('Error fetching header colors:', error);
  }
  // Fallback colors
  return {
    normal: '#333333',
    hover: '#007bff'
  };
};

// Apply to header menu
const applyHeaderColors = async () => {
  const colors = await getHeaderMenuColors();
  
  // Apply to all menu links
  document.querySelectorAll('.header-menu a, .nav-link').forEach(link => {
    link.style.color = colors.normal;
    
    link.addEventListener('mouseenter', () => {
      link.style.color = colors.hover;
    });
    
    link.addEventListener('mouseleave', () => {
      link.style.color = colors.normal;
    });
  });
};
```

## CSS Variables Approach

Set CSS custom properties for easier theming:

```javascript
// Set CSS variables from database
const applyHeaderColorVars = async () => {
  const colors = await getHeaderMenuColors();
  const root = document.documentElement;
  
  root.style.setProperty('--header-menu-color', colors.normal);
  root.style.setProperty('--header-menu-hover', colors.hover);
};
```

Then use in CSS:
```css
.header-menu a,
.nav-link {
  color: var(--header-menu-color, #333333);
  transition: color 0.3s ease;
}

.header-menu a:hover,
.nav-link:hover {
  color: var(--header-menu-hover, #007bff);
}
```

## React Component Example

```jsx
const HeaderMenu = () => {
  const [colors, setColors] = useState({ normal: '#333333', hover: '#007bff' });
  
  useEffect(() => {
    getHeaderMenuColors().then(setColors);
  }, []);
  
  return (
    <nav className="header-menu">
      <a 
        href="/home"
        style={{ 
          color: colors.normal,
          transition: 'color 0.3s'
        }}
        onMouseEnter={(e) => e.target.style.color = colors.hover}
        onMouseLeave={(e) => e.target.style.color = colors.normal}
      >
        الرئيسية
      </a>
      {/* Add more menu items as needed */}
    </nav>
  );
};
```

## Admin Configuration

Admins can configure header menu colors through:
- **Settings Page** → **Header Menu Colors** section
- Normal color picker with hex input
- Hover color picker with hex input  
- Simple preview showing color changes
- One-click update for both colors

## Default Values

- **Normal Color**: #333333 (dark gray)
- **Hover Color**: #007bff (blue)

## Future-Proof Design

- No hardcoded menu names in the code
- Works with any menu structure
- Easy to change menu items without code updates
- Generic color application to any header links
