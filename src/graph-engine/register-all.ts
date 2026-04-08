import { registerGeometryNodes } from './node-definitions/geometry'
import { registerMaterialNodes } from './node-definitions/material'
import { registerObjectNodes } from './node-definitions/object'
import { registerSceneNodes } from './node-definitions/scene'
import { registerLightNodes } from './node-definitions/light'
import { registerTransformNodes } from './node-definitions/transform'
import { registerTimeNodes } from './node-definitions/time'
import { registerMathNodes } from './node-definitions/math'
import { registerInputNodes } from './node-definitions/input'
import { registerCameraNodes } from './node-definitions/camera'

let registered = false

export function registerAllNodes() {
  if (registered) return
  registered = true
  registerGeometryNodes()
  registerMaterialNodes()
  registerObjectNodes()
  registerSceneNodes()
  registerLightNodes()
  registerTransformNodes()
  registerTimeNodes()
  registerMathNodes()
  registerInputNodes()
  registerCameraNodes()
}
