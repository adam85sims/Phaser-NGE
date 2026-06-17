import { Registry } from '../systems/Registry.js';
import { Data } from '../systems/DataLoader.js';

Registry.registerNodeType('dialogue', {
  label: 'Dialogue',
  color: '#3b82f6',
  executeRuntime: (node, ctrl) => {
    ctrl.events.emit('dialogue', {
      speaker: node.speaker || null,
      text: node.text || '',
      voice: node.voice || null,
      expression: node.expression || null,
      position: node.position || 'center',
      zIndex: node.zIndex || 0,
      autoAdvance: node.autoAdvance || false,
      waitTime: node.waitTime || 0,
      comment: node.comment || null
    });

    if (node.autoAdvance) {
      ctrl._autoTimer = ctrl.scene.time.delayedCall(node.waitTime || 2000, () => {
        ctrl.advance();
      });
    }
  }
});

Registry.registerNodeType('choice', {
  label: 'Choice',
  color: '#f59e0b',
  executeRuntime: (node, ctrl) => {
    const available = (node.choices || []).filter(c => {
      if (!c.condition) return true;
      return ctrl.vars.evaluate(c.condition);
    });

    if (available.length === 0) {
      if (node.next) ctrl.jumpToId(node.next);
      else ctrl.endScene();
      return;
    }

    ctrl._pendingChoices = available;

    ctrl.events.emit('choice', {
      prompt: node.prompt || null,
      choices: available.map(c => ({
        text: c.text,
        index: available.indexOf(c),
        next: c.next,
        nextScene: c.nextScene,
        setFlag: c.setFlag,
        setValue: c.setValue,
        toggleFlag: c.toggleFlag,
        addFlag: c.addFlag,
        delta: c.delta
      }))
    });
  }
});

Registry.registerNodeType('timed_choice', {
  label: 'Timed Choice',
  color: '#f97316',
  executeRuntime: (node, ctrl) => {
    const validChoices = (node.choices || []).filter(c => {
      if (!c.condition) return true;
      return ctrl.vars.evaluate(c.condition);
    });
    
    if (validChoices.length === 0) {
      if (node.next) ctrl.jumpToId(node.next);
      else ctrl.endScene();
      return;
    }

    ctrl._pendingChoices = validChoices;
    ctrl.isRunning = false;
    
    ctrl.events.emit('choice', {
      prompt: node.prompt || null,
      choices: validChoices.map(c => ({
        text: c.text,
        index: validChoices.indexOf(c),
        next: c.next,
        nextScene: c.nextScene,
        setFlag: c.setFlag,
        setValue: c.setValue,
        toggleFlag: c.toggleFlag,
        addFlag: c.addFlag,
        delta: c.delta
      })),
      duration: node.duration || 5000
    });

    ctrl._choiceTimer = ctrl.scene.time.addEvent({
      delay: node.duration || 5000,
      callback: () => {
        ctrl.events.emit('choiceTimeout');
        ctrl._choiceTimer = null;
        ctrl.isRunning = true;
        ctrl.jumpToId(node.default_next || node.next);
      }
    });
  }
});

Registry.registerNodeType('random_branch', {
  label: 'Random Branch',
  color: '#6366f1',
  executeRuntime: (node, ctrl) => {
    const branches = node.choices || [];
    if (branches.length === 0) {
      ctrl.advance();
      return;
    }

    const totalWeight = branches.reduce((sum, b) => sum + (Number(b.weight) || 1), 0);
    let roll = Math.random() * totalWeight;

    for (const b of branches) {
      const w = Number(b.weight) || 1;
      if (roll <= w) {
        if (b.next) ctrl.jumpToId(b.next);
        else ctrl.advance();
        return;
      }
      roll -= w;
    }
    ctrl.advance();
  }
});

Registry.registerNodeType('condition', {
  label: 'Condition',
  color: '#22c55e',
  executeRuntime: (node, ctrl) => {
    const isTrue = ctrl.vars.evaluate(node.condition);
    let targetId = isTrue ? node.next : node.else;

    if (!targetId && !isTrue && node.next) {
      targetId = node.next;
    }

    if (targetId) {
      ctrl.jumpToId(targetId);
    } else {
      ctrl.endScene();
    }
  }
});

Registry.registerNodeType('event', {
  label: 'Event',
  color: '#8b5cf6',
  executeRuntime: (node, ctrl) => {
    ctrl.events.emit('action', {
      type: node.eventType || 'sfx',
      value: node.eventValue || null,
      target: node.eventTarget || null,
      volume: node.eventVolume != null ? node.eventVolume : null,
      setFlag: node.setFlag,
      setValue: node.setValue,
      toggleFlag: node.toggleFlag,
      addFlag: node.addFlag,
      delta: node.delta
    });

    if (node.next) {
      ctrl.jumpToId(node.next);
    } else {
      ctrl.endScene();
    }
  }
});

