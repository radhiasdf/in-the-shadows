import {lerpColor} from './lerp.js';
import { WolfManager } from './wolves.js';
import { SmokeEffect } from './vaporize.js';
import {flashRed} from './flashRed.js';
let wolfManager;

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  physics: { default: 'arcade' },
  scene: { preload, create, update }
};

const game = new Phaser.Game(config);

let player, cursors, houses = [];
let shadowGraphics;
let shadowAngle = 0; // starts dawn (long left)
let shadow_stretch = 500;
let shadowLength = 1.5; // default long shadow (in case it's night or fallback)

let daySpeed = 0.0005;
let nightCalled = false;

function preload() {
  this.load.image('player', 'snowman.webp');
  this.load.image('house', 'house.png');
  this.load.image('wolf', 'zombie.png');
}

function create() {
  this.cameras.main.setBackgroundColor('#7fb85c');

  // Player
  player = this.physics.add.image(400, 300, 'player');
  this.player = player;
  player.damaged = false;
  player.setScale(0.03).setDepth(0);
  player.body.setSize(player.width, player.height / 3)
           .setOffset(0, player.height * 2/3);

  player.health = 10;

  this.healthText = this.add.text(10, 10, 'Health: 0', { fontSize: '20px', fill: '#000' }).setScrollFactor(0);
  this.daysText = this.add.text(650, 10, 'Day: 1', { fontSize: '20px', fill: '#000' }).setScrollFactor(0).setDepth(100000000);


  this.smoke = new SmokeEffect(this);

  player._smokeCooldown = 0;
  player._sunDamageCooldown = 0;


  // Camera follow
  this.cameras.main.startFollow(player);

  // Controls
  cursors = this.input.keyboard.addKeys({
    up: 'W', down: 'S', left: 'A', right: 'D'
  });

  this.houseGroup = this.physics.add.staticGroup();
  wolfManager = new WolfManager(this, player);


  houses.length = 0;
  // Generate houses randomly
  for (let i = 0; i < 200; i++) {
    generateHouse(this);
}

  shadowGraphics = this.add.graphics();
  shadowGraphics.setDepth(-100000000000); // Behind everything

  this.shadowGraphics = shadowGraphics;
  this.shadowAngle = shadowAngle;
  this.houses = houses;
  this.cursors = cursors;
  this.dayCount = 1;


  this.physics.add.collider(this.player, this.houseGroup);

}

function generateHouse(scene){
  let x = Phaser.Math.Between(-15, 15) * 100;
    let y = Phaser.Math.Between(-15, 15) * 70;



    if ((x > 300 && x < 500) && (y > 200 && y < 400)) return; // no houses render on the players spawn point

    const house = scene.physics.add.staticImage(x, y, 'house');
    house.setScale(0.5);
    house.refreshBody(); // important for static bodies
    const colliderW = house.displayWidth * 0.7;
    const colliderH = house.displayHeight * 0.5;

    const offsetX = (house.displayWidth - colliderW) / 2;
    const offsetY = (house.displayHeight)/2;

    house.body.setSize(colliderW, colliderH).setOffset(offsetX, offsetY);

    if (Phaser.Math.Between(0, 20) == 0){
      house.shop = true;
      house.setTint(0x0000ff);
    }
    scene.houseGroup.add(house);

    const w = house.displayWidth / 2;
    const h = house.displayHeight / 2;

    // Custom polygon shape (relative to house center)
    // Example: an L-shaped house
  const polygon = [
    { x: -w * 0.8, y: -h * 0.2 },   // top-left roof slope
    { x:  0,       y: -h * 0.5 },  // roof center peak
    { x:  w * 0.8, y: -h * 0.2 },   // top-right roof slope
    { x:  w * 0.6, y: -h * 0.2 },   // lower-right wall
    { x:  w * 0.6, y:  h * 0.9 },   // bottom-right step
    { x: -w * 0.6, y:  h * 0.9 },   // bottom-left step
    { x: -w * 0.6, y: -h * 0.2 },   // lower-left wall
  ];

    houses.push({ house, polygon });
}

let clearingShadow = false;

///////////////////////// UPDATE ///////////////////////////

