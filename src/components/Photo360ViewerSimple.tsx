import React, { useState, useRef } from 'react';

interface Photo360ViewerSimpleProps {
  imageUrl: string;
  width?: number;
  height?: number;
}

const Photo360ViewerSimple: React.FC<Photo360ViewerSimpleProps> = ({ 
  imageUrl, 
  width = 200, 
  height = 150 
}) => {
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastMouseX, setLastMouseX] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isLoaded || error) return;
    setIsMouseDown(true);
    setLastMouseX(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown || !isLoaded || error) return;

    const deltaX = e.clientX - lastMouseX;
    setRotation(prev => prev + deltaX * 0.5);
    setLastMouseX(e.clientX);
  };

  const handleMouseUp = () => {
    setIsMouseDown(false);
  };

  const handleMouseLeave = () => {
    setIsMouseDown(false);
  };

  const handleImageLoad = () => {
    setIsLoaded(true);
    setError(false);
  };

  const handleImageError = () => {
    setError(true);
    setIsLoaded(false);
  };

  return (
    <div className="photo-360-viewer-simple">
      <div
        ref={containerRef}
        className="photo-360-container"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          border: error ? '2px solid #ff4444' : '2px solid #9C27B0',
          borderRadius: '8px',
          overflow: 'hidden',
          position: 'relative',
          cursor: (!isLoaded || error) ? 'default' : (isMouseDown ? 'grabbing' : 'grab'),
          backgroundColor: '#f0f0f0'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {error ? (
          <div className="error-placeholder" style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ff4444',
            fontSize: '12px'
          }}>
            <div>360° Photo</div>
            <div>(Error loading)</div>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt="360 Photo"
            style={{
              width: `${width * 3}px`, // Make image 3x wider for 360 effect
              height: `${height}px`,
              objectFit: 'cover',
              transform: `translateX(${-rotation % (width * 2)}px)`,
              transition: isMouseDown ? 'none' : 'transform 0.1s ease',
              position: 'absolute',
              left: 0,
              top: 0
            }}
            onLoad={handleImageLoad}
            onError={handleImageError}
            draggable={false}
          />
        )}
      </div>
      <div className="photo-360-label">
        <span>
          {error ? '❌ 360° Photo (Error)' : '🔄 360° Photo - Drag to explore'}
        </span>
      </div>
    </div>
  );
};

export default Photo360ViewerSimple; 