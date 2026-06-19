import { createSignal, createEffect, onMount, onCleanup } from 'solid-js';

export default function ThermalImage(props) {
  const canvasRef = { current: null };
  const [scale, setScale] = createSignal(1);
  const [offset, setOffset] = createSignal({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = createSignal(false);
  const [dragStart, setDragStart] = createSignal({ x: 0, y: 0 });
  const [hoveredPoint, setHoveredPoint] = createSignal(null);
  const [showColorBar, setShowColorBar] = createSignal(true);

  const temperatureMatrix = props.temperatureMatrix || generateMockMatrix(32, 32);
  const hotSpots = props.hotSpots || [];
  const minTemp = props.minTemp ?? 20;
  const maxTemp = props.maxTemp ?? 80;

  function generateMockMatrix(rows, cols) {
    const matrix = [];
    for (let i = 0; i < rows; i++) {
      const row = [];
      for (let j = 0; j < cols; j++) {
        const centerX = cols / 2;
        const centerY = rows / 2;
        const dist = Math.sqrt(Math.pow(j - centerX, 2) + Math.pow(i - centerY, 2));
        const baseTemp = 25 + Math.random() * 10;
        const heatSpot = dist < 5 ? 30 + (5 - dist) * 8 : 0;
        row.push(Math.round((baseTemp + heatSpot + Math.random() * 3) * 10) / 10);
      }
      matrix.push(row);
    }
    return matrix;
  }

  function tempToColor(temp) {
    const normalized = (temp - minTemp) / (maxTemp - minTemp);
    const clamped = Math.max(0, Math.min(1, normalized));

    if (clamped < 0.25) {
      const t = clamped / 0.25;
      return [0, 0, Math.round(128 + 127 * t)];
    } else if (clamped < 0.5) {
      const t = (clamped - 0.25) / 0.25;
      return [0, Math.round(255 * t), 255];
    } else if (clamped < 0.75) {
      const t = (clamped - 0.5) / 0.25;
      return [Math.round(255 * t), 255, Math.round(255 * (1 - t))];
    } else {
      const t = (clamped - 0.75) / 0.25;
      return [255, Math.round(255 * (1 - t)), 0];
    }
  }

  function renderThermalImage() {
    const canvas = canvasRef.current;
    if (!canvas || !temperatureMatrix.length) return;

    const ctx = canvas.getContext('2d');
    const rows = temperatureMatrix.length;
    const cols = temperatureMatrix[0].length;

    const imageData = ctx.createImageData(cols, rows);
    const data = imageData.data;

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const temp = temperatureMatrix[i][j];
        const [r, g, b] = tempToColor(temp);
        const idx = (i * cols + j) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  function drawHotSpots(ctx, canvasWidth, canvasHeight) {
    const rows = temperatureMatrix.length;
    const cols = temperatureMatrix[0].length;

    hotSpots.forEach((spot) => {
      const x = (spot.x / cols) * canvasWidth * scale() + offset().x;
      const y = (spot.y / rows) * canvasHeight * scale() + offset().y;
      const radius = (spot.radius || 2) * scale();

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = spot.alert ? '#ff0000' : '#ffff00';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = spot.alert ? 'rgba(255,0,0,0.3)' : 'rgba(255,255,0,0.3)';
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = `${12 * scale()}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(`${spot.temp}°C`, x, y - radius - 5);
    });
  }

  function handleWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.5, Math.min(5, scale() * delta));
    setScale(newScale);
  }

  function handleMouseDown(e) {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset().x, y: e.clientY - offset().y });
  }

  function handleMouseMove(e) {
    if (isDragging()) {
      setOffset({
        x: e.clientX - dragStart().x,
        y: e.clientY - dragStart().y,
      });
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left - offset().x) / scale()) / (canvas.width / temperatureMatrix[0].length));
    const y = Math.floor(((e.clientY - rect.top - offset().y) / scale()) / (canvas.height / temperatureMatrix.length));

    if (x >= 0 && x < temperatureMatrix[0].length && y >= 0 && y < temperatureMatrix.length) {
      setHoveredPoint({ x, y, temp: temperatureMatrix[y][x] });
    } else {
      setHoveredPoint(null);
    }
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  function resetView() {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }

  createEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    renderThermalImage();

    const displayCanvas = canvas.parentElement.querySelector('.display-canvas');
    if (displayCanvas) {
      const dCtx = displayCanvas.getContext('2d');
      displayCanvas.width = canvas.width * 8;
      displayCanvas.height = canvas.height * 8;

      dCtx.imageSmoothingEnabled = true;
      dCtx.imageSmoothingQuality = 'high';

      dCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
      dCtx.save();
      dCtx.translate(offset().x, offset().y);
      dCtx.scale(scale(), scale());
      dCtx.drawImage(canvas, 0, 0, displayCanvas.width, displayCanvas.height);
      drawHotSpots(dCtx, displayCanvas.width, displayCanvas.height);
      dCtx.restore();
    }
  });

  onMount(() => {
    renderThermalImage();
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);
  });

  onCleanup(() => {
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('mousemove', handleMouseMove);
  });

  return (
    <div
      class="thermal-image-container"
      style={{
        position: 'relative',
        width: '100%',
        height: props.height || '400px',
        background: '#1a1a2e',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
        width={temperatureMatrix[0]?.length || 32}
        height={temperatureMatrix.length || 32}
      />

      <canvas
        class="display-canvas"
        style={{
          width: '100%',
          height: '100%',
          cursor: isDragging() ? 'grabbing' : 'grab',
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
      />

      {hoveredPoint() && (
        <div
          style={{
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            background: 'rgba(0,0,0,0.8)',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '13px',
          }}
        >
          位置: ({hoveredPoint().x}, {hoveredPoint().y}) | 温度: {hoveredPoint().temp}°C
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          display: 'flex',
          gap: '8px',
        }}
      >
        <button
          onClick={resetView}
          style={{
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.8)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.6)')}
        >
          🔄 重置
        </button>
        <button
          onClick={() => setShowColorBar(!showColorBar())}
          style={{
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.8)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.6)')}
        >
          🎨 色标
        </button>
      </div>

      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          background: 'rgba(0,0,0,0.6)',
          color: '#fff',
          padding: '6px 12px',
          borderRadius: '4px',
          fontSize: '12px',
        }}
      >
        缩放: {Math.round(scale() * 100)}%
      </div>

      {showColorBar() && (
        <div
          style={{
            position: 'absolute',
            right: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '40px',
            background: 'rgba(0,0,0,0.6)',
            padding: '12px 8px',
            borderRadius: '6px',
          }}
        >
          <div
            style={{
              width: '24px',
              height: '200px',
              background: 'linear-gradient(to top, #000080, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000)',
              borderRadius: '4px',
            }}
          />
          <div style={{ textAlign: 'center', color: '#fff', fontSize: '11px', marginTop: '8px' }}>
            <div>{maxTemp}°C</div>
            <div style={{ marginTop: '170px' }}>{minTemp}°C</div>
          </div>
        </div>
      )}
    </div>
  );
}
