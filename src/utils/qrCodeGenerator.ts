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
    const qrData = `https://www.balaghlb.com/martyrs/${martyr.id}?t=${timestamp}`;

    console.log('🔗 Generating QR Code for URL:', qrData);
    console.log('🖼️ Logo path received:', logoPath);

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
    }, (err: any) => {
      if (err) {
        console.error('❌ QR Code generation failed:', err);
        reject(err);
        return;
      }

      console.log('✅ Base QR Code generated');

      // If no logo path provided, return QR without logo
      if (!logoPath) {
        console.log('⚠️ No logo path provided, returning QR without logo');
        resolve(canvas.toDataURL('image/png', 1.0));
        return;
      }

      console.log('🔄 Adding logo to QR code...');

      // Load and draw logo
      const logoImg = new Image();
      logoImg.crossOrigin = 'Anonymous';
      
      logoImg.onload = () => {
        try {
          console.log('✅ Logo loaded successfully, drawing on QR code...');
          
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

          console.log('✅ QR Code with logo generated successfully');
          
          // Convert to data URL with high quality
          const qrCodeWithLogo = canvas.toDataURL('image/png', 1.0);
          resolve(qrCodeWithLogo);
        } catch (logoError) {
          console.error('❌ Error drawing logo on QR code:', logoError);
          console.log('⚠️ Falling back to QR code without logo');
          resolve(canvas.toDataURL('image/png', 1.0));
        }
      };

      logoImg.onerror = (error) => {
        console.warn('❌ Failed to load logo:', error);
        console.warn('🔍 Logo path attempted:', logoPath);
        console.log('⚠️ Generating QR code without logo');
        resolve(canvas.toDataURL('image/png', 1.0));
      };

      // Use the logo path directly from the import
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
    const qrData = `https://www.balaghlb.com/martyrs/${martyr.id}?t=${timestamp}`;

    console.log('🔗 Generating HIGH-QUALITY QR Code for URL:', qrData);
    console.log('🖼️ Logo path received:', logoPath);

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
        console.error('❌ High-quality QR Code generation failed:', err);
        reject(err);
        return;
      }

      console.log('✅ High-quality base QR Code generated');

      // If no logo path provided, return QR without logo
      if (!logoPath) {
        console.log('⚠️ No logo path provided, returning high-quality QR without logo');
        resolve(canvas.toDataURL('image/png', 1.0));
        return;
      }

      console.log('🔄 Adding logo to high-quality QR code...');

      const logoImg = new Image();
      logoImg.crossOrigin = 'Anonymous';
      
      logoImg.onload = () => {
        try {
          console.log('✅ Logo loaded for high-quality QR, drawing...');
          
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

          console.log('✅ High-quality QR Code with logo generated successfully');

          const qrCodeWithLogo = canvas.toDataURL('image/png', 1.0);
          resolve(qrCodeWithLogo);
        } catch (logoError) {
          console.error('❌ Error drawing logo on high-quality QR code:', logoError);
          console.log('⚠️ Falling back to high-quality QR code without logo');
          resolve(canvas.toDataURL('image/png', 1.0));
        }
      };

      logoImg.onerror = (error) => {
        console.warn('❌ Failed to load logo for high-quality QR:', error);
        console.warn('🔍 Logo path attempted:', logoPath);
        console.log('⚠️ Generating high-quality QR code without logo');
        resolve(canvas.toDataURL('image/png', 1.0));
      };

      // Use the logo path directly from the import
      logoImg.src = logoPath;
    });
  });
}; 