function update(time, delta) {

  if(this.gameOver) return;

  const speed = 200;
  const body = player.body;

  body.setVelocity(0);
  if (cursors.left.isDown) body.setVelocityX(-speed);
  else if (cursors.right.isDown) body.setVelocityX(speed);

  if (cursors.up.isDown) body.setVelocityY(-speed);
  else if (cursors.down.isDown) body.setVelocityY(speed);

  // call once in create to ensure depth sorting is allowed
  this.player.setDepth(0);

  // in update():
  const sortDepth = obj => obj.setDepth(obj.y + (obj.displayHeight || 0) / 2);

  sortDepth(this.player);
  this.houseGroup.getChildren().forEach(house => sortDepth(house));
  this.wolfManager.wolves.getChildren().forEach(sortDepth);

  // Advance time
  this.shadowAngle += daySpeed * delta;

  if (this.shadowAngle > Math.PI) {
      this.shadowAngle = -Math.PI; // Reset to start
  }

  let bgColor;

  if (this.shadowAngle > 0) {
      let t = this.shadowAngle / Math.PI; // normalize [-π, 0] → [0, 1]

      if (t < 0.10) {
          // Blue → Orange (dawn)
          let fade = t / 0.10;
          bgColor = lerpColor('#223344', '#fca311', fade);
      } else if (t < 0.20) {
          // Orange → Green (morning)
          let fade = (t - 0.10) / 0.10;
          bgColor = lerpColor('#fca311', '#7fb85c', fade);
      } else if (t < 0.80) {
          // Daylight hold (green)
          bgColor = Phaser.Display.Color.HexStringToColor('#7fb85c').color;
      } else if (t < 0.90) {
          // Green → Orange (evening)
          let fade = (t - 0.80) / 0.10;
          bgColor = lerpColor('#7fb85c', '#fca311', fade);
      } else {
          // Orange → Blue (dusk)
          let fade = (t - 0.90) / 0.10;
          bgColor = lerpColor('#fca311', '#223344', fade);
      }

      // ---- shadow length: shortest at noon (t = 0.5) ----
  // c > 1 makes the "flat" region around noon wider. Tune c (e.g., 1.2–1.5).
  const c = 1.8;
  let s = 2 * t - 1; // in [-1,1]
  let clipped = Math.min(1, Math.abs(s) / c);
  let sunElevation = Math.sqrt(Math.max(0, 1 - clipped * clipped));
      const maxShadowLength = 1.5; // long shadows early/late
      const minShadowLength = 0.2; // short at noon
      shadowLength = Phaser.Math.Linear(maxShadowLength, minShadowLength, sunElevation);
  } else {
      // Night time
      bgColor = Phaser.Display.Color.HexStringToColor('#223344').color;
      shadowLength = 1.5; // keep long/dark shadow or however you want night to behave
      this.player.setTint('0x545476');

  }



  this.cameras.main.setBackgroundColor(bgColor);

  this.currentShadowLength = shadowLength;

  if (this.shadowAngle > 0) { // Daytime only
    if (nightCalled){
      nightCalled = false;
      this.dayCount += 1;
      this.daysText.setText("Day: " + this.dayCount);
    }


    // gather all relevant entities: player + wolves
    const wolfArray = wolfManager.wolves.getChildren(); // array of wolf sprites
    const entities = [this.player, ...wolfArray];

    updateShadowsForEntities(this, entities);

    // apply effects per entity
    for (let ent of entities) {
      const isPlayer = ent === this.player;
      applySunAndSmokeEffects(this, ent, delta, isPlayer);

      if (ent.health <= 0 && !ent._isDead) {
      ent._isDead = true; // guard against double-running
      handleDeath(this, ent, isPlayer);
  }
    }

    // Player-specific UI
    if (!this.player.inShadow) {
      this.healthText.setText('In sunlight. Health: ' + this.player.health);
    } else {
      this.healthText.setText('In shadow. Health: ' + this.player.health);
    }
  } else { // NIGHT
    if (!nightCalled) {
      wolfManager.spawnWolves(10 + 10 * this.dayCount);
      nightCalled = true;
    }
    // At night, everything is considered in shadow: reset their flags and skip sun damage
    this.player.inShadow = true;
    this.player._sunDamageCooldown = 1000;
    this.healthText.setText('In shadow. Health: ' + this.player.health);
  }

  wolfManager.update();
}

function updateShadowsForEntities(scene, entities) {
  scene.shadowGraphics.clear();
  scene.shadowGraphics.fillStyle(0x223344, 1);

  const shadow_length = shadow_stretch * shadowLength;
  const shadowOffset = {
    x: Math.cos(scene.shadowAngle) * shadow_length,
    y: Math.sin(scene.shadowAngle) * shadow_length,
  };

  // Reset shadow flags
  for (let ent of entities) {
    ent.inShadow = false;
  }

  for (let obj of scene.houses) {
    const { house, polygon } = obj;

    const worldPolygon = polygon.map(p => ({
      x: house.x + p.x,
      y: house.y + p.y,
    }));
    const projectedPolygon = polygon.map(p => ({
      x: house.x + p.x + shadowOffset.x,
      y: house.y + p.y + shadowOffset.y,
    }));

    for (let i = 0; i < polygon.length; i++) {
      const next = (i + 1) % polygon.length;

      const quadPoints = [
        worldPolygon[i],
        worldPolygon[next],
        projectedPolygon[next],
        projectedPolygon[i],
      ];

      // Draw quad
      scene.shadowGraphics.beginPath();
      scene.shadowGraphics.moveTo(quadPoints[0].x, quadPoints[0].y);
      scene.shadowGraphics.lineTo(quadPoints[1].x, quadPoints[1].y);
      scene.shadowGraphics.lineTo(quadPoints[2].x, quadPoints[2].y);
      scene.shadowGraphics.lineTo(quadPoints[3].x, quadPoints[3].y);
      scene.shadowGraphics.closePath();
      scene.shadowGraphics.fillPath();

      // Prepare polygon and bounds once
      const pts = [
        quadPoints[0].x, quadPoints[0].y,
        quadPoints[1].x, quadPoints[1].y,
        quadPoints[2].x, quadPoints[2].y,
        quadPoints[3].x, quadPoints[3].y,
      ];
      const poly = new Phaser.Geom.Polygon(pts);
      //const bounds = Phaser.Geom.Polygon.GetBounds(poly);

      for (let ent of entities) {
        if (ent.inShadow) continue; // already shadowed

        const px = ent.x;
        const py = ent.y;

        //if (!Phaser.Geom.Rectangle.Contains(bounds, px, py)) continue; // fast reject

        if (Phaser.Geom.Polygon.Contains(poly, px, py)) {
          ent.inShadow = true;
        }
      }
    }
  }
}

