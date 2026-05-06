import React from 'react';

interface AnatomyMapProps {
  onSelect: (location: string) => void;
  selectedLocations?: string[];
  customSvg?: string;
}

export const AnatomyMap: React.FC<AnatomyMapProps> = ({ onSelect, selectedLocations = [], customSvg }) => {
  const svgRef = React.useRef<HTMLDivElement>(null);

  // Effect to add interactivity and highlighting to custom SVG
  React.useEffect(() => {
    if (svgRef.current) {
      const paths = svgRef.current.querySelectorAll('path, circle, ellipse, rect, polygon');
      paths.forEach((path, index) => {
        const p = path as HTMLElement;
        const partId = p.id || p.getAttribute('name') || `Part ${index + 1}`;
        
        p.style.cursor = 'pointer';
        p.classList.add('transition-all', 'duration-300');
        
        // Highlighting Logic
        const isSelected = selectedLocations.some(loc => loc.toLowerCase() === partId.toLowerCase());
        
        if (isSelected) {
          p.setAttribute('stroke', '#ef4444'); // Red border
          p.setAttribute('stroke-width', '4');
          p.setAttribute('fill', '#facc15');   // Bright yellow fill
          p.setAttribute('fill-opacity', '0.9');
          p.classList.add('scale-[1.02]');
          p.style.zIndex = '50';
        } else {
          p.removeAttribute('stroke');
          p.removeAttribute('stroke-width');
          p.removeAttribute('fill-opacity');
          if (customSvg) {
             // For custom SVGs, we might want to reset the fill if we overrode it
             // However, without knowing the original fill, removing it might be risky
             // But if we only set it when isSelected, we can remove it when not
             p.removeAttribute('fill'); 
          }
          p.classList.remove('scale-[1.02]');
        }

        // Only add listeners once or when customSvg changes
        p.onclick = (e) => {
          e.stopPropagation();
          onSelect(partId);
        };
      });
    }
  }, [customSvg, onSelect, selectedLocations]);

  if (customSvg) {
    return (
      <div 
        ref={svgRef}
        className="w-full h-full flex items-center justify-center anatomy-custom-svg [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:block"
        dangerouslySetInnerHTML={{ __html: customSvg }}
      />
    );
  }

  const getPathStyle = (name: string) => {
    const isSelected = selectedLocations.some(loc => loc.toLowerCase().includes(name.toLowerCase()));
    if (isSelected) {
      return {
        fill: '#facc15',
        stroke: '#ef4444',
        strokeWidth: '4',
        fillOpacity: '0.9'
      };
    }
    return {};
  };

  return (
    <div className="relative w-full h-full p-2 overflow-hidden" ref={svgRef}>
      <svg 
        version="1.1" 
        id="Layer_1" 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 642 524" 
        className="w-full h-full transition-all duration-700 select-none"
      >
        {/* Background Base */}
        <path fill="#FFFFFE" opacity="1.0" stroke="none" d="M643,194 C643,304.6 643,414.8 643,525 C429,525 215,525 1,525 C1,350.3 1,175.6 1,1 C215,1 429,1 643,1 C643,65.1 643,129.3 643,194" />
        
        {/* Main Body Outline (Non-interactive) */}
        <path fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" d="M572.589844,441.196320 C573.097107,440.979095 573.604431,440.761902 574.901672,440.527893 C578.164612,439.227570 581.427612,437.927246 585.353210,436.755768 C585.782227,436.086731 586.211304,435.417725 587.026367,434.267548 C587.420959,433.554413 587.815552,432.841309 588.716125,432.023071 C588.813782,431.352631 588.911438,430.682190 589.140381,429.325073 C589.291687,428.642517 589.442932,427.959961 590.136230,426.766571 C590.260071,411.933472 590.395142,397.100403 590.461731,382.267029 C590.464111,381.738190 589.788452,381.206360 589.448242,379.949127 C589.385254,378.977325 589.322266,378.005493 589.677429,376.355194 C589.054382,371.897461 588.431335,367.439697 587.845215,362.280365 C587.782898,361.582550 587.720581,360.884705 587.903015,359.299805 C587.758606,357.801697 587.614136,356.303619 587.613159,354.274811 C587.567017,353.914551 587.520813,353.554321 587.798828,352.285370 C587.859009,347.725433 588.066895,343.160034 587.897827,338.608612 C587.840149,337.054626 586.835693,335.535797 586.182434,333.282501 C585.094055,331.525360 584.005737,329.768188 583.041565,327.154846" />

        {/* Interactive Areas Grouped by Medical Sections */}
        <g className="cursor-pointer group">
          {/* Head & Brain Area */}
          <path 
            fill="#E9E8E7"
            {...getPathStyle('สมอง')}
            className="hover:fill-rose-300 transition-colors"
            onClick={() => onSelect('สมอง/กะโหลก (Skull/Brain)')}
            d="M205.015213,63.994644 C206.005905,68.799362 207.652908,73.579628 207.833008,78.414536 C208.101151,85.612976 207.333389,92.849998 206.628662,100.461746"
          />
          <path 
            fill="#F5EEE9" 
            {...getPathStyle('ใบหน้า')}
            className="hover:fill-sky-200 transition-colors"
            onClick={() => onSelect('ช่องปาก/ใบหน้า (Face/Mouth)')}
            d="M66.979446,109.094139 C67.506317,105.487549 69.879402,105.693909 72.792053,107.058891 C74.723663,108.463799 76.367012,109.229095 78.469818,110.012436"
          />

          {/* Thorax / Chest Area */}
          <path 
            fill="#C3777A" 
            {...getPathStyle('ทรวงอก')}
            className="hover:fill-rose-400 transition-colors opacity-80"
            onClick={() => onSelect('ทรวงอก/ปอด (Thorax/Lungs)')}
            d="M89.911041,168.929428 C91.619225,167.251999 93.327400,165.574570 95.603600,164.083496 C102.811226,161.987198 109.356834,159.355103 116.121033,157.535675"
          />
          <path 
            fill="#A25F60" 
            {...getPathStyle('หัวใจ')}
            className="hover:fill-red-500 transition-colors"
            onClick={() => onSelect('หัวใจ (Heart)')}
            d="M85.760048,192.819717 C86.553337,189.194443 87.346619,185.569183 88.464539,181.459747 C88.826691,180.307037 88.864212,179.638474 88.901733,178.969910"
          />

          {/* Abdominal Organs */}
          <path 
            fill="#8C4443" 
            {...getPathStyle('ตับ')}
            className="hover:fill-orange-600 transition-colors"
            onClick={() => onSelect('ตับ (Liver)')}
            d="M312.025940,357.001068 C311.826416,357.534515 311.626862,358.067993 310.816162,358.796631 C303.754547,359.279388 301.865845,361.144501 303.009125,366.397034"
          />
          <path 
            fill="#AA5E5F" 
            {...getPathStyle('กระเพาะอาหาร')}
            className="hover:fill-emerald-600 transition-colors opacity-90"
            onClick={() => onSelect('กระเพาะอาหาร (Stomach)')}
            d="M303.071198,366.036377 C301.865845,361.144501 303.754547,359.279388 310.616241,358.999237"
          />
          <path 
            fill="#BE6A6A" 
            {...getPathStyle('ลำไส้')}
            className="hover:fill-rose-700 transition-colors"
            onClick={() => onSelect('ลำไส้ (Intestines)')}
            d="M276.972046,445.330078 C280.824951,445.641632 279.596008,442.080109 281.163239,440.041687"
          />

          {/* Urogenital */}
          <path 
            fill="#BBAEA1" 
            {...getPathStyle('ปัสสาวะ')}
            className="hover:fill-amber-400 transition-colors"
            onClick={() => onSelect('ไต/กระเพาะปัสสาวะ (Urinary System)')}
            d="M156.059113,204.990875 C155.113632,204.463882 153.274918,203.370331"
          />

          {/* Limbs / Spine Accents (Representative) */}
          <path 
            fill="#8C7353" 
            {...getPathStyle('ทวารหนัก')}
            className="hover:fill-slate-800 transition-colors opacity-70"
            onClick={() => onSelect('ทวารหนัก/ส่วนท้าย (Anus/Perianal)')}
            d="M222.673721,496.289734 C222.969391,498.212463 218.609741,498.904846 221.545303,502.111755"
          />
        </g>

        {/* Structural Accents from SVG */}
        <path fill="#14181D" opacity="0.3" d="M597.17,271.9 C597.5,271.6 597.9,271.4 598.9,271.1" />
        <path fill="#2A333C" opacity="0.4" d="M118.9,84.5 C120.0,84 121.2,83.5 123.0,83.1" />
      </svg>
      
      {/* Current selection pin overlay */}
      {selectedLocations.length > 0 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-20">
          <div className="w-48 h-48 rounded-full border-4 border-emerald-500 animate-ping" />
        </div>
      )}
    </div>
  );
};
