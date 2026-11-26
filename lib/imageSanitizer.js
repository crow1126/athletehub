/**
 * lib/imageSanitizer.js
 *
 * Comprehensive image sanitization & security validation utility.
 * Defends against:
 * 1. Polyglot files (e.g., PHP/JS scripts appended to image binaries or EXIF metadata)
 * 2. Malicious SVGs (containing <script>, onload/onerror, foreignObject, XXE)
 * 3. MIME-type spoofing & content sniffing (verifies binary magic bytes)
 * 4. Image bombs / decompression bombs (caps maximum dimensions and file sizes)
 * 5. Path traversal via malicious filenames (strips ../ and non-alphanumeric chars)
 */

// Magic byte signatures for authorized raster image formats
const MAGIC_BYTES = {
  // JPEG: FF D8 FF
  jpeg: [0xff, 0xd8, 0xff],
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  png:  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  // GIF: 47 49 46 38 (GIF87a / GIF89a)
  gif:  [0x47, 0x49, 0x46, 0x38],
  // WEBP: RIFF....WEBP (bytes 0-3 = RIFF, bytes 8-11 = WEBP)
  webp: {
    riff: [0x52, 0x49, 0x46, 0x46],
    webp: [0x57, 0x45, 0x42, 0x50],
  },
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

/**
 * Check whether a binary buffer matches authorized image magic byte headers.
 * Safe for server-side (Node.js Buffer) and client-side (Uint8Array).
 *
 * @param {Uint8Array|Buffer} buffer
 * @returns {{ valid: boolean, format: string|null, mimeType: string|null }}
 */
export function verifyImageMagicBytes(buffer) {
  if (!buffer || buffer.length < 12) {
    return { valid: false, format: null, mimeType: null }
  }

  // Check JPEG
  if (
    buffer[0] === MAGIC_BYTES.jpeg[0] &&
    buffer[1] === MAGIC_BYTES.jpeg[1] &&
    buffer[2] === MAGIC_BYTES.jpeg[2]
  ) {
    return { valid: true, format: 'jpeg', mimeType: 'image/jpeg' }
  }

  // Check PNG
  if (
    buffer[0] === MAGIC_BYTES.png[0] &&
    buffer[1] === MAGIC_BYTES.png[1] &&
    buffer[2] === MAGIC_BYTES.png[2] &&
    buffer[3] === MAGIC_BYTES.png[3] &&
    buffer[4] === MAGIC_BYTES.png[4] &&
    buffer[5] === MAGIC_BYTES.png[5] &&
    buffer[6] === MAGIC_BYTES.png[6] &&
    buffer[7] === MAGIC_BYTES.png[7]
  ) {
    return { valid: true, format: 'png', mimeType: 'image/png' }
  }

  // Check GIF
  if (
    buffer[0] === MAGIC_BYTES.gif[0] &&
    buffer[1] === MAGIC_BYTES.gif[1] &&
    buffer[2] === MAGIC_BYTES.gif[2] &&
    buffer[3] === MAGIC_BYTES.gif[3]
  ) {
    return { valid: true, format: 'gif', mimeType: 'image/gif' }
  }

  // Check WEBP (RIFF at 0-3, WEBP at 8-11)
  if (
    buffer[0] === MAGIC_BYTES.webp.riff[0] &&
    buffer[1] === MAGIC_BYTES.webp.riff[1] &&
    buffer[2] === MAGIC_BYTES.webp.riff[2] &&
    buffer[3] === MAGIC_BYTES.webp.riff[3] &&
    buffer[8] === MAGIC_BYTES.webp.webp[0] &&
    buffer[9] === MAGIC_BYTES.webp.webp[1] &&
    buffer[10] === MAGIC_BYTES.webp.webp[2] &&
    buffer[11] === MAGIC_BYTES.webp.webp[3]
  ) {
    return { valid: true, format: 'webp', mimeType: 'image/webp' }
  }

  return { valid: false, format: null, mimeType: null }
}

/**
 * Sanitize an SVG string to remove script tags, event handlers, external references,
 * and dangerous XML entities before it can ever be stored or rendered.
 *
 * @param {string} svgText
 * @returns {string} Sanitized SVG content
 */
export function sanitizeSvgContent(svgText) {
  if (!svgText || typeof svgText !== 'string') return ''

  return svgText
    // Remove DOCTYPE & external entity definitions (XXE protection)
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!ENTITY[\s\S]*?>/gi, '')
    // Remove script tags and contents
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/>/gi, '')
    // Remove HTML embedding elements
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '')
    .replace(/<embed\b[\s\S]*?\/?>/gi, '')
    .replace(/<object\b[\s\S]*?<\/object>/gi, '')
    .replace(/<link\b[\s\S]*?\/?>/gi, '')
    .replace(/<meta\b[\s\S]*?\/?>/gi, '')
    // Remove event handlers (onload, onerror, onclick, onmouseover, etc.)
    .replace(/\bon\w+\s*=\s*(["'])[\s\S]*?\1/gi, '')
    .replace(/\bon\w+\s*=\s*[^>\s]+/gi, '')
    // Remove javascript: and data: text/html protocols
    .replace(/href\s*=\s*(["'])\s*javascript:[\s\S]*?\1/gi, 'href="#"')
    .replace(/xlink:href\s*=\s*(["'])\s*javascript:[\s\S]*?\1/gi, 'xlink:href="#"')
    .replace(/href\s*=\s*(["'])\s*data:\s*text\/html[\s\S]*?\1/gi, 'href="#"')
}

/**
 * Sanitize a filename to prevent path traversal (../), null byte injection,
 * and dangerous executable extensions.
 *
 * @param {string} rawName
 * @param {string} defaultExt
 * @returns {string} Safe filename
 */
export function sanitizeFilename(rawName, defaultExt = 'png') {
  if (!rawName || typeof rawName !== 'string') {
    return `photo-${Date.now()}.${defaultExt}`
  }

  // Remove directory separators and null bytes
  const cleanBase = rawName
    .replace(/[\/\\]/g, '')
    .replace(/\0/g, '')
    .replace(/\.\./g, '')
    .trim()

  const parts = cleanBase.split('.')
  let ext = defaultExt
  if (parts.length > 1) {
    const rawExt = parts.pop().toLowerCase().replace(/[^a-z0-9]/g, '')
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(rawExt)) {
      ext = rawExt === 'jpg' ? 'jpeg' : rawExt
    }
  }

  const baseName = parts.join('-').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50) || 'upload'
  return `${baseName}-${Date.now()}.${ext}`
}

/**
 * Client-Side Canvas Image Sanitizer & Re-encoder.
 *
 * THE ULTIMATE DEFENSE against polyglot and embedded script files in images:
 * - Decodes ONLY raw visual pixel data via the browser's native decoder.
 * - Draws pixels onto an isolated HTML Canvas.
 * - Re-encodes the canvas to a clean JPEG or PNG blob.
 * - All EXIF metadata, hidden trailing scripts, polyglot payloads, and malformed
 *   binary data are completely destroyed and stripped in the process.
 *
 * @param {File|Blob} file
 * @param {object} options
 * @param {number} options.maxWidth Default 1200
 * @param {number} options.maxHeight Default 1200
 * @param {number} options.quality Default 0.88
 * @param {string} options.outputType 'image/jpeg' | 'image/png' (default 'image/jpeg')
 * @returns {Promise<{ file: File, previewUrl: string, width: number, height: number }>}
 */
export async function sanitizeAndReencodeImage(file, {
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.88,
  outputType = 'image/jpeg',
} = {}) {
  if (!file) {
    throw new Error('No file provided for image sanitization.')
  }

  if (file.size > MAX_IMAGE_FILE_SIZE) {
    throw new Error('Image file is too large. Maximum allowed size is 5MB.')
  }

  // 1. Verify Magic Bytes
  const arrayBuffer = await file.slice(0, 32).arrayBuffer()
  const headerBytes = new Uint8Array(arrayBuffer)
  const magicCheck = verifyImageMagicBytes(headerBytes)

  // If file is SVG, sanitize the text content
  const isSvg = file.type === 'image/svg+xml' || file.name?.toLowerCase().endsWith('.svg')
  if (isSvg) {
    const text = await file.text()
    const sanitizedSvg = sanitizeSvgContent(text)
    const safeBlob = new Blob([sanitizedSvg], { type: 'image/svg+xml' })
    const safeName = sanitizeFilename(file.name || 'crest.svg', 'svg')
    const safeFile = new File([safeBlob], safeName, { type: 'image/svg+xml' })
    const previewUrl = URL.createObjectURL(safeBlob)
    return { file: safeFile, previewUrl, width: 400, height: 400 }
  }

  if (!magicCheck.valid) {
    throw new Error('Invalid image file format. Only legitimate JPG, PNG, or WEBP photos are allowed.')
  }

  // 2. Decode into Canvas to strip all embedded scripts, EXIF, and polyglots
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      // Calculate constrained dimensions
      let { width, height } = img
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width  = Math.max(1, Math.round(width * ratio))
        height = Math.max(1, Math.round(height * ratio))
      }

      // Create isolated Canvas
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d', { alpha: outputType === 'image/png' })

      if (!ctx) {
        reject(new Error('Canvas rendering context unavailable.'))
        return
      }

      // If rendering to JPEG, paint white background to prevent black transparent areas
      if (outputType === 'image/jpeg') {
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)
      }

      // Draw the pure decoded pixel data
      ctx.drawImage(img, 0, 0, width, height)

      // Re-encode to clean blob (strips all non-pixel data)
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to re-encode sanitized image.'))
          return
        }

        const ext = outputType === 'image/png' ? 'png' : 'jpg'
        const safeName = sanitizeFilename(file.name || `photo.${ext}`, ext)
        const sanitizedFile = new File([blob], safeName, { type: outputType })
        const previewUrl = URL.createObjectURL(blob)

        resolve({
          file: sanitizedFile,
          previewUrl,
          width,
          height,
        })
      }, outputType, quality)
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not decode image. The file may be corrupt or not a valid picture.'))
    }

    img.src = objectUrl
  })
}
