import QRCode from 'qrcode';

// ✅ Updated Helper function to create slug with double dashes between names
const createMartyrSlug = (martyr: { 
  nameEn: string; 
  nameAr: string; 
  jihadistNameEn?: string; 
  jihadistNameAr?: string; 
}): string => {
  const mainName = (martyr.nameEn || '').toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

  const jihadistName = (martyr.jihadistNameEn || '').toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

  return jihadistName ? `${mainName}--${jihadistName}` : mainName;
};

// ✅ Updated function with more professional logo
export const generateMartyrQRCode = async (
  martyr: {
    nameEn: string;
    nameAr: string;
    jihadistNameEn?: string;
    jihadistNameAr?: string;
  },
  logoPath: string,
  quality: 'standard' | 'print' = 'standard'
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const slug = createMartyrSlug(martyr);
    const qrData = `https://balaghlb.com/martyrs/${slug}`;

    const settings = quality === 'print' 
      ? { width: 600, margin: 4, logoSize: 0.28, padding: 30 } // ⬅️ increased from 0.22 to 0.28
      : { width: 400, margin: 3, logoSize: 0.30, padding: 20 }; // ⬅️ increased from 0.24 to 0.30

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
      
          // Make white background box match logo size (no extra padding)
          const whiteBoxSize = logoSize * 0.88; // ⬅️ changed from 1.2 to 1.0 (same as logo)
          const whiteBoxX = (qrSize - whiteBoxSize) / 2;
          const whiteBoxY = (qrSize - whiteBoxSize) / 2;
      
          const logoX = (qrSize - logoSize) / 2;
          const logoY = (qrSize - logoSize) / 2;
      
          // White background with rounded corners
          const borderRadius = whiteBoxSize * 0.2;
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.moveTo(whiteBoxX + borderRadius, whiteBoxY);
          ctx.lineTo(whiteBoxX + whiteBoxSize - borderRadius, whiteBoxY);
          ctx.quadraticCurveTo(whiteBoxX + whiteBoxSize, whiteBoxY, whiteBoxX + whiteBoxSize, whiteBoxY + borderRadius);
          ctx.lineTo(whiteBoxX + whiteBoxSize, whiteBoxY + whiteBoxSize - borderRadius);
          ctx.quadraticCurveTo(whiteBoxX + whiteBoxSize, whiteBoxY + whiteBoxSize, whiteBoxX + whiteBoxSize - borderRadius, whiteBoxY + whiteBoxSize);
          ctx.lineTo(whiteBoxX + borderRadius, whiteBoxY + whiteBoxSize);
          ctx.quadraticCurveTo(whiteBoxX, whiteBoxY + whiteBoxSize, whiteBoxX, whiteBoxY + whiteBoxSize - borderRadius);
          ctx.lineTo(whiteBoxX, whiteBoxY + borderRadius);
          ctx.quadraticCurveTo(whiteBoxX, whiteBoxY, whiteBoxX + borderRadius, whiteBoxY);
          ctx.closePath();
          ctx.fill();
      
          // Border around box
          ctx.strokeStyle = quality === 'print' ? '#CCCCCC' : '#E0E0E0';
          ctx.lineWidth = quality === 'print' ? 2 : 1;
          ctx.stroke();
      
          // Logo inside, transparent
          ctx.save();
          ctx.globalAlpha = 0.88; // ⬅️ a bit transparent
          ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
          ctx.restore();
      
          console.log(`✅ ${quality.toUpperCase()} QR Code with improved logo generated`);
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

// ✅ Legacy for backwards compatibility
export const generatePrintQualityQRCode = async (
  martyr: { id?: string; nameEn: string; nameAr: string; },
  logoPath: string
): Promise<string> => {
  return generateMartyrQRCode(martyr, logoPath, 'print');
};
