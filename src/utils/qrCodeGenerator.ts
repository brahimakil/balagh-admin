import QRCode from 'qrcode';

// ✅ Helper function to create SEO-friendly slug
const createMartyrSlug = (martyr: { id?: string; nameEn: string; nameAr: string }): string => {
  const name = (martyr.nameEn || '').toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')         // Replace spaces with hyphens
    .replace(/-+/g, '-')          // Replace multiple hyphens with single
    .trim();
  
  return `${name}-${martyr.id}`;
};

// ✅ ONE UNIFIED FUNCTION
export const generateMartyrQRCode = async (
  martyr: {
    id?: string;
    nameEn: string;
    nameAr: string;
  },
  logoPath: string,
  quality: 'standard' | 'print' = 'standard'
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const slug = createMartyrSlug(martyr);
    const qrData = `https://balaghlb.com/martyrs/${slug}?t=${timestamp}`;

    // Quality settings
    const settings = quality === 'print' 
      ? { width: 600, margin: 4, logoSize: 0.16, padding: 30 }
      : { width: 400, margin: 3, logoSize: 0.18, padding: 20 };

    console.log(`🔗 Generating ${quality.toUpperCase()} QR Code for URL:`, qrData);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not create canvas context'));
      return;
    }

    QRCode.toCanvas(canvas, qrData, {
      errorCorrectionLevel: 'H',
      width: settings.width,
      margin: settings.margin,
      color: { dark: '#000000', light: '#FFFFFF' },
      rendererOpts: { quality: 1.0 }
    }, (err: any) => {
      if (err) {
        console.error('❌ QR Code generation failed:', err);
        reject(err);
        return;
      }

      if (!logoPath) {
        resolve(canvas.toDataURL('image/png', 1.0));
        return;
      }

      const logoImg = new Image();
      logoImg.crossOrigin = 'Anonymous';
      
      logoImg.onload = () => {
        try {
          const qrSize = canvas.width;
          const logoSize = qrSize * settings.logoSize;
          const whiteSpaceSize = logoSize + settings.padding;
          const logoX = (qrSize - logoSize) / 2;
          const logoY = (qrSize - logoSize) / 2;
          const whiteSpaceX = (qrSize - whiteSpaceSize) / 2;
          const whiteSpaceY = (qrSize - whiteSpaceSize) / 2;

          // White background
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(whiteSpaceX, whiteSpaceY, whiteSpaceSize, whiteSpaceSize);

          // Border
          ctx.strokeStyle = quality === 'print' ? '#CCCCCC' : '#E0E0E0';
          ctx.lineWidth = quality === 'print' ? 2 : 1;
          ctx.strokeRect(whiteSpaceX, whiteSpaceY, whiteSpaceSize, whiteSpaceSize);

          // Logo
          if (quality === 'print') {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
          }
          ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);

          console.log(`✅ ${quality.toUpperCase()} QR Code with logo generated`);
          resolve(canvas.toDataURL('image/png', 1.0));
        } catch (logoError) {
          console.error('❌ Error drawing logo:', logoError);
          resolve(canvas.toDataURL('image/png', 1.0));
        }
      };

      logoImg.onerror = () => {
        console.warn('❌ Failed to load logo, generating without logo');
        resolve(canvas.toDataURL('image/png', 1.0));
      };

      logoImg.src = logoPath;
    });
  });
};

// ✅ KEEP LEGACY FUNCTION FOR BACKWARDS COMPATIBILITY
export const generatePrintQualityQRCode = async (
  martyr: { id?: string; nameEn: string; nameAr: string; },
  logoPath: string
): Promise<string> => {
  return generateMartyrQRCode(martyr, logoPath, 'print');
}; 