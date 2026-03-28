import { useRef, useState, useEffect } from 'react'
import { ShaderCanvas } from './ShaderCanvas'
import { ParameterPanel } from './ParameterPanel'
import { PresetGallery } from './PresetGallery'
import { Toolbar } from './Toolbar'
import { ExportDialog } from './ExportDialog'
import { useShaderStore } from '../../store/shader-store'
import { encodeShareURL, decodeShareURL } from '../../utils/url-sharing'
import { getPresetById } from '../../presets'

export function ToolLayout() {
  const [exportOpen, setExportOpen] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const setActivePreset = useShaderStore((s) => s.setActivePreset)
  const setParameter = useShaderStore((s) => s.setParameter)
  const activePreset = useShaderStore((s) => s.activePreset)
  const parameters = useShaderStore((s) => s.parameters)

  // Restore from URL hash on mount
  useEffect(() => {
    const data = decodeShareURL(window.location.hash)
    if (!data) return
    const preset = getPresetById(data.presetId)
    if (!preset) return
    setActivePreset(preset)
    for (const [key, value] of Object.entries(data.parameters)) {
      setParameter(key, value as number)
    }
  }, [setActivePreset, setParameter])

  function handleShare() {
    const url = encodeShareURL(activePreset, parameters)
    navigator.clipboard.writeText(url)
    window.history.replaceState(null, '', url.slice(url.indexOf('#')))
  }

  return (
    <div className="flex flex-col h-screen">
      <Toolbar onExport={() => setExportOpen(true)} onShare={handleShare} />
      <div className="flex flex-1 min-h-0">
        <div className="w-64 shrink-0">
          <PresetGallery />
        </div>
        <div className="flex-1 relative">
          {/* Checkerboard shows through when shader outputs alpha < 1 */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(45deg, #e0e0e0 25%, transparent 25%), linear-gradient(-45deg, #e0e0e0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e0e0e0 75%), linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)',
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
            }}
          />
          <ShaderCanvas ref={canvasRef} className="w-full h-full relative" />
        </div>
        <div className="w-72 shrink-0">
          <ParameterPanel />
        </div>
      </div>
      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        canvasRef={canvasRef.current}
      />
    </div>
  )
}
