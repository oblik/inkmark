import type { Scene } from './types.ts';
import { mountScene, type MountOptions, type SceneHandle } from './mount.ts';
import { injectCss } from './stage.ts';

/**
 * Draws a scene in its final state, like a screenshot: every mark is drawn,
 * with no animation and no controls. Steps that `clear` still hide earlier marks.
 */
export async function drawScene(container: HTMLElement, scene: Scene, options: MountOptions = {}): Promise<SceneHandle> {
  injectCss();
  const handle = await mountScene(container, scene, options);
  // The end of the last step, before the spotlight fades out at the very end.
  handle.seekStep(handle.steps.length - 1, 'end');
  return handle;
}
