import type { GraphNode, GraphEdge } from '../types/node-graph'
import { downloadFile } from './download'

export interface ProjectFile {
  version: number
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export function saveProject(nodes: GraphNode[], edges: GraphEdge[], filename = 'project.wvs') {
  const data: ProjectFile = { version: 1, nodes, edges }
  downloadFile(JSON.stringify(data, null, 2), filename, 'application/json')
}

export function loadProjectFromFile(): Promise<ProjectFile> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.wvs,.json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return reject(new Error('No file selected'))
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string) as ProjectFile
          if (!data.nodes || !data.edges) throw new Error('Invalid project file')
          resolve(data)
        } catch (e) {
          reject(e)
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    }
    input.click()
  })
}
