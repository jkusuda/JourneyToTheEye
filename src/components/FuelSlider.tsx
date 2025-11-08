import { useState, useRef, useEffect } from 'react';
import './fuelSlider.css';

interface FuelSliderProps {
  min?: number;
  max?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
}

export function FuelSlider({ 
  min = 0, 
  max = 30, 
  defaultValue = 15,
  onChange,
}: FuelSliderProps) {
  const [value, setValue] = useState(defaultValue);
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  const updateValue = (clientY: number) => {
    if (!sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height));
    const newValue = Math.round(min + percentage * (max - min));
    
    setValue(newValue);
    onChange?.(newValue);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    updateValue(e.clientY);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => updateValue(e.clientY);
    const handleMouseUp = () => setIsDragging(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const percentage = ((value - min) / (max - min)) * 100;
  const fuelColor = percentage > 60 ? '#4ade80' : percentage > 30 ? '#fbbf24' : '#ef4444';

  return (
    <div className="fuel-slider-wrapper">
      <div className="rocket-container">
        <div className="rocket-nose" />
        
        <div className="rocket-body">
          <div ref={sliderRef} className="fuel-tank-glass" onMouseDown={handleMouseDown}>
            <div className="fuel-liquid" style={{ height: `${percentage}%`, background: fuelColor }}>
              <div className="fuel-shine" />
            </div>
          </div>
          
          <div className="fuel-thumb" style={{ bottom: `calc(${percentage}% - 6px)` }} onMouseDown={handleMouseDown}>
            <div className="thumb-line" />
            <div className="thumb-line" />
            <div className="thumb-line" />
          </div>
        </div>
        
        <div className="rocket-engine" />
        
        <div className="fuel-display">
          <div className="fuel-value">{value}</div>
          <div className="fuel-label">parsecs</div>
        </div>
      </div>
    </div>
  );
}