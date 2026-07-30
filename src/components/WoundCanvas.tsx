import React, { useRef, useState, useEffect, useCallback } from 'react';
import { RotateCcw, Trash2, Circle, Edit3, Dog, Cat } from 'lucide-react';

interface WoundCanvasProps {
  species?: string;
  initialDataUrl?: string;
  onChange?: (dataUrl: string) => void;
  readOnly?: boolean;
  className?: string;
}

interface Shape {
  type: 'freehand' | 'circle';
  color: string;
  lineWidth: number;
  points?: { x: number; y: number }[];
  center?: { x: number; y: number };
  radius?: number;
}

export const WoundCanvas: React.FC<WoundCanvasProps> = ({
  species = '',
  initialDataUrl = '',
  onChange,
  readOnly = false,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Determine default pet type
  const isDog = (species || '').toLowerCase().includes('dog') || 
                (species || '').includes('หมา') || 
                (species || '').includes('สุนัข');
  
  const [petType, setPetType] = useState<'dog' | 'cat'>(isDog ? 'dog' : 'cat');
  const [tool, setTool] = useState<'circle' | 'pen'>('circle');
  const [color, setColor] = useState<string>('#ef4444'); // Red default for wounds
  const [lineWidth, setLineWidth] = useState<number>(4);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentShape, setCurrentShape] = useState<Shape | null>(null);

  // Custom Background Images from Settings
  const [customDogImg, setCustomDogImg] = useState<HTMLImageElement | null>(null);
  const [customCatImg, setCustomCatImg] = useState<HTMLImageElement | null>(null);

  // Load custom diagram images from local/settings
  useEffect(() => {
    const loadSettings = () => {
      try {
        const saved = localStorage.getItem('anatomy_diagram_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.defaultColor) setColor(parsed.defaultColor);
          if (parsed.dogImage) {
            const img = new Image();
            img.src = parsed.dogImage;
            img.onload = () => setCustomDogImg(img);
          } else {
            setCustomDogImg(null);
          }

          if (parsed.catImage) {
            const img = new Image();
            img.src = parsed.catImage;
            img.onload = () => setCustomCatImg(img);
          } else {
            setCustomCatImg(null);
          }
        }
      } catch (err) {
        console.warn('Could not load custom diagram images:', err);
      }
    };
    loadSettings();
  }, []);

  // Sync species prop change
  useEffect(() => {
    const isDogCheck = (species || '').toLowerCase().includes('dog') || 
                       (species || '').includes('หมา') || 
                       (species || '').includes('สุนัข');
    setPetType(isDogCheck ? 'dog' : 'cat');
  }, [species]);

  // Load initial image if provided
  useEffect(() => {
    if (initialDataUrl && shapes.length === 0) {
      // If initial image exists, it's already composite
    }
  }, [initialDataUrl]);

  // Draw background image (SVG of dog/cat outline)
  const drawBackground = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, type: 'dog' | 'cat') => {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Draw Labels L and R
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('L', 40, height / 2);
    ctx.fillText('R', width - 40, height / 2);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const cx = width / 2;
    const cy = height / 2;

    if (type === 'dog') {
      // --- DOG OUTLINE (Matching Image 2) ---
      ctx.beginPath();
      
      // Head dome
      ctx.arc(cx, cy - 85, 24, Math.PI * 0.85, Math.PI * 0.15, false);

      // Left Floppy Ear
      ctx.bezierCurveTo(cx - 30, cy - 105, cx - 55, cy - 80, cx - 42, cy - 50);
      ctx.bezierCurveTo(cx - 35, cy - 35, cx - 25, cy - 50, cx - 22, cy - 65);

      // Neck left to Front Left Leg
      ctx.bezierCurveTo(cx - 24, cy - 45, cx - 45, cy - 55, cx - 60, cy - 20);
      ctx.bezierCurveTo(cx - 70, cy + 15, cx - 45, cy + 20, cx - 30, cy - 10);

      // Left Torso to Hind Left Leg
      ctx.bezierCurveTo(cx - 32, cy + 20, cx - 45, cy + 45, cx - 52, cy + 80);
      ctx.bezierCurveTo(cx - 58, cy + 110, cx - 35, cy + 115, cx - 20, cy + 85);

      // Tail
      ctx.bezierCurveTo(cx - 15, cy + 95, cx - 5, cy + 130, cx, cy + 135);
      ctx.bezierCurveTo(cx + 5, cy + 130, cx + 15, cy + 95, cx + 20, cy + 85);

      // Hind Right Leg
      ctx.bezierCurveTo(cx + 35, cy + 115, cx + 58, cy + 110, cx + 52, cy + 80);
      ctx.bezierCurveTo(cx + 45, cy + 45, cx + 32, cy + 20, cx + 30, cy - 10);

      // Front Right Leg
      ctx.bezierCurveTo(cx + 45, cy + 20, cx + 70, cy + 15, cx + 60, cy - 20);
      ctx.bezierCurveTo(cx + 45, cy - 55, cx + 24, cy - 45, cx + 22, cy - 65);

      // Right Floppy Ear
      ctx.bezierCurveTo(cx + 25, cy - 50, cx + 35, cy - 35, cx + 42, cy - 50);
      ctx.bezierCurveTo(cx + 55, cy - 80, cx + 30, cy - 105, cx + 22, cy - 88);

      ctx.stroke();

    } else {
      // --- CAT OUTLINE (Matching Image 3) ---
      ctx.beginPath();

      // Head dome
      ctx.arc(cx, cy - 80, 22, Math.PI * 0.75, Math.PI * 0.25, false);

      // Left Pointed Ear
      ctx.lineTo(cx - 36, cy - 118);
      ctx.lineTo(cx - 16, cy - 98);

      // Right Pointed Ear
      ctx.lineTo(cx + 16, cy - 98);
      ctx.lineTo(cx + 36, cy - 118);
      ctx.lineTo(cx + 22, cy - 80);

      // Neck left to Front Left Leg (Cat paws extended up/out)
      ctx.bezierCurveTo(cx - 24, cy - 55, cx - 52, cy - 70, cx - 62, cy - 35);
      ctx.bezierCurveTo(cx - 68, cy - 5, cx - 48, cy, cx - 28, cy - 25);

      // Left Torso to Hind Left Leg
      ctx.bezierCurveTo(cx - 30, cy + 15, cx - 45, cy + 40, cx - 50, cy + 75);
      ctx.bezierCurveTo(cx - 55, cy + 105, cx - 35, cy + 110, cx - 18, cy + 80);

      // Curved Cat Tail
      ctx.bezierCurveTo(cx - 10, cy + 90, cx - 8, cy + 125, cx + 8, cy + 138);
      ctx.bezierCurveTo(cx + 16, cy + 132, cx + 6, cy + 105, cx + 18, cy + 80);

      // Hind Right Leg
      ctx.bezierCurveTo(cx + 35, cy + 110, cx + 55, cy + 105, cx + 50, cy + 75);
      ctx.bezierCurveTo(cx + 45, cy + 40, cx + 30, cy + 15, cx + 28, cy - 25);

      // Front Right Leg
      ctx.bezierCurveTo(cx + 48, cy, cx + 68, cy - 5, cx + 62, cy - 35);
      ctx.bezierCurveTo(cx + 52, cy - 70, cx + 24, cy - 55, cx + 22, cy - 80);

      ctx.stroke();
    }
  }, []);

  // Render everything on canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Draw background outline or custom uploaded image
    const customImg = petType === 'dog' ? customDogImg : customCatImg;
    if (customImg) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(customImg, 0, 0, width, height);
    } else {
      drawBackground(ctx, width, height, petType);
    }

    // Render all saved shapes
    const allShapes = currentShape ? [...shapes, currentShape] : shapes;

    allShapes.forEach(shape => {
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.color;
      ctx.lineWidth = shape.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (shape.type === 'circle' && shape.center && shape.radius !== undefined) {
        ctx.beginPath();
        ctx.arc(shape.center.x, shape.center.y, shape.radius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Add semi-transparent fill for circle wound area
        ctx.save();
        ctx.fillStyle = shape.color;
        ctx.globalAlpha = 0.2;
        ctx.fill();
        ctx.restore();

      } else if (shape.type === 'freehand' && shape.points && shape.points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        for (let i = 1; i < shape.points.length; i++) {
          ctx.lineTo(shape.points[i].x, shape.points[i].y);
        }
        ctx.stroke();
      }
    });

  }, [drawBackground, petType, shapes, currentShape, customDogImg, customCatImg]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Export data URL when shapes or petType changes
  useEffect(() => {
    if (!onChangeRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    onChangeRef.current(dataUrl);
  }, [shapes, petType]);

  // Mouse / Touch Event Handlers
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly) return;
    e.preventDefault();
    const coords = getCoordinates(e);
    setIsDrawing(true);

    if (tool === 'circle') {
      setCurrentShape({
        type: 'circle',
        color,
        lineWidth,
        center: coords,
        radius: 0
      });
    } else {
      setCurrentShape({
        type: 'freehand',
        color,
        lineWidth,
        points: [coords]
      });
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !currentShape || readOnly) return;
    e.preventDefault();
    const coords = getCoordinates(e);

    if (currentShape.type === 'circle' && currentShape.center) {
      const dx = coords.x - currentShape.center.x;
      const dy = coords.y - currentShape.center.y;
      const radius = Math.sqrt(dx * dx + dy * dy);
      setCurrentShape({
        ...currentShape,
        radius
      });
    } else if (currentShape.type === 'freehand' && currentShape.points) {
      setCurrentShape({
        ...currentShape,
        points: [...currentShape.points, coords]
      });
    }
  };

  const handleEnd = (e?: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || readOnly) return;
    if (e) e.preventDefault();
    setIsDrawing(false);

    if (currentShape) {
      if (currentShape.type === 'circle' && (currentShape.radius === undefined || currentShape.radius < 5)) {
        // If doctor just tapped once for circle, create a default 15px radius circle
        if (currentShape.center) {
          setShapes(prev => [...prev, { ...currentShape, radius: 15 }]);
        }
      } else {
        setShapes(prev => [...prev, currentShape]);
      }
    }
    setCurrentShape(null);
  };

  const handleUndo = () => {
    setShapes(prev => prev.slice(0, prev.length - 1));
  };

  const handleClear = () => {
    setShapes([]);
  };

  return (
    <div className={`space-y-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs ${className}`}>
      {/* Header Controls */}
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          {/* Species Selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setPetType('dog')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                petType === 'dog' 
                  ? 'bg-white text-indigo-600 shadow-xs font-black' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Dog className="w-3.5 h-3.5" />
              <span>หมา (Dog)</span>
            </button>
            <button
              type="button"
              onClick={() => setPetType('cat')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                petType === 'cat' 
                  ? 'bg-white text-emerald-600 shadow-xs font-black' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Cat className="w-3.5 h-3.5" />
              <span>แมว (Cat)</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleUndo}
              disabled={shapes.length === 0}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg disabled:opacity-30 transition-all"
              title="ย้อนกลับ (Undo)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={shapes.length === 0}
              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg disabled:opacity-30 transition-all"
              title="ล้างทั้งหมด (Clear)"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tool & Color Palette Bar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100 text-xs">
          {/* Tool Switcher */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setTool('circle')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all ${
                tool === 'circle' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              <Circle className="w-3.5 h-3.5" />
              <span>วาดวงกลมแผล</span>
            </button>
            <button
              type="button"
              onClick={() => setTool('pen')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all ${
                tool === 'pen' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>วาดเส้นอิสระ</span>
            </button>
          </div>

          {/* Color Palette */}
          <div className="flex items-center gap-1.5">
            {[
              { hex: '#ef4444', label: 'แดง (แผลสด)' },
              { hex: '#f97316', label: 'ส้ม' },
              { hex: '#3b82f6', label: 'ฟ้า' },
              { hex: '#10b981', label: 'เขียว' }
            ].map(c => (
              <button
                key={c.hex}
                type="button"
                onClick={() => setColor(c.hex)}
                className={`w-5 h-5 rounded-full border-2 transition-transform ${
                  color === c.hex ? 'scale-125 border-slate-800 shadow-sm' : 'border-white'
                }`}
                style={{ backgroundColor: c.hex }}
                title={c.label}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main Drawing Canvas Container */}
      <div className="relative w-full aspect-square max-w-[340px] mx-auto bg-white rounded-2xl border border-slate-200 shadow-inner overflow-hidden touch-none select-none flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={320}
          height={320}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          className={`w-full h-full ${readOnly ? 'cursor-default' : 'cursor-crosshair'}`}
        />
      </div>

      {!readOnly && (
        <p className="text-[10px] text-center font-bold text-slate-400">
          💡 คลิก/ลาก วาดวงกลมตำแหน่งแผลบนตัวสัตว์ ({petType === 'dog' ? 'รูปหมา' : 'รูปแมว'})
        </p>
      )}
    </div>
  );
};
