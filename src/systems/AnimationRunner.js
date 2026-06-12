import Phaser from 'phaser';

/**
 * AnimationRunner translates JSON property keyframe tracks into Phaser Tweens.
 */
export class AnimationRunner {
  
  /**
   * Plays a property animation on a target GameObject.
   * @param {Phaser.Scene} scene 
   * @param {Phaser.GameObjects.GameObject} target 
   * @param {Object} animData - { duration, loop, tracks: { x: [{time, value, ease}], ... } }
   * @param {Function} onComplete
   */
  static play(scene, target, animData, onComplete) {
    if (!target || !animData || !animData.tracks) {
      if (onComplete) onComplete();
      return null;
    }

    const loop = animData.loop || 0; // -1 for infinite

    let activeChains = 0;
    const checkComplete = () => {
      activeChains--;
      if (activeChains <= 0 && onComplete) onComplete();
    };

    const trackKeys = Object.keys(animData.tracks);
    if (trackKeys.length === 0) {
      if (onComplete) onComplete();
      return null;
    }

    // We keep track of the initial state of the target to compute relative values correctly
    const initialValues = {};

    trackKeys.forEach(property => {
      initialValues[property] = target[property] || 0;
      const keyframes = animData.tracks[property];
      if (!keyframes || keyframes.length === 0) return;

      // Sort by time
      const sorted = [...keyframes].sort((a, b) => a.time - b.time);

      const chainConfigs = [];
      let previousTime = 0;
      let currentValue = initialValues[property];

      const parseValue = (val) => {
        if (typeof val === 'string') {
          if (val.startsWith('+=')) return currentValue + parseFloat(val.substring(2));
          if (val.startsWith('-=')) return currentValue - parseFloat(val.substring(2));
          return parseFloat(val);
        }
        return val;
      };

      // If there is a keyframe at time 0, apply it immediately
      if (sorted[0].time === 0) {
        currentValue = parseValue(sorted[0].value);
        target[property] = currentValue;
        sorted.shift();
      }

      for (const kf of sorted) {
        const dt = kf.time - previousTime;
        const targetVal = parseValue(kf.value);
        
        if (dt > 0) {
          chainConfigs.push({
            targets: target,
            [property]: targetVal,
            duration: dt,
            ease: kf.ease || 'Linear'
          });
        } else {
          // dt === 0, apply instantly
          target[property] = targetVal;
        }
        
        currentValue = targetVal;
        previousTime = kf.time;
      }

      if (chainConfigs.length > 0) {
        activeChains++;
        // Create a tween chain for this specific property
        scene.tweens.chain({
          tweens: chainConfigs,
          loop: loop,
          onComplete: checkComplete
        });
      }
    });

    if (activeChains === 0 && onComplete) {
      onComplete();
    }
  }
}