Registry.registerNodeType('set_variable', {
  label: 'Set Variable',
  color: '#10b981',
  executeRuntime: (node, ctrl) => {
    if (node.variable) {
      const op = node.operation || 'set';
      let val = node.value;
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else if (!isNaN(Number(val)) && val !== '') val = Number(val);

      if (op === 'set') {
        ctrl.vars.set(node.variable, val);
      } else if (op === 'add') {
        const cur = Number(ctrl.vars.get(node.variable)) || 0;
        ctrl.vars.set(node.variable, cur + (Number(val) || 0));
      } else if (op === 'toggle') {
        const cur = ctrl.vars.get(node.variable);
        ctrl.vars.set(node.variable, !cur);
      }
    }
    ctrl.advance();
  }
});

Registry.registerNodeType('wait', {
  label: 'Wait',
  color: '#64748b',
  executeRuntime: (node, ctrl) => {
    const duration = node.duration || 1000;
    ctrl.events.emit('wait', { duration });

    ctrl._autoTimer = ctrl.scene.time.delayedCall(duration, () => {
      ctrl.advance();
    });
  }
});

Registry.registerNodeType('animate', {
  label: 'Animate',
  color: '#0ea5e9',
  executeRuntime: (node, ctrl) => {
    const { target, property, value, duration, easing, wait, next } = node;
    const durMs = duration || 1000;

    const onComplete = () => {
      if (wait) {
        if (next) ctrl.jumpToId(next);
        else ctrl.endScene();
      }
    };

    let targetObj = null;
    if (ctrl.scene.layers.layers[target]) targetObj = ctrl.scene.layers.layers[target];
    else if (ctrl.scene.characters.portraits[target]) targetObj = ctrl.scene.characters.portraits[target];

    if (targetObj) {
      const isRelative = typeof value === 'string' && (value.startsWith('+') || value.startsWith('-'));
      const numVal = isRelative ? Number(value.substring(1)) : Number(value);
      
      const tweenData = {
        targets: targetObj,
        duration: durMs,
        ease: easing || 'Linear',
        onComplete
      };

      if (property === 'alpha') {
        if (isRelative) tweenData.alpha = { value: value.startsWith('+') ? `+=${numVal}` : `-=${numVal}` };
        else tweenData.alpha = numVal;
      } else if (property === 'scale') {
        if (isRelative) {
          tweenData.scaleX = { value: value.startsWith('+') ? `+=${numVal}` : `-=${numVal}` };
          tweenData.scaleY = { value: value.startsWith('+') ? `+=${numVal}` : `-=${numVal}` };
        } else {
          tweenData.scaleX = numVal;
          tweenData.scaleY = numVal;
        }
      } else if (property === 'x' || property === 'y' || property === 'angle') {
        if (isRelative) tweenData[property] = { value: value.startsWith('+') ? `+=${numVal}` : `-=${numVal}` };
        else tweenData[property] = numVal;
      }

      ctrl.scene.tweens.add(tweenData);
    } else {
      console.warn(`Animate node: Target not found: ${target}`);
      onComplete();
    }

    if (!wait) {
      if (next) ctrl.jumpToId(next);
      else ctrl.endScene();
    }
  }
});

Registry.registerNodeType('show_object', {
  label: 'Show Object',
  color: '#14b8a6',
  executeRuntime: (node, ctrl) => {
    const { target, duration, wait, next } = node;
    const durMs = duration || 1000;

    const onComplete = () => {
      if (wait) {
        if (next) ctrl.jumpToId(next);
        else ctrl.endScene();
      }
    };

    if (ctrl.scene.layers.layers[target]) {
      ctrl.scene.layers.showLayer(target, durMs).then(onComplete);
    } else if (ctrl.scene.characters.portraits[target]) {
      const p = ctrl.scene.characters.portraits[target];
      ctrl.scene.tweens.add({ targets: p, alpha: 1, duration: durMs, onComplete });
    } else {
      console.warn(`Show Object node: Target not found: ${target}`);
      onComplete();
    }

    if (!wait) {
      if (next) ctrl.jumpToId(next);
      else ctrl.endScene();
    }
  }
});

