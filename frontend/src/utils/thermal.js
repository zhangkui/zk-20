const COLOR_STOPS = [
  { temp: -20, r: 26, g: 35, b: 126 },
  { temp: -10, r: 13, g: 71, b: 161 },
  { temp: 0, r: 21, g: 101, b: 192 },
  { temp: 10, r: 25, g: 118, b: 210 },
  { temp: 20, r: 66, g: 165, b: 245 },
  { temp: 25, r: 129, g: 212, b: 250 },
  { temp: 30, r: 200, g: 230, b: 201 },
  { temp: 35, r: 165, g: 214, b: 167 },
  { temp: 40, r: 129, g: 199, b: 132 },
  { temp: 45, r: 255, g: 235, b: 59 },
  { temp: 50, r: 255, g: 193, b: 7 },
  { temp: 55, r: 255, g: 152, b: 0 },
  { temp: 60, r: 245, g: 124, b: 0 },
  { temp: 70, r: 230, g: 81, b: 0 },
  { temp: 80, r: 216, g: 67, b: 21 },
  { temp: 100, r: 183, g: 28, b: 28 },
];

export function celsiusToFahrenheit(celsius) {
  return (celsius * 9) / 5 + 32;
}

export function fahrenheitToCelsius(fahrenheit) {
  return ((fahrenheit - 32) * 5) / 9;
}

export function convertTemperature(temp, fromUnit = 'celsius', toUnit = 'celsius') {
  if (fromUnit === toUnit) return temp;
  if (fromUnit === 'celsius' && toUnit === 'fahrenheit') {
    return celsiusToFahrenheit(temp);
  }
  if (fromUnit === 'fahrenheit' && toUnit === 'celsius') {
    return fahrenheitToCelsius(temp);
  }
  return temp;
}

export function formatTemperature(temp, unit = 'celsius', decimals = 1) {
  const value = Number(temp).toFixed(decimals);
  const unitSymbol = unit === 'fahrenheit' ? '°F' : '°C';
  return `${value}${unitSymbol}`;
}

export function temperatureToColor(temperature, minTemp = -20, maxTemp = 100) {
  const temp = Math.max(minTemp, Math.min(maxTemp, temperature));

  if (temp <= COLOR_STOPS[0].temp) {
    return rgbToHex(COLOR_STOPS[0].r, COLOR_STOPS[0].g, COLOR_STOPS[0].b);
  }
  if (temp >= COLOR_STOPS[COLOR_STOPS.length - 1].temp) {
    const last = COLOR_STOPS[COLOR_STOPS.length - 1];
    return rgbToHex(last.r, last.g, last.b);
  }

  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const lower = COLOR_STOPS[i];
    const upper = COLOR_STOPS[i + 1];

    if (temp >= lower.temp && temp <= upper.temp) {
      const range = upper.temp - lower.temp;
      const fraction = (temp - lower.temp) / range;

      const r = Math.round(lower.r + (upper.r - lower.r) * fraction);
      const g = Math.round(lower.g + (upper.g - lower.g) * fraction);
      const b = Math.round(lower.b + (upper.b - lower.b) * fraction);

      return rgbToHex(r, g, b);
    }
  }

  return '#888888';
}

export function temperatureToRgb(temperature, minTemp = -20, maxTemp = 100) {
  const temp = Math.max(minTemp, Math.min(maxTemp, temperature));

  if (temp <= COLOR_STOPS[0].temp) {
    return { r: COLOR_STOPS[0].r, g: COLOR_STOPS[0].g, b: COLOR_STOPS[0].b };
  }
  if (temp >= COLOR_STOPS[COLOR_STOPS.length - 1].temp) {
    const last = COLOR_STOPS[COLOR_STOPS.length - 1];
    return { r: last.r, g: last.g, b: last.b };
  }

  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const lower = COLOR_STOPS[i];
    const upper = COLOR_STOPS[i + 1];

    if (temp >= lower.temp && temp <= upper.temp) {
      const range = upper.temp - lower.temp;
      const fraction = (temp - lower.temp) / range;

      const r = Math.round(lower.r + (upper.r - lower.r) * fraction);
      const g = Math.round(lower.g + (upper.g - lower.g) * fraction);
      const b = Math.round(lower.b + (upper.b - lower.b) * fraction);

      return { r, g, b };
    }
  }

  return { r: 136, g: 136, b: 136 };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function parseTemperatureMatrix(data) {
  if (!data) return null;

  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (e) {
      console.error('Failed to parse temperature matrix:', e);
      return null;
    }
  }

  let matrix;
  let width = 0;
  let height = 0;

  if (Array.isArray(data)) {
    if (Array.isArray(data[0])) {
      matrix = data;
      height = data.length;
      width = data[0].length;
    } else {
      const size = Math.sqrt(data.length);
      width = height = Math.round(size);
      matrix = [];
      for (let i = 0; i < height; i++) {
        matrix.push(data.slice(i * width, (i + 1) * width));
      }
    }
  } else if (data.matrix) {
    return parseTemperatureMatrix(data.matrix);
  } else if (data.data) {
    return parseTemperatureMatrix(data.data);
  } else {
    return null;
  }

  return {
    matrix,
    width,
    height,
    minTemp: findMinTemp(matrix),
    maxTemp: findMaxTemp(matrix),
    avgTemp: findAvgTemp(matrix),
  };
}

