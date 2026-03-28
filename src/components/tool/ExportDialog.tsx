import { useState } from 'react'
import { X, FileCode, FileText, Code2, Video } from 'lucide-react'
import { useShaderStore } from '../../store/shader-store'
import { exportAsHTML } from '../../export/export-html'
import { exportAsReact } from '../../export/export-react'
import { exportAsGLSL } from '../../export/export-glsl'
import { downloadFile } from '../../utils/download'

type Format = 'html' | 'react' | 'glsl' | 'video'

interface Props {
  open: boolean
  onClose: () => void
  canvasRef?: HTMLCanvasElement | null
}

export function ExportDialog({ open, onClose, canvasRef }: Props) {
  const [format, setFormat] = useState<Format>('html')
  const [recording, setRecording] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(5)
  const activePreset = useShaderStore((s) => s.activePreset)
  const parameters = useShaderStore((s) => s.parameters)

  if (!open) return null

  async function handleExport() {
    const name = activePreset.id

    if (format === 'html') {
      const html = exportAsHTML(activePreset, parameters)
      downloadFile(html, `${name}.html`, 'text/html')
    } else if (format === 'react') {
      const tsx = exportAsReact(activePreset, parameters)
      downloadFile(tsx, `${name}.tsx`, 'text/typescript')
    } else if (format === 'glsl') {
      const { glsl, manifest } = exportAsGLSL(activePreset, parameters)
      downloadFile(glsl, `${name}.frag`, 'text/plain')
      downloadFile(manifest, `${name}.json`, 'application/json')
    } else if (format === 'video' && canvasRef) {
      setRecording(true)
      const { exportAsVideo } = await import('../../export/export-video')
      await exportAsVideo(canvasRef, duration, `${name}.webm`, setProgress)
      setRecording(false)
      setProgress(0)
    }
  }

  const formats: { id: Format; label: string; desc: string; icon: typeof FileCode }[] = [
    { id: 'html', label: 'Standalone HTML', desc: 'Single file, zero dependencies', icon: FileCode },
    { id: 'react', label: 'React Component', desc: 'Self-contained .tsx with props', icon: Code2 },
    { id: 'glsl', label: 'Raw GLSL', desc: 'Fragment shader + uniform manifest', icon: FileText },
    { id: 'video', label: 'Video (WebM)', desc: 'Record animation as video', icon: Video },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-surface-primary rounded-xl shadow-2xl w-[480px] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-default">
          <h2 className="text-base font-bold text-text-primary">Export Shader</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-surface-secondary transition-colors cursor-pointer">
            <X size={18} className="text-text-tertiary" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {formats.map(({ id, label, desc, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setFormat(id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors cursor-pointer text-left ${
                format === id
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-border-default hover:border-border-strong'
              }`}
            >
              <Icon size={20} className={format === id ? 'text-brand-500' : 'text-text-tertiary'} />
              <div>
                <div className="text-sm font-semibold text-text-primary">{label}</div>
                <div className="text-xs text-text-secondary">{desc}</div>
              </div>
            </button>
          ))}

          {format === 'video' && (
            <div className="flex items-center gap-3 px-4">
              <label className="text-xs font-semibold text-text-secondary">Duration (s)</label>
              <input
                type="number"
                min={1}
                max={30}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-20 px-2 py-1 rounded-md border border-border-default text-xs text-text-primary"
              />
            </div>
          )}

          {recording && (
            <div className="px-4">
              <div className="h-1.5 rounded-full bg-border-default overflow-hidden">
                <div
                  className="h-full bg-brand-500 transition-all duration-200"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <p className="text-xs text-text-tertiary mt-1">Recording... {Math.round(progress * 100)}%</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border-default">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-medium text-text-secondary hover:bg-surface-secondary transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={recording}
            className="px-4 py-2 rounded-md text-sm font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors cursor-pointer disabled:opacity-50"
          >
            {recording ? 'Recording...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  )
}
