// lightweightSmoke.js
export class SmokeEffect {
  /**
   * Lightweight smoke effect without ParticleEmitterManager.
   * Reuses sprites from a pool. Intended for small 40x60px-area puffs.
   */
  constructor(scene) {
    this.scene = scene;

    // Create a minimal smoke texture once (soft circle)
    const key = '__lite_smoke_circle';
    if (!scene.textures.exists(key)) {
      const size = 64;
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      const radius = size / 2;
      for (let i = radius; i > 0; i--) {
        // outer is more transparent
        const alpha = Phaser.Math.Linear(0, 0.15, i / radius);
        g.fillStyle(0xffffff, alpha);
        g.fillCircle(radius, radius, i);
      }
      g.generateTexture(key, size, size);
      g.destroy();
    }
    this.textureKey = key;

    // Pool container
    this.pool = [];
    this.active = new Set();
    this.maxPool = 30; // adjustable
  }

  /**
   * Emit a smoke puff at (x,y), optionally attached to a target (like player)
   * config:
   *   width, height: spread box
   *   life: total duration in ms
   *   scale: max scale
   *   tint: tint color
   *   rise: how much it moves upward
   */
  emit(x, y, config = {}) {
    const {
      width = 40,
      height = 60,
      life = 800,
      scale = 1.0,
      tint = 0xcccccc,
      rise = 20,
      onComplete = null,
    } = config;

    const sprite = this._getSprite();
    sprite.setActive(true).setVisible(true);
    sprite.setTint(tint);
    sprite.setAlpha(0);
    sprite.setScale(0.1 * scale);

    // random offset in box
    const offsetX = Phaser.Math.Between(-width / 2, width / 2);
    const offsetY = Phaser.Math.Between(-height / 2, height / 2);
    sprite.setPosition(x + offsetX, y + offsetY);

    // animate: fade in, rise, grow, fade out
    const tl = this.scene.tweens.timeline({
      targets: sprite,
      ease: 'Quad.easeOut',
      tweens: [
        {
          alpha: 0.5,
          duration: life * 0.2,
          scale: 0.3 * scale,
        },
        {
          y: sprite.y - rise,
          alpha: 0.2,
          scale: 0.6 * scale,
          duration: life * 0.8,
        },
      ],
      onComplete: () => {
        this._recycle(sprite);
        if (onComplete) onComplete();
      },
    });

    this.active.add(sprite);
    return sprite;
  }

  _getSprite() {
    // reuse from pool
    let s = this.pool.find(p => !p.active);
    if (!s) {
      if (this.pool.length < this.maxPool) {
        s = this.scene.add.image(0, 0, this.textureKey);
        s.setOrigin(0.5);
        s.setDepth(10);
        this.pool.push(s);
      } else {
        // fallback: steal oldest active
        s = Array.from(this.active)[0];
        if (s) {
          s.stopTween?.stop?.();
        } else {
          // as last resort create new even if over pool
          s = this.scene.add.image(0, 0, this.textureKey);
          s.setOrigin(0.5);
          s.setDepth(10);
          this.pool.push(s);
        }
      }
    }
    return s;
  }

  _recycle(sprite) {
    sprite.setVisible(false);
    sprite.setActive(false);
    sprite.setScale(0.1);
    sprite.setAlpha(0);
    this.active.delete(sprite);
  }

  // Optional: clean all
  clearAll() {
    this.pool.forEach(s => s.destroy());
    this.pool = [];
    this.active.clear();
  }
}