function findMinTemp(matrix) {
  let min = Infinity;
  for (const row of matrix) {
    for (const val of row) {
      if (typeof val === 'number' && val < min) {
        min = val;
      }
    }
  }
  return min === Infinity ? 0 : min;
}

function findMaxTemp(matrix) {
  let max = -Infinity;
  for (const row of matrix) {
    for (const val of row) {
      if (typeof val === 'number' && val > max) {
        max = val;
      }
    }
  }
  return max === -Infinity ? 0 : max;
}

function findAvgTemp(matrix) {
  let sum = 0;
  let count = 0;
  for (const row of matrix) {
    for (const val of row) {
      if (typeof val === 'number') {
        sum += val;
        count++;
      }
    }
  }
  return count > 0 ? sum / count : 0;
}

export function calculateHotspots(matrixData, threshold = 50, minArea = 4) {
  if (!matrixData || !matrixData.matrix) return [];

  const { matrix, width, height } = matrixData;
  const visited = Array(height).fill(null).map(() => Array(width).fill(false));
  const hotspots = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!visited[y][x] && matrix[y][x] >= threshold) {
        const hotspot = floodFill(matrix, visited, x, y, threshold, width, height);
        if (hotspot.points.length >= minArea) {
          hotspots.push({
            x: hotspot.centerX,
            y: hotspot.centerY,
            temperature: hotspot.maxTemp,
            area: hotspot.points.length,
            riskLevel: getRiskLevel(hotspot.maxTemp),
            points: hotspot.points,
          });
        }
      }
    }
  }

  return hotspots.sort((a, b) => b.temperature - a.temperature);
}

function floodFill(matrix, visited, startX, startY, threshold, width, height) {
  const stack = [[startX, startY]];
  const points = [];
  let maxTemp = -Infinity;
  let sumX = 0;
  let sumY = 0;

  while (stack.length > 0) {
    const [x, y] = stack.pop();

    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    if (visited[y][x]) continue;
    if (matrix[y][x] < threshold) continue;

    visited[y][x] = true;
    points.push({ x, y, temp: matrix[y][x] });

    if (matrix[y][x] > maxTemp) {
      maxTemp = matrix[y][x];
    }

    sumX += x;
    sumY += y;

    stack.push([x + 1, y]);
    stack.push([x - 1, y]);
    stack.push([x, y + 1]);
    stack.push([x, y - 1]);
  }

  return {
    points,
    maxTemp,
    centerX: sumX / points.length,
    centerY: sumY / points.length,
  };
}

function getRiskLevel(temperature) {
  if (temperature >= 80) return 'high';
  if (temperature >= 60) return 'medium';
  return 'low';
}

export function renderThermalImage(canvas, matrixData, options = {}) {
  if (!canvas || !matrixData || !matrixData.matrix) return;

  const ctx = canvas.getContext('2d');
  const { matrix, width, height, minTemp, maxTemp } = matrixData;
  const { scale = 4, showCrosshair = false, crosshairX = 0, crosshairY = 0 } = options;

  canvas.width = width * scale;
  canvas.height = height * scale;

  const imageData = ctx.createImageData(canvas.width, canvas.height);
  const data = imageData.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const temp = matrix[y][x];
      const rgb = temperatureToRgb(temp, minTemp, maxTemp);

      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const pixelX = x * scale + sx;
          const pixelY = y * scale + sy;
          const index = (pixelY * canvas.width + pixelX) * 4;

          data[index] = rgb.r;
          data[index + 1] = rgb.g;
          data[index + 2] = rgb.b;
          data[index + 3] = 255;
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  if (showCrosshair) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(crosshairX * scale, 0);
    ctx.lineTo(crosshairX * scale, canvas.height);
    ctx.moveTo(0, crosshairY * scale);
    ctx.lineTo(canvas.width, crosshairY * scale);
    ctx.stroke();
  }
}

export function getTemperatureLevel(temperature) {
  if (temperature >= 70) return 'high';
  if (temperature >= 50) return 'medium';
  if (temperature >= 10) return 'normal';
  return 'low';
}

export function getTemperatureColorClass(temperature) {
  const level = getTemperatureLevel(temperature);
  return `temperature-${level}`;
}

export default {
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  convertTemperature,
  formatTemperature,
  temperatureToColor,
  temperatureToRgb,
  parseTemperatureMatrix,
  calculateHotspots,
  renderThermalImage,
  getTemperatureLevel,
  getTemperatureColorClass,
};
