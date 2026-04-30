import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { summarizeHistory } from '../utils/history';

/**
 * ReportGenerator - Generates ISP performance reports as PDF
 * Uses expo-print for PDF generation and expo-sharing for sharing
 */

const generateHeatmapBase64 = (history) => {
  // Generate a simple SVG heatmap as base64 data URI
  // This is a simplified version - creates a 7x24 grid representing days/hours
  const cellSize = 20;
  const width = 24 * cellSize + 50; // 24 hours + labels
  const height = 7 * cellSize + 40; // 7 days + labels
  
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Aggregate data by day/hour
  const grid = {};
  history.forEach(item => {
    if (!item?.date) return;
    const date = new Date(item.date);
    const day = date.getDay();
    const hour = date.getHours();
    const key = `${day}-${hour}`;
    if (!grid[key]) grid[key] = { sum: 0, count: 0 };
    grid[key].sum += item.download || 0;
    grid[key].count += 1;
  });
  
  // Generate SVG cells
  let cellsSvg = '';
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const key = `${day}-${hour}`;
      const data = grid[key];
      const avgSpeed = data ? data.sum / data.count : 0;
      
      // Color based on speed
      let color = '#e5e7eb'; // gray for no data
      if (data && data.count > 0) {
        if (avgSpeed >= 200) color = '#166534';
        else if (avgSpeed >= 100) color = '#22c55e';
        else if (avgSpeed >= 50) color = '#eab308';
        else if (avgSpeed >= 20) color = '#f97316';
        else color = '#ef4444';
      }
      
      const x = 50 + hour * cellSize;
      const y = 30 + day * cellSize;
      cellsSvg += `<rect x="${x}" y="${y}" width="${cellSize - 1}" height="${cellSize - 1}" fill="${color}" rx="2"/>`;
    }
  }
  
  // Add day labels
  let dayLabels = '';
  days.forEach((day, i) => {
    dayLabels += `<text x="40" y="${45 + i * cellSize}" font-size="10" text-anchor="end" fill="#374151">${day}</text>`;
  });
  
  // Add hour labels
  let hourLabels = '';
  [0, 6, 12, 18].forEach(hour => {
    hourLabels += `<text x="${50 + hour * cellSize + cellSize/2}" y="${height - 5}" font-size="8" text-anchor="middle" fill="#6b7280">${hour}h</text>`;
  });
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="${width}" height="${height}" fill="white"/>
      ${dayLabels}
      ${hourLabels}
      ${cellsSvg}
    </svg>
  `;
  
  // Convert to base64
  const base64 = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${base64}`;
};

const extractCityFromLocation = (location) => {
  if (!location) return 'Unknown';
  // Try to extract city from location string (e.g., "New York, US" -> "New York")
  const parts = location.split(',');
  if (parts.length > 0) {
    return parts[0].trim();
  }
  return location;
};

const extractISPName = (history) => {
  if (!history || history.length === 0) return 'Unknown ISP';
  // Try to get ISP from provider field or serverLocation
  const firstItem = history[0];
  if (firstItem?.provider) return firstItem.provider;
  if (firstItem?.testProvider) return firstItem.testProvider;
  if (firstItem?.serverLocation) {
    // Extract from location if possible
    const parts = firstItem.serverLocation.split(',');
    if (parts.length > 1) return parts[1].trim();
  }
  return 'Unknown ISP';
};

const formatDateRange = (history) => {
  if (!history || history.length === 0) return '';
  const dates = history.map(item => new Date(item.date)).filter(d => !isNaN(d));
  if (dates.length === 0) return '';
  
  const sorted = dates.sort((a, b) => a - b);
  const start = sorted[0];
  const end = sorted[sorted.length - 1];
  
  const options = { month: 'short', year: 'numeric' };
  const startStr = start.toLocaleDateString('en-US', options);
  const endStr = end.toLocaleDateString('en-US', options);
  
  if (startStr === endStr) return startStr;
  return `${startStr} - ${endStr}`;
};

