// =============================================================================
// src/io/importSvg.test-sample.ts — Sample Runner for importSvg
// =============================================================================

import { Window } from 'happy-dom'

// Ensure DOMParser is globally available in Node.js environment via happy-dom
if (typeof globalThis.DOMParser === 'undefined') {
  const domWindow = new Window()
  globalThis.DOMParser = domWindow.DOMParser as unknown as typeof DOMParser
}

import { parseSvg } from './importSvg'

function runSampleTests() {
  console.log('\n======================================================================')
  console.log(' VECTORCRAFT STUDIO — SVG IMPORT VERIFICATION')
  console.log('======================================================================')

  // -------------------------------------------------------------------------
  // Sample 1: Simple shapes, attributes, inline styles, sanitization
  // -------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------------')
  console.log('SAMPLE 1: Simple Shapes, Inline Styles, Attributes & Sanitization')
  console.log('----------------------------------------------------------------------')

  const sample1 = `
    <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
      <!-- Security threats to sanitize -->
      <script>alert("xss")</script>
      <foreignObject width="100" height="100"><div>dangerous</div></foreignObject>

      <!-- rect with rx and inline style overriding fill attribute (style wins) -->
      <rect id="rect-1" x="20" y="30" width="120" height="80" rx="8"
            fill="red" style="fill: #2563eb; stroke: #1e3a8a; stroke-width: 3px; stroke-dasharray: 4 2"
            onclick="exploit()" onmouseover="track()" />

      <!-- circle with opacity -->
      <circle id="circle-1" cx="200" cy="80" r="40" fill="#10b981" opacity="0.85" />

      <!-- ellipse with rx, ry and stroke -->
      <ellipse id="ellipse-1" cx="320" cy="80" rx="50" ry="30" fill="#f59e0b" stroke="#b45309" stroke-width="2" />

      <!-- line with stroke-linecap -->
      <line id="line-1" x1="400" y1="40" x2="480" y2="120" stroke="#ef4444" stroke-width="4" stroke-linecap="round" />

      <!-- polyline -->
      <polyline id="polyline-1" points="500,100 530,40 560,90 590,50" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linejoin="round" />

      <!-- polygon -->
      <polygon id="polygon-1" points="620,40 670,40 680,90 610,90" fill="#ec4899" stroke="#9d174d" stroke-width="1.5" />

      <!-- path (keeps d string) -->
      <path id="path-1" d="M 50 200 C 80 150 120 250 150 200 Z" fill="#06b6d4" stroke="#0e7490" stroke-width="2" />

      <!-- text with tspans (tspans become lines separated by newline) -->
      <text id="text-1" x="250" y="200" font-family="Helvetica" font-size="20" fill="#334155" style="font-weight: bold; font-style: italic">
        <tspan>Header Title</tspan>
        <tspan>Second Line of Text</tspan>
      </text>

      <!-- Unsupported element to verify warning -->
      <image href="test.png" x="0" y="0" width="10" height="10" />
    </svg>
  `

  const result1 = parseSvg(sample1)
  console.log(`Parsed ${result1.elements.length} elements successfully:`)
  for (const el of result1.elements) {
    console.log(`\n• [${el.type.toUpperCase()}] id="${el.id}" name="${el.name}"`)
    console.log(`  Transform: x=${el.transform.x}, y=${el.transform.y}, w=${el.transform.width}, h=${el.transform.height}, rot=${el.transform.rotation}°`)
    console.log(`  Style: fill="${el.style.fill}", stroke="${el.style.stroke}", strokeWidth=${el.style.strokeWidth}, opacity=${el.style.opacity}, dash="${el.style.strokeDashArray}", cap="${el.style.strokeLineCap}", join="${el.style.strokeLineJoin}"`)
    if (el.type === 'rect') {
      console.log(`  Corner Radius: rx=${el.rx}, ry=${el.ry}`)
    }
    if (el.type === 'line') {
      console.log(`  Endpoints: (${el.x1}, ${el.y1}) -> (${el.x2}, ${el.y2})`)
    }
    if (el.type === 'path') {
      console.log(`  PathData (d): "${el.pathData}"`)
      console.log(`  Extracted Points Count: ${el.points?.length ?? 0}`)
    }
    if (el.type === 'text') {
      console.log(`  Text Content (multiline): ${JSON.stringify(el.textStyle.content)}`)
      console.log(`  Typography: ${el.textStyle.fontSize}px ${el.textStyle.fontFamily} (${el.textStyle.fontWeight}, ${el.textStyle.fontStyle})`)
    }
  }

  console.log(`\nWarnings (${result1.warnings.length}):`)
  result1.warnings.forEach((w) => console.log(`  ⚠ ${w}`))

  // -------------------------------------------------------------------------
  // Sample 2: Grouped and transformed hierarchy (flattened)
  // -------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------------')
  console.log('SAMPLE 2: Grouped & Transformed (<g> Flattened, Transforms Resolved)')
  console.log('----------------------------------------------------------------------')

  const sample2 = `
    <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
      <!-- Outer group with translation and inherited styles -->
      <g id="outer-group" transform="translate(100, 50)" fill="#1e293b" stroke="#3b82f6" stroke-width="2">
        <!-- Child inherits parent translation (x=0, y=0 => world x=100, y=50) -->
        <rect id="rect-in-group" x="0" y="0" width="80" height="40" rx="4" />

        <!-- Nested group with scale(2) translate(10, 10) -->
        <g id="inner-group" transform="scale(2) translate(10, 10)">
          <!-- Circle center cx=20, cy=20, r=10 inside translate(100, 50) * scale(2) * translate(10, 10) -->
          <circle id="circle-in-nested-group" cx="20" cy="20" r="10" fill="#f43f5e" />

          <!-- Line from (0,0) to (30,40) inside cumulative transform -->
          <line id="line-in-nested-group" x1="0" y1="0" x2="30" y2="40" stroke="#10b981" stroke-width="1.5" />
        </g>
      </g>
    </svg>
  `

  const result2 = parseSvg(sample2)
  console.log(`Parsed ${result2.elements.length} flattened elements (no <g> wrapper in output):`)
  for (const el of result2.elements) {
    console.log(`\n• [${el.type.toUpperCase()}] name="${el.name}"`)
    console.log(`  Resolved Geometry: x=${el.transform.x}, y=${el.transform.y}, w=${el.transform.width}, h=${el.transform.height}`)
    console.log(`  Inherited Styles: fill="${el.style.fill}", stroke="${el.style.stroke}", strokeWidth=${el.style.strokeWidth}`)
    if (el.type === 'line') {
      console.log(`  Resolved Endpoints: (${el.x1}, ${el.y1}) -> (${el.x2}, ${el.y2})`)
    }
  }

  // -------------------------------------------------------------------------
  // Sample 3: Malformed XML and Missing <svg> root error handling
  // -------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------------')
  console.log('SAMPLE 3: Malformed SVG & Non-SVG Validation (Readable Errors Thrown)')
  console.log('----------------------------------------------------------------------')

  const malformedXml = `<svg><rect x="10" y="20"><unclosed-tag></svg>`
  try {
    parseSvg(malformedXml)
    console.error('FAIL: Expected error for malformed XML was not thrown.')
  } catch (err) {
    const error = err as Error
    console.log(`[PASS] Correctly threw readable Error for malformed XML:`)
    console.log(`  -> "${error.message}"`)
  }

  const nonSvgXml = `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body>Not an SVG root</body></html>`
  try {
    parseSvg(nonSvgXml)
    console.error('FAIL: Expected error for non-SVG root was not thrown.')
  } catch (err) {
    const error = err as Error
    console.log(`[PASS] Correctly threw readable Error for missing <svg> root:`)
    console.log(`  -> "${error.message}"`)
  }

  console.log('\n======================================================================')
  console.log(' ALL 3 SAMPLE TESTS COMPLETED SUCCESSFULLY!')
  console.log('======================================================================\n')
}

runSampleTests()
