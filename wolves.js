export class WolfManager {
  constructor(scene, player, numWolves = 0) {
    this.scene = scene;
    this.player = player;
    this.wolves = scene.physics.add.group();
    this.scene.physics.add.collider(player, this.wolves, (player, wolf) => {
      if (!player.damaged) {
        player.damaged = true;
        //player.health =- 1;
        console.log("Player hit by enemy!");
      }
    });

    this.scene.physics.add.collider(this.wolves, scene.houseGroup);
    this.scene.physics.add.collider(this.wolves, this.wolves);

    scene.wolfManager = this; // <--- so later you can do scene.wolfManager.wolves
  }

  spawnWolves(num) {
    for (let i = 0; i < num; i++) {
      const pos = this.getSpawnPosition();
      const wolf = this.scene.physics.add.image(pos.x, pos.y, 'wolf');
      wolf.setScale(0.1);
      wolf.setCollideWorldBounds(true);
      wolf.health = 3;
      wolf._sunDamageCooldown = 0;
      wolf._smokeCooldown = 0;
      this.wolves.add(wolf);
    }
  }

  getSpawnPosition() {
    let x, y;
    const margin = 300;

    do {
      x = Phaser.Math.Between(this.player.x - 1000, this.player.x + 1000);
      y = Phaser.Math.Between(this.player.y - 1000, this.player.y + 1000);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < margin);

    return { x, y };
  }

  update() {
    const speed = 40; // slower than player

    this.wolves.getChildren().forEach(wolf => {
      const dx = this.player.x - wolf.x;
      const dy = this.player.y - wolf.y;
      const angle = Math.atan2(dy, dx);

      wolf.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    });
  }
}
