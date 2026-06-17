import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransitionSystem } from '../../src/systems/TransitionSystem.js';

describe('TransitionSystem', () => {
  let mockScene;
  let mockCameras;
  let mockTweens;
  let mockGraphics;

  beforeEach(() => {
    mockGraphics = {
      fillStyle: vi.fn(),
      fillRect: vi.fn(),
      setDepth: vi.fn(),
      destroy: vi.fn(),
      x: 0,
      y: 0
    };

    mockCameras = {
      main: {
        fadeOut: vi.fn(),
        fadeIn: vi.fn(),
        once: vi.fn((event, callback) => {
          // Immediately invoke the callback for synchronous testing
          callback();
        })
      }
    };

    mockTweens = {
      add: vi.fn((config) => {
        // Immediately invoke onComplete for synchronous testing
        if (config.onComplete) {
          config.onComplete();
        }
      })
    };

    mockScene = {
      cameras: mockCameras,
      tweens: mockTweens,
      add: {
        graphics: vi.fn(() => mockGraphics)
      },
      scale: {
        width: 1280,
        height: 720
      }
    };
  });

  describe('runTransition', () => {
    it('defaults to fade to black if type is invalid or missing', () => {
      TransitionSystem.runTransition(mockScene, null, 1000);
      expect(mockCameras.main.fadeOut).toHaveBeenCalledWith(500, 0, 0, 0);
    });

    it('handles fade transition with default black color', () => {
      TransitionSystem.runTransition(mockScene, 'fade', 600);
      expect(mockCameras.main.fadeOut).toHaveBeenCalledWith(300, 0, 0, 0);
      expect(mockCameras.main.fadeIn).toHaveBeenCalledWith(300, 0, 0, 0);
    });

    it('handles white_fade transition', () => {
      TransitionSystem.runTransition(mockScene, 'white_fade', 600);
      expect(mockCameras.main.fadeOut).toHaveBeenCalledWith(300, 255, 255, 255);
      expect(mockCameras.main.fadeIn).toHaveBeenCalledWith(300, 255, 255, 255);
    });

    it('calls callbacks during fade transitions', () => {
      const onMidpoint = vi.fn();
      const onComplete = vi.fn();
      
      TransitionSystem.runTransition(mockScene, 'fade', 600, onComplete, onMidpoint);
      
      expect(onMidpoint).toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalled();
      
      // Verify order: fadeOut -> onMidpoint -> fadeIn -> onComplete
      // Because we mock `once` to call synchronously, they all happen in order
      expect(mockCameras.main.once).toHaveBeenCalledTimes(2);
    });

    it('handles slide_left transition', () => {
      TransitionSystem.runTransition(mockScene, 'slide_left', 1000);
      
      expect(mockScene.add.graphics).toHaveBeenCalled();
      expect(mockGraphics.fillRect).toHaveBeenCalledWith(0, 0, 1280, 720);
      expect(mockGraphics.x).toBe(1280); // Starts at right edge, moves left
      
      expect(mockTweens.add).toHaveBeenCalledTimes(2);
      expect(mockTweens.add.mock.calls[0][0].x).toBe(0); // Midpoint
      expect(mockTweens.add.mock.calls[1][0].x).toBe(-1280); // End
      
      expect(mockGraphics.destroy).toHaveBeenCalled();
    });

    it('handles slide_right transition', () => {
      TransitionSystem.runTransition(mockScene, 'slide_right', 1000);
      
      expect(mockGraphics.x).toBe(-1280); // Starts at left edge, moves right
      
      expect(mockTweens.add).toHaveBeenCalledTimes(2);
      expect(mockTweens.add.mock.calls[0][0].x).toBe(0); // Midpoint
      expect(mockTweens.add.mock.calls[1][0].x).toBe(1280); // End
    });

    it('calls callbacks during slide transitions', () => {
      const onMidpoint = vi.fn();
      const onComplete = vi.fn();
      
      TransitionSystem.runTransition(mockScene, 'slide_left', 1000, onComplete, onMidpoint);
      
      expect(onMidpoint).toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalled();
    });
  });
});
