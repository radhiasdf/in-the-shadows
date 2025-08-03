export function bounce(scene, target, {
  height = 10,           // how many pixels up
  liftDuration = 250,    // time going up
  dropDuration = 150,    // time coming down
  settleDuration = 100,  // time to return scale to normal
  squashFactor = 0.95,   // scaleY during lift
  stretchFactor = 1.05,  // scaleX during lift
  overshootY = 1.1,      // scaleY on landing overshoot
  undershootX = 0.9,     // scaleX on landing overshoot
  ease = 'Sine.easeInOut'// easing
} = {}) {
  // remember original y/scale in case something else modifies it
  const originalY = target.y;
  const originalScaleX = target.scaleX !== undefined ? target.scaleX : 1;
  const originalScaleY = target.scaleY !== undefined ? target.scaleY : 1;

  // if there's already a bounce tween, stop it first (safety)
  if (target._bounceTween) {
    target._bounceTween.stop();
    target._bounceTween = null;
  }

  const tl = scene.tweens.timeline({
    targets: target,
    loop: -1,
    ease,
    tweens: [
      {
        props: {
          y: originalY - height,
          scaleY: squashFactor * originalScaleY,
          scaleX: stretchFactor * originalScaleX,
        },
        duration: liftDuration,
      },
      {
        props: {
          y: originalY,
          scaleY: overshootY * originalScaleY,
          scaleX: undershootX * originalScaleX,
        },
        duration: dropDuration,
      },
      {
        props: {
          scaleY: originalScaleY,
          scaleX: originalScaleX,
        },
        duration: settleDuration,
      },
    ],
  });

  // store so caller can stop later
  target._bounceTween = tl;

  return target; // preserves your old usage if you expect the target back
}
