import type { PropertyDef } from '../../../types/properties'

export interface FileValue {
  name: string
  dataUrl: string
  extraFiles?: { name: string; dataUrl: string }[]
}

interface FileControlProps {
  param: PropertyDef
  value: unknown
  onChange: (value: FileValue) => void
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(file)
  })
}

export function FileControl({ param, value, onChange }: FileControlProps) {
  const fileValue = value as FileValue | '' | undefined
  const fileName = typeof fileValue === 'object' && fileValue !== null ? fileValue.name : null

  async function handleFiles(files: File[]) {
    if (files.length === 0) return

    const mainFile = files.find((f) => /\.(gltf|glb)$/i.test(f.name)) ?? files[0]
    const otherFiles = files.filter((f) => f !== mainFile)

    const mainDataUrl = await readAsDataUrl(mainFile)

    if (otherFiles.length === 0) {
      onChange({ name: mainFile.name, dataUrl: mainDataUrl })
      return
    }

    const extraFiles: { name: string; dataUrl: string }[] = []
    for (const f of otherFiles) {
      const dataUrl = await readAsDataUrl(f)
      const relPath = (f as File & { webkitRelativePath?: string }).webkitRelativePath
      const parts = relPath ? relPath.split('/').slice(1) : [f.name]
      extraFiles.push({ name: parts.join('/'), dataUrl })
      if (parts.length > 1) {
        extraFiles.push({ name: parts[parts.length - 1], dataUrl })
      }
    }

    onChange({ name: mainFile.name, dataUrl: mainDataUrl, extraFiles })
  }

  function handleFolderClick() {
    const input = document.createElement('input')
    input.type = 'file'
    input.setAttribute('webkitdirectory', '')
    input.onchange = (e) => {
      handleFiles(Array.from((e.target as HTMLInputElement).files ?? []))
    }
    input.click()
  }

  function handleFileClick() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = param.accept ?? '.gltf,.glb'
    input.onchange = (e) => {
      handleFiles(Array.from((e.target as HTMLInputElement).files ?? []))
    }
    input.click()
  }

  const isGltf = param.accept?.includes('gltf') ?? false

  const actionBtn = 'shrink-0 px-2.5 h-full text-xs font-medium bg-surface-base hover:bg-surface-panel text-text-secondary hover:text-text-primary transition-colors cursor-pointer border-l border-border-default'

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-text-secondary">{param.label}</label>
      <div className="flex h-7 border border-border-default overflow-hidden">
        {/* Filename display */}
        <div className="flex-1 flex items-center px-2 bg-surface-base overflow-hidden min-w-0">
          <span className="text-[10px] font-mono text-text-muted truncate">
            {fileName ?? (isGltf ? 'No model loaded' : 'No file loaded')}
          </span>
        </div>
        {/* File button */}
        <button onClick={handleFileClick} className={actionBtn}>
          {isGltf ? 'GLB' : 'Open'}
        </button>
        {/* Folder button — gltf only */}
        {isGltf && (
          <button onClick={handleFolderClick} className={actionBtn}>
            Folder
          </button>
        )}
      </div>
    </div>
  )
}
