import Phaser from 'phaser';
import './nodes/CoreNodes.js';
import { BootScene } from './scenes/BootScene.js';
import { SplashScene } from './scenes/SplashScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';

async function initGame() {
  try {
    const res = await fetch('/data/game.json');
    if (!res.ok) throw new Error('Failed to load game.json');
    const gameData = await res.json();

    const config = {
      type: Phaser.AUTO,
      width: gameData.width || 1280,
      height: gameData.height || 720,
      parent: 'game-container',
      backgroundColor: '#0a0a1a',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      scene: [BootScene, SplashScene, MenuScene, GameScene]
    };

    new Phaser.Game(config);
  } catch (err) {
    console.error('Error initializing engine:', err);
  }
}

initGame();
