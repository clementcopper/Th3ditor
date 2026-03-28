import { downloadBlob } from '../utils/download'

export async function exportAsVideo(
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
