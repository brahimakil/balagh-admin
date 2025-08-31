# News Ticker Configuration

## Database Fields

The news ticker settings are stored in the `websiteSettings` collection under these keys:

```javascript
{
  // ... other website settings
  newsTickerColor: "#ff0000",      // Background color (hex)
  newsTickerTextColor: "#ffffff",  // Text color (hex)
  newsTickerFontSize: 16,          // Font size in pixels
  newsTickerHeight: 40             // Height in pixels
}
```

## Key Details

- **Collection**: `websiteSettings`
- **Document ID**: `main` 
- **Fields**:
  - `newsTickerColor`: Background color (hex format, default: #ff0000)
  - `newsTickerTextColor`: Text color (hex format, default: #ffffff)
  - `newsTickerFontSize`: Font size in pixels (number, default: 16)
  - `newsTickerHeight`: Height in pixels (number, default: 40)

## Usage in Frontend

To use the news ticker settings in your user dashboard:

```javascript
// Get all news ticker settings
const getNewsTickerSettings = async () => {
  try {
    const doc = await getDoc(doc(db, 'websiteSettings', 'main'));
    if (doc.exists()) {
      const data = doc.data();
      return {
        backgroundColor: data.newsTickerColor || '#ff0000',
        textColor: data.newsTickerTextColor || '#ffffff',
        fontSize: data.newsTickerFontSize || 16,
        height: data.newsTickerHeight || 40
      };
    }
  } catch (error) {
    console.error('Error fetching news ticker settings:', error);
  }
  // Fallback settings
  return {
    backgroundColor: '#ff0000',
    textColor: '#ffffff',
    fontSize: 16,
    height: 40
  };
};

// Apply to news ticker element
const applyNewsTickerSettings = async () => {
  const settings = await getNewsTickerSettings();
  const newsTickerElement = document.querySelector('.news-ticker');
  
  if (newsTickerElement) {
    newsTickerElement.style.backgroundColor = settings.backgroundColor;
    newsTickerElement.style.color = settings.textColor;
    newsTickerElement.style.fontSize = `${settings.fontSize}px`;
    newsTickerElement.style.height = `${settings.height}px`;
    newsTickerElement.style.lineHeight = `${settings.height}px`; // Center text vertically
  }
};

// CSS-in-JS approach
const NewsTickerComponent = () => {
  const [tickerSettings, setTickerSettings] = useState(null);
  
  useEffect(() => {
    getNewsTickerSettings().then(setTickerSettings);
  }, []);
  
  if (!tickerSettings) return null;
  
  return (
    <div 
      className="news-ticker"
      style={{
        backgroundColor: tickerSettings.backgroundColor,
        color: tickerSettings.textColor,
        fontSize: `${tickerSettings.fontSize}px`,
        height: `${tickerSettings.height}px`,
        lineHeight: `${tickerSettings.height}px`,
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        whiteSpace: 'nowrap'
      }}
    >
      {/* Your news ticker content */}
    </div>
  );
};
```

## CSS Variables Approach

For easier theming, you can set CSS variables:

```javascript
// Set CSS custom properties from database values
const applyNewsTickerCSSVars = async () => {
  const settings = await getNewsTickerSettings();
  const root = document.documentElement;
  
  root.style.setProperty('--news-ticker-bg', settings.backgroundColor);
  root.style.setProperty('--news-ticker-text', settings.textColor);
  root.style.setProperty('--news-ticker-size', `${settings.fontSize}px`);
  root.style.setProperty('--news-ticker-height', `${settings.height}px`);
};
```

Then use in CSS:
```css
.news-ticker {
  background-color: var(--news-ticker-bg, #ff0000);
  color: var(--news-ticker-text, #ffffff);
  font-size: var(--news-ticker-size, 16px);
  height: var(--news-ticker-height, 40px);
  line-height: var(--news-ticker-height, 40px);
}
```

## Admin Configuration

Admins can configure all news ticker settings through:
- **Settings Page** → **News Ticker Settings** section
- Background color picker with hex input
- Text color picker with hex input  
- Font size slider/input (10-32px range)
- Height slider/input (20-100px range)
- Real-time preview showing actual appearance
- All changes saved together with one click

## Default Values

- **Background Color**: #ff0000 (red)
- **Text Color**: #ffffff (white)
- **Font Size**: 16px
- **Height**: 40px

## Validation

- Colors: Standard hex format validation
- Font Size: 10-32 pixel range
- Height: 20-100 pixel range
- All fields have fallback defaults if invalid

## Implementation Notes

- All settings are stored as separate fields for granular control
- Public read access allows frontend to fetch all settings
- Changes trigger admin notifications for tracking
- Real-time preview in admin panel shows exact appearance
- Responsive design considerations should account for different screen sizes