Registry.registerNodeType('hide_object', {
  label: 'Hide Object',
  color: '#6b7280',
  executeRuntime: (node, ctrl) => {
    const { target, duration, wait, next } = node;
    const durMs = duration || 1000;

    const onComplete = () => {
      if (wait) {
        if (next) ctrl.jumpToId(next);
        else ctrl.endScene();
      }
    };

    if (ctrl.scene.layers.layers[target]) {
      ctrl.scene.layers.hideLayer(target, durMs).then(onComplete);
    } else if (ctrl.scene.characters.portraits[target]) {
      const p = ctrl.scene.characters.portraits[target];
      ctrl.scene.tweens.add({ targets: p, alpha: 0, duration: durMs, onComplete });
    } else {
      console.warn(`Hide Object node: Target not found: ${target}`);
      onComplete();
    }

    if (!wait) {
      if (next) ctrl.jumpToId(next);
      else ctrl.endScene();
    }
  }
});

Registry.registerNodeType('camera', {
  label: 'Camera',
  color: '#8b5cf6',
  executeRuntime: (node, ctrl) => {
    const { action, value, duration, wait, next } = node;
    const durMs = duration || 1000;
    const cam = ctrl.scene.cameras.main;

    const onComplete = () => {
      if (wait) {
        if (next) ctrl.jumpToId(next);
        else ctrl.endScene();
      }
    };

    if (action === 'shake') {
      const [durStr, intStr] = (value || '200,0.005').split(',');
      cam.shake(Number(durStr) || 200, Number(intStr) || 0.005, true, (cam, pct) => { if (pct === 1) onComplete(); });
    } else if (action === 'flash') {
      cam.flash(durMs, 255, 255, 255, true, (cam, pct) => { if (pct === 1) onComplete(); });
    } else if (action === 'fade_in') {
      cam.fadeIn(durMs, 0, 0, 0, (cam, pct) => { if (pct === 1) onComplete(); });
    } else if (action === 'fade_out') {
      cam.fadeOut(durMs, 0, 0, 0, (cam, pct) => { if (pct === 1) onComplete(); });
    } else if (action === 'zoom') {
      cam.zoomTo(Number(value) || 1, durMs, 'Linear', true, (cam, pct) => { if (pct === 1) onComplete(); });
    } else if (action === 'pan') {
      const [px, py] = (value || '').split(',').map(Number);
      cam.pan(px || cam.centerX, py || cam.centerY, durMs, 'Linear', true, (cam, pct) => { if (pct === 1) onComplete(); });
    } else {
      onComplete();
    }

    if (!wait) {
      if (next) ctrl.jumpToId(next);
      else ctrl.endScene();
    }
  }
});

Registry.registerNodeType('text_input', {
  label: 'Text Input',
  color: '#e879f9',
  executeRuntime: (node, ctrl) => {
    ctrl.isRunning = false;
    ctrl.events.emit('textInput', {
      prompt: node.prompt || 'Enter text:',
      variable: node.variable || 'player_name',
      maxLength: node.maxLength || 50
    });
  }
});

Registry.registerNodeType('chapter', {
  label: 'Chapter Title',
  color: '#f59e0b',
  executeRuntime: (node, ctrl) => {
    ctrl.isRunning = false;
    ctrl.events.emit('chapter', {
      title: node.title,
      subtitle: node.subtitle,
      duration: node.duration || 3000,
      next: node.next
    });
  }
});

Registry.registerNodeType('particles', {
  label: 'Particle Effect',
  color: '#10b981',
  executeRuntime: (node, ctrl) => {
    ctrl.events.emit('particles', {
      action: node.action || 'start',
      config: node.config,
      duration: node.duration,
      id: node.particleId
    });
    
    if (node.wait && node.duration > 0 && node.action !== 'stop') {
      ctrl.isRunning = false;
      ctrl.events.emit('wait', { duration: node.duration });
      ctrl.scene.time.delayedCall(node.duration, () => {
        ctrl.isRunning = true;
        ctrl.advance();
      });
    } else {
      ctrl.advance();
    }
  }
});

Registry.registerNodeType('call_scene', {
  label: 'Call Scene',
  color: '#ec4899',
  executeRuntime: (node, ctrl) => {
    if (!node.sceneId) {
      console.warn(`call_scene node has no sceneId: ${node.id}`);
      ctrl.advance();
      return;
    }

    ctrl._callStack.push({
      scene: ctrl.currentScene,
      returnNode: node.next
    });

    if (node.args) {
      ctrl.vars.pushScope(node.args);
    } else {
      ctrl.vars.pushScope({});
    }

    ctrl.startScene(node.sceneId, node.nodeId);
  }
});

Registry.registerNodeType('end', {
  label: 'End Scene',
  color: '#ef4444',
  executeRuntime: (node, ctrl) => {
    ctrl.endScene(node);
  }
});

// Alias for backwards compatibility if needed
Registry.registerNodeType('macro', Registry.getNodeType('call_scene'));
Registry.getNodeType('macro').label = 'Macro';
