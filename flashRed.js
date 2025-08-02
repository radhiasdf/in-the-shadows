export function flashRed(sprite, scene, duration = 300) {
  // Start with full red tint
  sprite.setTint(0xFF0000);

  // Tween a counter from 0 to 1, and lerp the tint from red to white (no tint)
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: duration,
    ease: 'Quad.easeOut',
    onUpdate: (tween) => {
      const t = tween.getValue(); // 0 -> 1
      // Lerp each channel: red (255,0,0) to white (255,255,255)
      const greenBlue = Math.round(255 * t); // goes 0 -> 255
      const tintColor = (255 << 16) | (greenBlue << 8) | greenBlue; // 0xFFggbb
      sprite.setTint(tintColor);
    },
    onComplete: () => {
      sprite.clearTint();
    }
  });
}
