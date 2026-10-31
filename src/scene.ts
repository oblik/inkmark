import type { Scene, Step } from './types.ts';

/** Step id of a scene that has only `marks`. */
export const MARKS_STEP = 'marks';

/** The steps of a scene. A scene with only `marks` has one step. */
export function sceneSteps(scene: Pick<Scene, 'steps' | 'marks'>): Step[] {
  if (Array.isArray(scene.steps)) return scene.steps;
  return Array.isArray(scene.marks) ? [{ id: MARKS_STEP, marks: scene.marks }] : [];
}
