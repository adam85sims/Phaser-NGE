export class ChapterSystem {
  constructor(scene) {
    this.scene = scene;
    this.W = scene.W;
    this.H = scene.H;
    
    // Group for chapter UI
    this.container = scene.add.container(0, 0).setDepth(300);
    this.container.setAlpha(0);
    this.container.setVisible(false);

    // Background overlay
    this.bg = scene.add.rectangle(0, 0, this.W, this.H, 0x000000, 0.85).setOrigin(0);
    this.container.add(this.bg);

    // Title
    this.titleText = scene.add.text(this.W / 2, this.H / 2 - 20, '', {
      fontFamily: 'sans-serif',
      fontSize: '64px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    // Subtitle
    this.subtitleText = scene.add.text(this.W / 2, this.H / 2 + 50, '', {
      fontFamily: 'sans-serif',
      fontSize: '32px',
      color: '#aaaaaa'
    }).setOrigin(0.5);
    this.container.add(this.subtitleText);
  }

  showChapterCard(title, subtitle, duration = 3000, onComplete) {
    this.titleText.setText(title || '');
    this.subtitleText.setText(subtitle || '');
    
    // Initial state
    this.titleText.setAlpha(0);
    this.titleText.setY(this.H / 2 - 10);
    this.subtitleText.setAlpha(0);
    this.subtitleText.setY(this.H / 2 + 60);
    
    this.container.setAlpha(1);
    this.container.setVisible(true);
    
    // Fade in text
    this.scene.tweens.add({
      targets: [this.titleText, this.subtitleText],
      alpha: 1,
      y: '-=10',
      duration: 1000,
      ease: 'Sine.easeOut',
      onComplete: () => {
        // Hold
        this.scene.time.delayedCall(duration, () => {
          // Fade out whole container
          this.scene.tweens.add({
            targets: this.container,
            alpha: 0,
            duration: 800,
            onComplete: () => {
              this.container.setVisible(false);
              if (onComplete) onComplete();
            }
          });
        });
      }
    });
  }
}
