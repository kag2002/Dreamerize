import type { AnimatedTimeUniform, AnimationBusLike } from './types';

/**
 * Centralized shader time and wind-speed uniform dispatcher.
 * Deduplicates uniform references via a Set so shared uniforms are ticked once per frame.
 */
export class AnimationBus implements AnimationBusLike {
  private readonly uniforms = new Set<AnimatedTimeUniform>();

  public register(uni: AnimatedTimeUniform): void {
    if (uni && uni.uTime && typeof uni.uTime.value === 'number') {
      this.uniforms.add(uni);
    }
  }

  public registerMany(list: AnimatedTimeUniform[]): void {
    for (const u of list) {
      this.register(u);
    }
  }

  public update(elapsedTime: number): void {
    for (const u of this.uniforms) {
      u.uTime.value = elapsedTime;
    }
  }

  public setWindSpeed(speed: number): void {
    for (const u of this.uniforms) {
      if (u.uWindSpeed) {
        u.uWindSpeed.value = speed;
      }
    }
  }

  public size(): number {
    return this.uniforms.size;
  }

  public clear(): void {
    this.uniforms.clear();
  }
}
