import QRCode from 'qrcode';

export const generateMartyrQRCode = async (
  martyr: {
    id?: string;
    nameEn: string;
    nameAr: string;
  },
  logoPath: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Generate QR code data with timestamp to make each one unique
    const timestamp = Date.now();
    const qrData = `https://balagh.org/martyr/${martyr.id}?t=${timestamp}`;

    // Create canvas for QR code
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not create canvas context'));
      return;
    }

    // Generate QR code with optimal settings for printing
    QRCode.toCanvas(canvas, qrData, {
      errorCorrectionLevel: 'H', // High error correction
      width: 400, // Larger size for better quality
      margin: 3,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      // Use squares instead of dots for better printing
      rendererOpts: {
        quality: 1.0
      }
    }, (err) => {
      if (err) {
        reject(err);
        return;
      }

      // Load and draw logo
      const logoImg = new Image();
      logoImg.crossOrigin = 'Anonymous';
      
      logoImg.onload = () => {
        // Calculate dimensions
        const qrSize = canvas.width;
        const logoSize = qrSize * 0.18; // 18% of QR code size
        const whiteSpaceSize = logoSize + 20; // Logo + white space padding
        const logoX = (qrSize - logoSize) / 2;
        const logoY = (qrSize - logoSize) / 2;
        const whiteSpaceX = (qrSize - whiteSpaceSize) / 2;
        const whiteSpaceY = (qrSize - whiteSpaceSize) / 2;

        // Create white background area for logo (larger than logo itself)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(whiteSpaceX, whiteSpaceY, whiteSpaceSize, whiteSpaceSize);

        // Add a subtle border around the white space
        ctx.strokeStyle = '#E0E0E0';
        ctx.lineWidth = 1;
        ctx.strokeRect(whiteSpaceX, whiteSpaceY, whiteSpaceSize, whiteSpaceSize);

        // Add shadow effect for better visibility
        ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        // Draw logo centered in the white space
        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Convert to data URL with high quality
        const qrCodeWithLogo = canvas.toDataURL('image/png', 1.0);
        resolve(qrCodeWithLogo);
      };

      logoImg.onerror = () => {
        console.warn('Failed to load logo, generating QR code without logo');
        resolve(canvas.toDataURL('image/png', 1.0));
      };

      logoImg.src = logoPath;
    });
  });
};

// Alternative function for high-quality printing QR codes
export const generatePrintQualityQRCode = async (
  martyr: {
    id?: string;
    nameEn: string;
    nameAr: string;
  },
  logoPath: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const qrData = `https://balagh.org/martyr/${martyr.id}?t=${timestamp}`;

    // Create high-resolution canvas for printing
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not create canvas context'));
      return;
    }

    // Generate high-resolution QR code
    QRCode.toCanvas(canvas, qrData, {
      errorCorrectionLevel: 'H',
      width: 600, // Higher resolution for printing
      margin: 4,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    }, (err: any) => {
      if (err) {
        console.error('QR Code generation error:', err);
        reject(err);
        return;
      }

      const logoImg = new Image();
      logoImg.crossOrigin = 'Anonymous';
      
      logoImg.onload = () => {
        const qrSize = canvas.width;
        const logoSize = qrSize * 0.16; // Slightly smaller for print quality
        const whiteSpaceSize = logoSize + 30; // More padding for print
        const logoX = (qrSize - logoSize) / 2;
        const logoY = (qrSize - logoSize) / 2;
        const whiteSpaceX = (qrSize - whiteSpaceSize) / 2;
        const whiteSpaceY = (qrSize - whiteSpaceSize) / 2;

        // Create crisp white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(whiteSpaceX, whiteSpaceY, whiteSpaceSize, whiteSpaceSize);

        // Add a clean border
        ctx.strokeStyle = '#CCCCCC';
        ctx.lineWidth = 2;
        ctx.strokeRect(whiteSpaceX, whiteSpaceY, whiteSpaceSize, whiteSpaceSize);

        // Draw logo with anti-aliasing for better quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);

        const qrCodeWithLogo = canvas.toDataURL('image/png', 1.0);
        resolve(qrCodeWithLogo);
      };

      logoImg.onerror = () => {
        resolve(canvas.toDataURL('image/png', 1.0));
      };

      logoImg.src = logoPath;
    });
  });
}; 