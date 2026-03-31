import { downloadBlob } from '../utils/download'

/**
 * Export shader animation as video.
 *
 * Two strategies:
 * 1. Worker-based (preferred): Renders frames on OffscreenCanvas in a Web Worker,
 *    posts ImageBitmaps back, draws them onto a hidden canvas with MediaRecorder.
 *    Main thread stays responsive during the entire export.
 *
 * 2. Main-thread fallback: Uses captureStream() on the existing canvas.
 *    Simple but blocks the UI during recording.
 */

interface WorkerExportOptions {
  shaderSource: string
  uniforms: Record<string, number | boolean | number[]>
}

/** Worker-based export: renders off-thread, encodes on main thread via MediaRecorder */
async function exportWithWorker(
  width: number,
  height: number,
  duration: number,
  filename: string,
  options: WorkerExportOptions,
  onProgress?: (progress: number) => void,
): Promise<void> {
  const worker = new Worker(
    new URL('../workers/render-worker.ts', import.meta.url),
    { type: 'module' },
  )

  // Hidden canvas for MediaRecorder to capture from
  const captureCanvas = document.createElement('canvas')
  captureCanvas.width = width
  captureCanvas.height = height
  const ctx2d = captureCanvas.getContext('2d')!

  const fps = 60
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm'

  return new Promise<void>((resolve, reject) => {
    // Set up MediaRecorder on the capture canvas
    const stream = captureCanvas.captureStream(fps)
    const chunks: Blob[] = []
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 })

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType })
      downloadBlob(blob, filename)
      worker.terminate()
      resolve()
    }

    recorder.onerror = () => {
      worker.terminate()
      reject(new Error('MediaRecorder error'))
    }

    worker.onmessage = (e) => {
      const msg = e.data
      switch (msg.type) {
        case 'ready':
          // Worker initialized, start recording
          recorder.start(100)
          worker.postMessage({ type: 'render-video', duration, fps })
          break

        case 'frame':
          // Draw the worker-rendered bitmap onto the capture canvas
          ctx2d.drawImage(msg.bitmap, 0, 0)
          msg.bitmap.close()
          onProgress?.(msg.progress)
          break

        case 'done':
          // All frames rendered, stop recorder after a short delay for final encode
          setTimeout(() => recorder.stop(), 200)
          break

        case 'error':
          worker.terminate()
          reject(new Error(msg.message))
          break
      }
    }

    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error('Worker error: ' + e.message))
    }

    // Initialize the worker with shader + uniforms
    worker.postMessage({
      type: 'init',
      width,
      height,
      shaderSource: options.shaderSource,
      uniforms: options.uniforms,
    })
  })
}

/** Main-thread fallback: captures the existing canvas stream directly */
async function exportMainThread(
  canvas: HTMLCanvasElement,
  duration: number,
  filename: string,
  onProgress?: (progress: number) => void,
): Promise<void> {
  const stream = canvas.captureStream(60)
  const chunks: Blob[] = []

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm'

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 })

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  return new Promise((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType })
      downloadBlob(blob, filename)
      resolve()
    }

    recorder.start(100)

    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000
      onProgress?.(Math.min(elapsed / duration, 1))
      if (elapsed >= duration) {
        clearInterval(interval)
        recorder.stop()
      }
    }, 100)
  })
}

/** Check if OffscreenCanvas and Web Workers are available for rendering */
function canUseWorker(): boolean {
  return typeof OffscreenCanvas !== 'undefined' && typeof Worker !== 'undefined'
}

/**
 * Export a shader animation as a WebM video.
 *
 * If workerOptions is provided and OffscreenCanvas is supported, renders off-thread
 * for a jank-free export. Otherwise falls back to main-thread capture.
 */
export async function exportAsVideo(
  canvas: HTMLCanvasElement,
  duration: number,
  filename: string,
  onProgress?: (progress: number) => void,
  workerOptions?: WorkerExportOptions,
): Promise<void> {
  if (workerOptions && canUseWorker()) {
    try {
      return await exportWithWorker(
        canvas.width,
        canvas.height,
        duration,
        filename,
        workerOptions,
        onProgress,
      )
    } catch (e) {
      console.warn('Worker export failed, falling back to main thread:', e)
    }
  }

  return exportMainThread(canvas, duration, filename, onProgress)
}