const generateHTML = (history, speedUnit, speedUnitLabel) => {
  const summary = summarizeHistory(history);
  const recentTests = history.slice(0, 10);
  const city = extractCityFromLocation(history[0]?.serverLocation);
  const ispName = extractISPName(history);
  const dateRange = formatDateRange(history);
  const heatmapBase64 = generateHeatmapBase64(history);
  
  const now = new Date();
  const monthYear = now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  
  // Calculate bufferbloat grade distribution
  const gradeCounts = {};
  history.forEach(item => {
    const grade = item.bufferbloatGrade || 'N/A';
    gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
  });
  
  const avgBufferbloatGrade = history.length > 0 
    ? Object.entries(gradeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
    : 'N/A';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0;
          padding: 20px;
          background: #f9fafb;
          color: #111827;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .header {
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 20px;
          margin-bottom: 24px;
        }
        .title {
          font-size: 28px;
          font-weight: 800;
          color: #111827;
          margin: 0 0 8px 0;
        }
        .subtitle {
          font-size: 14px;
          color: #6b7280;
          margin: 0;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .info-card {
          background: #f3f4f6;
          padding: 16px;
          border-radius: 8px;
        }
        .info-label {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 4px;
          font-weight: 600;
        }
        .info-value {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
        }
        .section {
          margin-bottom: 24px;
        }
        .section-title {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 12px;
          border-left: 4px solid #3b82f6;
          padding-left: 12px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        .stat-card {
          background: #eff6ff;
          padding: 12px;
          border-radius: 8px;
          text-align: center;
        }
        .stat-label {
          font-size: 11px;
          color: #6b7280;
          margin-bottom: 4px;
          font-weight: 600;
        }
        .stat-value {
          font-size: 20px;
          font-weight: 800;
          color: #1e40af;
        }
        .stat-unit {
          font-size: 12px;
          color: #6b7280;
        }
        .table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .table th {
          background: #f3f4f6;
          padding: 10px;
          text-align: left;
          font-weight: 700;
          color: #374151;
          border-bottom: 2px solid #e5e7eb;
        }
        .table td {
          padding: 10px;
          border-bottom: 1px solid #e5e7eb;
        }
        .table tr:last-child td {
          border-bottom: none;
        }
        .grade-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-weight: 700;
          font-size: 11px;
        }
        .grade-a { background: #dcfce7; color: #166534; }
        .grade-b { background: #fef9c3; color: #854d0e; }
        .grade-c { background: #fed7aa; color: #9a3412; }
        .grade-d { background: #fecaca; color: #991b1b; }
        .grade-f { background: #fee2e2; color: #7f1d1d; }
        .heatmap-container {
          text-align: center;
          margin: 16px 0;
        }
        .heatmap-img {
          max-width: 100%;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }
        .legend {
          display: flex;
          justify-content: center;
          gap: 16px;
          margin-top: 12px;
          font-size: 11px;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .legend-color {
          width: 12px;
          height: 12px;
          border-radius: 2px;
        }
        .footer {
          margin-top: 32px;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          font-size: 11px;
          color: #9ca3af;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="title">ISP Performance Report</h1>
          <p class="subtitle">Generated on ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        
        <div class="info-grid">
          <div class="info-card">
            <div class="info-label">Location</div>
            <div class="info-value">${city}</div>
          </div>
          <div class="info-card">
            <div class="info-label">ISP Provider</div>
            <div class="info-value">${ispName}</div>
          </div>
          <div class="info-card">
            <div class="info-label">Date Range</div>
            <div class="info-value">${dateRange}</div>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">Performance Summary</div>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Avg Download</div>
              <div class="stat-value">${summary.avgDownload.toFixed(1)}</div>
              <div class="stat-unit">${speedUnitLabel}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Avg Upload</div>
              <div class="stat-value">${summary.avgUpload.toFixed(1)}</div>
              <div class="stat-unit">${speedUnitLabel}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Avg Ping</div>
              <div class="stat-value">${summary.avgPing.toFixed(0)}</div>
              <div class="stat-unit">ms</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total Tests</div>
              <div class="stat-value">${summary.totalTests}</div>
              <div class="stat-unit">tests</div>
            </div>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">Best & Worst Performance</div>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Best Download</div>
              <div class="stat-value">${summary.bestDownload.toFixed(1)}</div>
              <div class="stat-unit">${speedUnitLabel}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Best Upload</div>
              <div class="stat-value">${summary.bestUpload.toFixed(1)}</div>
              <div class="stat-unit">${speedUnitLabel}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Best Ping</div>
              <div class="stat-value">${summary.bestPing === Infinity ? 'N/A' : summary.bestPing.toFixed(0)}</div>
              <div class="stat-unit">ms</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Avg Packet Loss</div>
              <div class="stat-value">${summary.avgPacketLoss.toFixed(2)}</div>
              <div class="stat-unit">%</div>
            </div>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">Bufferbloat Grade</div>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Overall Grade</div>
              <div class="stat-value">${avgBufferbloatGrade}</div>
              <div class="stat-unit">grade</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Avg Bufferbloat</div>
              <div class="stat-value">${summary.avgBufferbloatMs.toFixed(0)}</div>
              <div class="stat-unit">ms</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Avg Jitter</div>
              <div class="stat-value">${summary.avgJitter.toFixed(1)}</div>
              <div class="stat-unit">ms</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">MOS Score</div>
              <div class="stat-value">${summary.avgMosScore.toFixed(1)}</div>
              <div class="stat-unit">/5.0</div>
            </div>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">Time of Day Performance</div>
          <div class="heatmap-container">
            <img src="${heatmapBase64}" class="heatmap-img" alt="Time of Day Heatmap"/>
          </div>
          <div class="legend">
            <div class="legend-item"><div class="legend-color" style="background:#166534"></div>200+ Mbps</div>
            <div class="legend-item"><div class="legend-color" style="background:#22c55e"></div>100+ Mbps</div>
            <div class="legend-item"><div class="legend-color" style="background:#eab308"></div>50+ Mbps</div>
            <div class="legend-item"><div class="legend-color" style="background:#f97316"></div>20+ Mbps</div>
            <div class="legend-item"><div class="legend-color" style="background:#ef4444"></div>&lt;20 Mbps</div>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">Recent Tests (Last 10)</div>
          <table class="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Download</th>
                <th>Upload</th>
                <th>Ping</th>
                <th>Bufferbloat</th>
              </tr>
            </thead>
            <tbody>
              ${recentTests.map(test => {
                const date = new Date(test.date);
                const gradeClass = test.bufferbloatGrade ? `grade-${test.bufferbloatGrade.toLowerCase()}` : '';
                return `
                  <tr>
                    <td>${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                    <td>${test.download.toFixed(1)} ${speedUnitLabel}</td>
                    <td>${test.upload.toFixed(1)} ${speedUnitLabel}</td>
                    <td>${test.ping.toFixed(0)} ms</td>
                    <td><span class="grade-badge ${gradeClass}">${test.bufferbloatGrade || 'N/A'}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        
        <div class="footer">
          Report generated by Flash Speed Test • ${history.length} tests analyzed
        </div>
      </div>
    </body>
    </html>
  `;
};

export const generateAndSharePDF = async (history, speedUnit, speedUnitLabel) => {
  try {
    if (!history || history.length === 0) {
      throw new Error('No history data available');
    }
    
    // Generate HTML
    const html = generateHTML(history, speedUnit, speedUnitLabel);
    
    // Generate PDF
    const { uri } = await Print.printToFileAsync({ html });
    
    // Generate filename
    const ispName = extractISPName(history).replace(/\s+/g, '-');
    const now = new Date();
    const monthYear = now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const filename = `Internet-Report-${ispName}-${monthYear}.pdf`;
    
    // Share the PDF
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share ISP Report',
      UTI: 'com.adobe.pdf',
    });
    
    return { success: true, uri, filename };
  } catch (error) {
    console.error('PDF generation error:', error);
    throw error;
  }
};
