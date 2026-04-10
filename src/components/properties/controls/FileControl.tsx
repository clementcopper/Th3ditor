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

    // Build extraFiles with both relative path and bare filename as keys
    // so LoadingManager can resolve references like 'textures/color.png' or 'color.png'
    const extraFiles: { name: string; dataUrl: string }[] = []
    for (const f of otherFiles) {
      const dataUrl = await readAsDataUrl(f)
      // webkitRelativePath = 'folderName/sub/file.ext' → strip top folder
      const relPath = (f as File & { webkitRelativePath?: string }).webkitRelativePath
      const parts = relPath ? relPath.split('/').slice(1) : [f.name]
      extraFiles.push({ name: parts.join('/'), dataUrl })   // 'textures/color.png'
      if (parts.length > 1) {
        extraFiles.push({ name: parts[parts.length - 1], dataUrl }) // 'color.png'
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

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        <button
          onClick={handleFileClick}
          className="flex-1 px-2 py-1 text-xs text-left bg-[var(--bg-elevated)] hover:bg-[var(--border)] text-[var(--text-primary)] border border-[var(--border)] cursor-pointer"
        >
          GLB File
        </button>
        <button
          onClick={handleFolderClick}
          className="flex-1 px-2 py-1 text-xs text-left bg-[var(--bg-elevated)] hover:bg-[var(--border)] text-[var(--text-primary)] border border-[var(--border)] cursor-pointer"
        >
          glTF Folder
        </button>
      </div>
      <span className="text-[10px] text-[var(--text-muted)] truncate pl-1">
        {fileName ?? 'No model loaded'}
      </span>
    </div>
  )
}