function applySunAndSmokeEffects(scene, ent, delta, isPlayer = false) {
  // initialize cooldowns if missing
  ent._sunDamageCooldown = ent._sunDamageCooldown ?? 0;
  ent._smokeCooldown = ent._smokeCooldown ?? 0;

  if (!ent.inShadow) {
    if (ent._sunDamageCooldown <= 0) {
      ent.health -= 1;
        flashRed(ent, scene, 500);
        ent._smokeCooldown = 0; // optional for player
      ent._sunDamageCooldown = 500; // ms
    }
  } else {
    ent._sunDamageCooldown = 500; // reset while safe
  }

  // Tinting or other visual for shadow status
  if (isPlayer) {
    if (ent.inShadow) {
      if (clearingShadow) clearingShadow = false;
      scene.player.setTint('0x545476');
    } else if (!clearingShadow) {
      clearingShadow = true;
      scene.player.clearTint();
    }
  }

  // Smoke only for player (or extend to others if desired)
  if (!ent.inShadow && ent._smokeCooldown <= 0) {
    scene.smoke.emit(ent.x, ent.y - 10, {
      width: 30,
      height: 40,
      life: 600,
      scale: 1.0,
      tint: 0xFFFFFF,
      rise: 15,
    });
    ent._smokeCooldown = 300;
  }

  // Cooldown decay
  if (ent._sunDamageCooldown > 0) ent._sunDamageCooldown -= delta;
  if (ent._smokeCooldown > 0) ent._smokeCooldown -= delta;
}

function handleDeath(scene, ent, isPlayer) {
  if (isPlayer) {
    // Player death: game over logic
    scene.healthText.setText('You died.');
    // e.g., stop input, show UI, restart, etc.
    // scene.scene.restart(); // or other flow
    showYouDiedScreen(scene);
    return;
  }

  // Wolf (or other NPC) death feedback
  ent.disableBody(true, false); // removes from physics and hides; keeps object if you want to reuse
  // optional: play death animation / particles
  const deathEmitter = scene.add.particles('blood').createEmitter({
    x: ent.x,
    y: ent.y,
    lifespan: 400,
    speed: { min: 50, max: 100 },
    quantity: 10,
    scale: { start: 0.5, end: 0 },
    blendMode: 'ADD',
  });
  // kill emitter after a short time
  scene.time.delayedCall(300, () => deathEmitter.stop());

  // remove from wolf group if you want it gone entirely
  scene.wolfManager.wolves.remove(ent, true, true);
}

function showYouDiedScreen(scene) {
  scene.gameOver = true;
  // Freeze gameplay
  scene.physics.pause();
  scene.input.keyboard.enabled = false;

  // Dark overlay
  const overlay = scene.add.rectangle(
    scene.cameras.main.centerX,
    scene.cameras.main.centerY,
    scene.cameras.main.width,
    scene.cameras.main.height,
    0x000000,
    0.6
  ).setScrollFactor(0).setDepth(1000000000000);

  // "You Died" text
  const gameOverText = scene.add.text(
    scene.cameras.main.centerX,
    scene.cameras.main.centerY - 50,
    'YOU DIED',
    { fontSize: '64px', fill: '#ff5555', fontFamily: 'Arial', stroke: '#000', strokeThickness: 6 }
  ).setOrigin(0.5).setScrollFactor(0).setDepth(1000000000000000);

  // Restart button
  const restartBtn = scene.add.text(
    scene.cameras.main.centerX,
    scene.cameras.main.centerY + 50,
    'Restart',
    { fontSize: '32px', fill: '#ffffff', backgroundColor: '#222', padding: { x: 20, y: 10 } }
  )
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .setScrollFactor(0)
    .setDepth(1000000000000000)
    .on('pointerover', () => restartBtn.setStyle({ fill: '#ff0' }))
    .on('pointerout', () => restartBtn.setStyle({ fill: '#fff' }))
    .on('pointerdown', () => {
      scene.scene.restart(); // restart the current scene
      scene.gameOver = false;
      scene.input.keyboard.enabled = true;
    });
}
