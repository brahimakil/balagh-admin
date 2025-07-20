import React, { useRef, useEffect, useState } from 'react';

interface Photo360ViewerProps {
  imageUrl: string;
  width?: number;
  height?: number;
}

const Photo360Viewer: React.FC<Photo360ViewerProps> = ({ 
  imageUrl, 
  width = 200, 
  height = 150 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [error, setError] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create image element
    const img = new Image();
    imgRef.current = img;
    
    // Set crossOrigin BEFORE setting src
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      setIsLoaded(true);
      setError(false);
      drawImage(ctx, img, canvas.width, canvas.height);
    };

    img.onerror = (err) => {
      console.error('Failed to load 360 image:', err);
      setError(true);
      setIsLoaded(false);
      // Draw error placeholder
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ff4444';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('360° Photo', canvas.width / 2, canvas.height / 2 - 10);
      ctx.fillText('(Error loading)', canvas.width / 2, canvas.height / 2 + 10);
    };

    // Add a small delay to ensure crossOrigin is set
    setTimeout(() => {
      img.src = imageUrl;
    }, 10);

    return () => {
      if (imgRef.current) {
        imgRef.current.onload = null;
        imgRef.current.onerror = null;
      }
    };
  }, [imageUrl]);

  const drawImage = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, canvasWidth: number, canvasHeight: number) => {
    if (!img.complete || img.naturalWidth === 0) {
      return;
    }

    try {
      // Clear canvas
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      
      // Simple 360 effect - show a portion of the image based on rotation
      const normalizedRotation = ((rotation.y % 360) + 360) % 360;
      const sourceX = (normalizedRotation / 360) * img.width;
      const viewWidth = img.width / 3; // Show 1/3 of the image width
      
      // Calculate source parameters
      let firstSourceX = sourceX;
      let firstSourceWidth = Math.min(viewWidth, img.width - sourceX);
      
      // Draw the main portion
      ctx.drawImage(
        img,
        firstSourceX, 0, firstSourceWidth, img.height,
        0, 0, (firstSourceWidth / viewWidth) * canvasWidth, canvasHeight
      );
      
      // If we need to wrap around to the beginning of the image
      if (firstSourceWidth < viewWidth) {
        const remainingWidth = viewWidth - firstSourceWidth;
        const targetX = (firstSourceWidth / viewWidth) * canvasWidth;
        
        ctx.drawImage(
          img,
          0, 0, remainingWidth, img.height,
          targetX, 0, canvasWidth - targetX, canvasHeight
        );
      }
    } catch (err) {
      console.error('Error drawing 360 image:', err);
      // Draw error state
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.fillStyle = '#ff4444';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Draw Error', canvasWidth / 2, canvasHeight / 2);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isLoaded || error) return;
    setIsMouseDown(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown || !isLoaded || error) return;

    const deltaX = e.clientX - lastMousePos.x;

    setRotation(prev => ({
      x: prev.x, // Keep x rotation as is for now
      y: prev.y + deltaX * 0.5
    }));

    setLastMousePos({ x: e.clientX, y: e.clientY });

    // Redraw with current image
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (canvas && img && img.complete) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawImage(ctx, img, canvas.width, canvas.height);
      }
    }
  };

  const handleMouseUp = () => {
    setIsMouseDown(false);
  };

  const handleMouseLeave = () => {
    setIsMouseDown(false);
  };

  return (
    <div className="photo-360-viewer">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ 
          cursor: (!isLoaded || error) ? 'default' : (isMouseDown ? 'grabbing' : 'grab'),
          border: error ? '2px solid #ff4444' : '2px solid #9C27B0',
          borderRadius: '8px',
          display: 'block',
          width: `${width}px`,
          height: `${height}px`,
          opacity: error ? 0.7 : 1
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
      <div className="photo-360-label">
        <span>
          {error ? '❌ 360° Photo (Error)' : '🔄 360° Photo - Drag to explore'}
        </span>
      </div>
    </div>
  );
};

export default Photo360Viewer; 