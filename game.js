import {lerpColor} from './lerp.js';
import { WolfManager } from './wolves.js';
import { SmokeEffect } from './vaporize.js';
import {flashRed} from './flashRed.js';
import { updateInventoryDisplay, placeItem, getNearestItemWithin, refreshSelectionHighlight, createPlacementHint, updatePlacementHint, refreshItemKeys} from './inventory.js';
import * as plantManager from './plants.js';
import { SpatialHash } from './spatialHashShadows.js';

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

let daySpeed = 0.0003;
let nightCalled = false;

const SEED_TYPES = plantManager.PlantToSeed;

// how close to deliver to count
const DELIVERY_RADIUS = 100;
// seconds request stays active
const REQUEST_DURATION = 20;

function preload() {
  this.load.image('vampire1', 'vampire/vampire1.png');
  this.load.image('vampire2', 'vampire/vampire2.png');
  this.load.image('house', 'house.png');
  this.load.image('wolf', 'zombie.png');
  this.load.image('cactus', 'cactus.png');
  this.load.image('coleus', 'coleus.png');
  this.load.image('bloomroot', 'bloomroot.png');
  this.load.image('gem', 'gem.png');
  this.load.image('begonia', 'begonia.webp');
  this.load.image('greenseed', 'greenseed.webp'); // coleus
this.load.image('blueseed', 'blueseed.webp');     // cactus
this.load.image('pinkseed', 'pinkseed.png');   // begonia
this.load.image('yellowseed', 'yellowseed.webp'); // bloomroot

  

}

function create() {
  const scene = this;
  this.cameras.main.setBackgroundColor('#7fb85c');

  // Player
  this.anims.create({
  key: 'walk',
  frames: [
    { key: 'vampire1' },
    { key: 'vampire2' },
  ],
  frameRate: 4,
  repeat: -1
});
  player = this.physics.add.sprite(400, 300, 'vampire1');
  player.anims.play('walk');
  this.player = player;
  player.damaged = false;
  player.setScale(0.1).setDepth(0);
  player.body.setSize(player.width, player.height / 3)
           .setOffset(0, player.height * 2/3);

  // Health and damage stuff
  player.health = 1000;

  this.healthText = this.add.text(10, 10, 'Health: 0', { fontSize: '20px', fill: '#000' }).setScrollFactor(0).setDepth(100000000);
  this.daysText = this.add.text(650, 10, 'Day: 1', { fontSize: '20px', fill: '#000' }).setScrollFactor(0).setDepth(100000000);


  this.smoke = new SmokeEffect(this);

  player._smokeCooldown = 0;
  player._sunDamageCooldown = 0;


  // Camera follow
  this.cameras.main.startFollow(player);

  // Controls
  cursors = this.input.keyboard.addKeys({
    up: 'W', 
    down: 'S', 
    left: 'A', 
    right: 'D',
    q: 'Q',
    e: 'E',
    next: 'RIGHT',
    prev: 'LEFT'
  });

  // Houses and other buildings and trees and rocks
  this.houseGroup = this.physics.add.staticGroup();
  wolfManager = new WolfManager(this, player);


  houses.length = 0;
  // Generate houses randomly
  for (let i = 0; i < 100; i++) {
    let x = Phaser.Math.Between(-10, 10) * 100;
  let y = Phaser.Math.Between(-10, 10) * 65;
    generateHouse(this, x, y);
}
  for (let x = -11; x <= 11; x++){
      for (let y = -11; y <= 11; y++){
        if(x === -11 || x === 11 || y === -11 | y === 11){
                  generateHouse(this, x * 100, y * 65);
        }
      }
  }

  shadowGraphics = this.add.graphics();
  shadowGraphics.setDepth(-100000000000); // Behind everything

  this.shadowGraphics = shadowGraphics;
  this.shadowAngle = shadowAngle;
  this.houses = houses;
  this.requestInterval = 10;
  this.cursors = cursors;
  this.dayCount = 1;
  this.daySpeed = daySpeed;
  this.dayProgress = this.dayProgress || 0;


  this.physics.add.collider(this.player, this.houseGroup);

  // Inventory

  scene.inventory = {
    cactus: 2,
    bloomroot: 2,
    coleus: 2,
    begonia: 2,
    yellowseed: 2
  };
  scene.inventory.gem = scene.inventory.gem || 0; // collectible from fruiting
  scene.inventory.gem = scene.inventory.gem || 0;
scene.inventory.greenseed = scene.inventory.greenseed || 0;
scene.inventory.blueseed = scene.inventory.blueseed || 0;
scene.inventory.pinkseed = scene.inventory.pinkseed || 0;
scene.inventory.yellowseed = scene.inventory.yellowseed || 0;

  scene.plantItems = [];

scene.itemKeys = Object.keys(scene.inventory).filter(k => scene.inventory[k] > 0);
    scene.selectedIndex = 0;


  scene.placedItems = scene.physics.add.group();

  scene.invContainer = scene.add.container(10, 10);
  scene.invEntryContainers = []; // to keep references for selection highlight

  // Inventory display text
  scene.invText = scene.add.text(10, 10, '', {
    font: '20px Arial',
    fill: '#ffffff',
    stroke: '#000000',
    strokeThickness: 4
  });
  createPlacementHint(this);
  updateInventoryDisplay(scene);

  // Highlight marker (a stroked circle around the closest item)
  scene.highlight = scene.add.circle(0, 0, 22);
  scene.highlight.setStrokeStyle(3, 0xffff00);
  scene.highlight.setVisible(false);

  // Overlap detection zone (used for proximity, not physics collision)
  scene.pickupRadius = 50;

}

function generateHouse(scene, x, y){
  

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

    house.request = null; // will hold active request
    house.requestTimer = 0;
    house.requestBubble = null;
    house.requestExpired = false;

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

function startHouseRequest(scene, house) {
  // pick a random plant type to request
  const plantTypes = Object.keys(SEED_TYPES);
  const chosen = plantTypes[Phaser.Math.Between(0, plantTypes.length - 1)];
  const seedKey = SEED_TYPES[chosen];

  house.request = {
    plantType: chosen,
    seedKey,
    remaining: REQUEST_DURATION, // seconds
    fulfilled: false
  };
  house.requestExpired = false;
  house.setTint('0x00ff00')

  // create or reuse bubble container
  if (house.requestBubble) {
    house.requestBubble.destroy();
  }
  const container = scene.add.container(0, 0);
  container.setDepth(1001); // above world
  house.requestBubble = container;
  house.requestBubble.setScrollFactor(0);
  house.requestBubble.list.forEach(c => c.setScrollFactor(0));


  // bubble background
  const bubble = scene.add.rectangle(0, 0, 160, 60, 0xffffff)
    .setStrokeStyle(3, 0x000000)
    .setOrigin(0.5);
  container.add(bubble);

  // text: seed name + countdown
  const text = scene.add.text(0, -10, `${chosen} needed`, {
    fontSize: '14px',
    fill: '#000',
    align: 'center',
    fontStyle: 'bold'
  }).setOrigin(0.5);
  container.add(text);
  const timerText = scene.add.text(0, 12, `10s`, {
    fontSize: '12px',
    fill: '#333'
  }).setOrigin(0.5);
  container.add(timerText);

  // attach helper refs
  house.requestBubble.text = text;
  house.requestBubble.timerText = timerText;
  house.requestBubble.bubble = bubble;
}

function maybeSpawnHouseRequests(scene, delta) {
  scene._requestAccumulator = scene._requestAccumulator || 0;
  scene._requestAccumulator += delta / 1000;
  if (scene._requestAccumulator >= scene.requestInterval) {
    scene._requestAccumulator = 0;
    // pick a random house that currently has no active request or expired
    const candidates = scene.houses
      .map(o => o.house)
      .filter(h => !h.request || h.requestExpired || h.request.fulfilled);
    if (candidates.length === 0) return;
    const pick = Phaser.Utils.Array.GetRandom(candidates);
    startHouseRequest(scene, pick);
  }
}

function updateHouseRequests(scene, delta) {
  const cam = scene.cameras.main;
  const camView = new Phaser.Geom.Rectangle(
    cam.worldView.x,
    cam.worldView.y,
    cam.worldView.width,
    cam.worldView.height
  );

  for (const obj of scene.houses) {
    const house = obj.house;
    if (!house.request || house.request.fulfilled) continue;
    if (house.requestExpired) continue;

    // decrement timer
    house.request.remaining -= delta / 1000;
    if (house.request.remaining <= 0) {
      house.requestExpired = true;
      // fade out bubble
      if (house.requestBubble) {
        scene.tweens.add({
          targets: house.requestBubble,
          alpha: 0,
          duration: 400,
          onComplete: () => {
            if(house.requestBubble.arrow) house.requestBubble.arrow.destroy();
            house.requestBubble.destroy();
            house.requestBubble = null;
          }
        });
      }
      continue;
    }

    // update timer text
    if (house.requestBubble) {
      const secs = Math.ceil(house.request.remaining);
      house.requestBubble.timerText.setText(`${secs}s`);
    }

    // position bubble: if on-screen, above house; else clamp to edge with arrow
    const worldX = house.x;
    const worldY = house.y - house.displayHeight / 2 - 10;

    if (Phaser.Geom.Rectangle.ContainsPoint(camView, { x: house.x, y: house.y })) {
      // on screen: position above
      if (house.requestBubble) house.requestBubble.setPosition(worldX, worldY);
      // remove arrow if any
      if (house.requestBubble.arrow) {
        house.requestBubble.arrow.destroy();
        house.requestBubble.arrow = null;
      }
    } else if (house.requestBubble)  {
      // offscreen: clamp bubble to screen edge with direction arrow
      // compute direction from center of camera to house
      const centerX = cam.worldView.centerX;
      const centerY = cam.worldView.centerY;
      const dirX = house.x - centerX;
      const dirY = house.y - centerY;
      const angle = Math.atan2(dirY, dirX);

      // place bubble along screen edge in that direction
      const margin = 10;
      const edgeX = centerX + Math.cos(angle) * (cam.width / 2 - margin);
      const edgeY = centerY + Math.sin(angle) * (cam.height / 2 - margin);
      house.requestBubble.setPosition(edgeX + cam.worldView.x - cam.worldView.x, edgeY + cam.worldView.y - cam.worldView.y); // since scrollFactor=0 below

      // draw/update arrow pointing toward house
      if (!house.requestBubble.arrow) {
        const arrow = scene.add.triangle(0, 0, 0, 10, 20, 0, 0, -10, 0x000000)
          .setOrigin(0.5)
          .setDepth(10002);
        arrow.setScrollFactor(0);
        house.requestBubble.arrow = arrow;
      }
      // position arrow next to bubble and rotate toward house
      house.requestBubble.arrow.setPosition(house.requestBubble.x, house.requestBubble.y);
      house.requestBubble.arrow.setRotation(angle);
    }

    // ensure UI is fixed
    if (house.requestBubble) {
      house.requestBubble.setScrollFactor(1);
      house.requestBubble.list?.forEach(child => {
        if (child.setScrollFactor) child.setScrollFactor(1);
      });
    }
    if (house.requestBubble.arrow) {
      house.requestBubble.arrow.setScrollFactor(1);
    }
  }
}

function checkHouseSeedDelivery(scene) {
  for (const obj of scene.houses) {
    const house = obj.house;
    if (!house.request || house.request.fulfilled || house.requestExpired) continue;
    const neededSeed = SEED_TYPES[house.request.plantType];
    // find nearest placed seed of that type within radius
    scene.placedItems.getChildren().forEach(item => {
      if (item.itemType !== neededSeed) return;
      const dx = item.x - house.x;
      const dy = item.y - house.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= DELIVERY_RADIUS) {
        // successful delivery
        house.request.fulfilled = true;
        // reward: e.g., 3 gems
        scene.inventory.gem = (scene.inventory.gem || 0) + 3;
        refreshItemKeys(scene);
        updateInventoryDisplay(scene);
        // visual feedback
        const pop = scene.add.text(house.x, house.y - 30, '+3💎', {
          fontSize: '20px', fill: '#ffff66', stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(1500);
        scene.tweens.add({
          targets: pop,
          y: pop.y - 20,
          alpha: 0,
          duration: 1000,
          onComplete: () => pop.destroy()
        });

        // cleanup request bubble
        if (house.requestBubble){
          if(house.requestBubble.arrow) house.requestBubble.arrow.destroy();
          house.requestBubble.destroy();
        } 
        // consume seed
        item.destroy();
      }
    });
  }
}



let clearingShadow = false;

///////////////////////// UPDATE ///////////////////////////

function update(time, delta) {
  const scene = this;

  if(this.gameOver) return; /////// ANYTHING AFTER IS IN GAME LOOP

  const speed = 200;
  const body = player.body;
  let moving = false;

  if (cursors.left.isDown) {
    player.setVelocityX(-speed);
    moving = true;
    player.flipX = false; // face left if needed
  } else if (cursors.right.isDown) {
    player.setVelocityX(speed);
    moving = true;
    player.flipX = true;
  } else {
    player.setVelocityX(0);
  }

  if (cursors.up.isDown) {
    player.setVelocityY(-speed);
    moving = true;
  } else if (cursors.down.isDown) {
    player.setVelocityY(speed);
    moving = true;
  } else {
    player.setVelocityY(0);
  }

  if (moving) {
    if (!player.anims.isPlaying || player.anims.getName() !== 'walk') {
      player.anims.play('walk', true);
    }
  } else {
    player.anims.stop();
    player.setTexture('vampire1'); // idle frame
  }

  // call once in create to ensure depth sorting is allowed
  this.player.setDepth(0);

  // in update():
  const sortDepth = obj => obj.setDepth(obj.y + (obj.displayHeight || 0) / 2);

  sortDepth(this.player);
  this.houseGroup.getChildren().forEach(house => sortDepth(house));
  this.wolfManager.wolves.getChildren().forEach(sortDepth);
  this.placedItems.getChildren().forEach(sortDepth);

  // Advance time
  this.shadowAngle += daySpeed * delta;

  if (this.shadowAngle > Math.PI) {
      this.shadowAngle = -Math.PI; // Reset to start
  }
  
  const dayDelta = (daySpeed * delta) / Math.PI;
  scene.dayProgress = this.shadowAngle / Math.PI; // night from -1 to 0, day from 0 to 1.

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
    const plantSprites = scene.plantItems.map(p => p.sprite);

    const entities = [this.player, ...wolfArray, ...plantSprites];

    // In scene
    if (!scene.entityHash) scene.entityHash = new SpatialHash(64);
    scene.entityHash.clear();
    for (let ent of entities) {
      scene.entityHash.insert(ent);
    }

    if (this.dayProgress > 0){
          updateShadowsForEntities(this, entities);
    }

  // Here you would set plant.inShadow from your shadow logic
  plantManager.updatePlants(delta / 1000, this.dayProgress); // dt in seconds
  updatePlantItemsWithShadows(scene, dayDelta);

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
      //wolfManager.spawnWolves(10 + 10 * this.dayCount);
      nightCalled = true;
    }
    // At night, everything is considered in shadow: reset their flags and skip sun damage
    this.player.inShadow = true;
    this.player._sunDamageCooldown = 1000;
    this.healthText.setText('In shadow. Health: ' + this.player.health);
  }

    maybeSpawnHouseRequests(this, delta);
    updateHouseRequests(this, delta);

  wolfManager.update();

  ///////// ITEMS DROP AND PICKUP ///////////////////////////

if (Phaser.Input.Keyboard.JustDown(scene.cursors.next)) {
  refreshItemKeys(scene);
  if (scene.itemKeys.length === 0) return;
  scene.selectedIndex = (scene.selectedIndex + 1) % scene.itemKeys.length;
  refreshSelectionHighlight(scene);
  updatePlacementHint(scene);
}
if (Phaser.Input.Keyboard.JustDown(scene.cursors.prev)) {
  refreshItemKeys(scene);
  if (scene.itemKeys.length === 0) return;
  scene.selectedIndex =
    (scene.selectedIndex - 1 + scene.itemKeys.length) % scene.itemKeys.length;
  refreshSelectionHighlight(scene);
  updatePlacementHint(scene);
}


  // Highlight nearest within pickupRadius
  const nearest = getNearestItemWithin(scene, scene.pickupRadius);
  if (nearest) {
    scene.highlight.setPosition(nearest.x, nearest.y);
    scene.highlight.setVisible(true);
  } else {
    scene.highlight.setVisible(false);
  }

  //////////////////// SHOP PROXIMITY //////////////////

  // Find nearest shop (simple distance check)
  let nearestShop = null;
  let shopDist = Infinity;
  scene.houseGroup.getChildren().forEach(house => {
    if (house.shop) {
      const dx = house.x - scene.player.x;
      const dy = house.y - scene.player.y;
      const d = Math.hypot(dx, dy);
      if (d < 100 && d < shopDist) {
        shopDist = d;
        nearestShop = house;
      }
    }
  });

  // Highlight shop and show prompt if in range
  if (nearestShop) {
    // yellow border: simple graphics overlay
    if (!scene.shopHighlight) {
      scene.shopHighlight = scene.add.rectangle(0, 0, nearestShop.displayWidth + 10, nearestShop.displayHeight + 10)
        .setStrokeStyle(3, 0xffff00)
        .setOrigin(0.5)
        .setDepth(1000);
    }
    scene.shopHighlight.setPosition(nearestShop.x, nearestShop.y);
    scene.shopHighlight.setVisible(true);

    if (!scene.shopPrompt) {
      scene.shopPrompt = scene.add.text(nearestShop.x, nearestShop.y - nearestShop.displayHeight / 2 - 20, 'E', {
        fontSize: '28px', fill: '#ffff00', fontStyle: 'bold', stroke: '#000', strokeThickness: 4
      }).setOrigin(0.5).setDepth(1000);
    } else {
      scene.shopPrompt.setPosition(nearestShop.x, nearestShop.y - nearestShop.displayHeight / 2 - 20);
      scene.shopPrompt.setVisible(true);
    }
  } else {
    if (scene.shopHighlight) scene.shopHighlight.setVisible(false);
    if (scene.shopPrompt) scene.shopPrompt.setVisible(false);
  }

  ///////////////////// CHECK E AFTER HIGHLIGHT

  // Pick up or place with E
  if (Phaser.Input.Keyboard.JustDown(scene.cursors.e)) {
    if (nearestShop && !scene.upgradeMenuOpen){
      plantManager.openUpgradeMenu(scene, nearestShop);
    }
    else if (nearest) { // PICK UP PLANT

      // Safely get its type and increment inventory
      const type = nearest.itemType;
      if (type && scene.inventory.hasOwnProperty(type)) {
        scene.inventory[type] += 1;
      } else {
        // fallback in case something weird happened
        console.warn('Picked up item with unknown type:', type);
      }

      // If it's a plant, find and clean up its labels/state
      const plantEntry = scene.plantItems.find(p => p.sprite === nearest);
      if (plantEntry) {
        cleanupPlantEntry(scene, plantEntry);
      }

      nearest.destroy();
      refreshItemKeys(scene);
      updateInventoryDisplay(scene);
      scene.highlight.setVisible(false);
    } else { // PLACE DOWN PLANT
      const key = scene.itemKeys[scene.selectedIndex];

      if (scene.inventory[key] > 0) {
        placeItem(scene, key, scene.player.x, scene.player.y);
        scene.inventory[key] -= 1;
        refreshItemKeys(scene);
        updateInventoryDisplay(scene);

        // If it's a plant type, hook up its logic with labels
        if (plantManager.PlantRules[key]) {
          const placed = scene.placedItems.getChildren().slice(-1)[0];
          const plantData = plantManager.makePlant(key, placed.x, placed.y);

          // Create floating text(s) above the plant
          // We'll store label objects inside data for updates.
          if (key === 'begonia') {
            plantData.labelMorning = scene.add.text(placed.x, placed.y - 30, 'M:0', {
              fontSize: '12px', fill: '#ffffaa', stroke: '#000', strokeThickness: 3
            }).setOrigin(0.5);
            plantData.labelEvening = scene.add.text(placed.x, placed.y - 18, 'E:0', {
              fontSize: '12px', fill: '#aaaaff', stroke: '#000', strokeThickness: 3
            }).setOrigin(0.5);
          } else if (key === 'bloomroot') {
            plantData.labelShade = scene.add.text(placed.x, placed.y - 24, 'Shade:0', {
              fontSize: '12px', fill: '#88ddff', stroke: '#000', strokeThickness: 3
            }).setOrigin(0.5);
          } else {
            // cactus or coleus: show accumulated sun
            plantData.labelSun = scene.add.text(placed.x, placed.y - 24, 'Sun:0', {
              fontSize: '12px', fill: '#ffee88', stroke: '#000', strokeThickness: 3
            }).setOrigin(0.5);
          }

          scene.plantItems.push({ sprite: placed, data: plantData });

          spriteDepthSyncLabels(placed, plantData); // helper below

        }

        checkHouseSeedDelivery(this);
      }

    }
  }

// Auto-collect autoCollect items (gems, seeds, etc.) within small radius
scene.placedItems.getChildren().forEach(item => {
  if (!item.autoCollect) return;
  const dx = item.x - scene.player.x;
  const dy = item.y - scene.player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 30) {
  const type = item.itemType;
  if (type) {
    scene.inventory[type] = (scene.inventory[type] || 0) + 1;
    refreshItemKeys(scene);
    updateInventoryDisplay(scene);
  }
  item.destroy();
}
});

}

function cleanupPlantEntry(scene, entry) {
  const { sprite, data } = entry;
  // destroy labels if they exist
  if (data.labelSun) data.labelSun.destroy();
  if (data.labelShade) data.labelShade.destroy();
  if (data.labelMorning) data.labelMorning.destroy();
  if (data.labelEvening) data.labelEvening.destroy();
  // remove from plantItems array
  scene.plantItems = scene.plantItems.filter(p => p !== entry);
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

      // Prepare polygon
      const pts = [
        quadPoints[0].x, quadPoints[0].y,
        quadPoints[1].x, quadPoints[1].y,
        quadPoints[2].x, quadPoints[2].y,
        quadPoints[3].x, quadPoints[3].y,
      ];
      const poly = new Phaser.Geom.Polygon(pts);

      // Get bounding box of quad
      const minX = Math.min(...quadPoints.map(p => p.x));
      const minY = Math.min(...quadPoints.map(p => p.y));
      const maxX = Math.max(...quadPoints.map(p => p.x));
      const maxY = Math.max(...quadPoints.map(p => p.y));

      // Query only entities in this bounding rect
      const candidates = scene.entityHash.queryAreaRect(minX, minY, maxX, maxY);

      for (let ent of candidates) {
        if (ent.inShadow) continue; // already shadowed
        if (Phaser.Geom.Polygon.Contains(poly, ent.x, ent.y)) {
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

  // if (!ent.inShadow) {
  //   if (ent._sunDamageCooldown <= 0) {
  //     ent.health -= 1;
  //       flashRed(ent, scene, 500);
  //       ent._smokeCooldown = 0; // optional for player
  //     ent._sunDamageCooldown = 500; // ms
  //   }
  // } else {
  //   ent._sunDamageCooldown = 500; // reset while safe
  // }

  // Tinting or other visual for shadow status

    if (ent.inShadow) {
      if (ent.clearingShadow){
        ent.clearingShadow = false;
        ent.setTint('0x545476');
      }
    } else if (!ent.clearingShadow) {
      ent.clearingShadow = true;
      ent.clearTint();
    }

  // Smoke only for player (or extend to others if desired)
  if (ent.itemType === 'bloomroot' && !ent.inShadow && ent._smokeCooldown <= 0) {
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

function updatePlantItemsWithShadows(scene, dayDelta) {


  // // Cleanup any dead plant items (optional)
  scene.plantItems = scene.plantItems.filter(p => p.sprite.active);

  // Process each plant: sync shadow, update labels, detect fruiting
  for (let entry of scene.plantItems) {
    const { sprite, data } = entry;
    data.inShadow = !!sprite.inShadow;

    const rule = plantManager.PlantRules[data.type];
    if (!rule) continue;

    // Before calling update, capture pre-state to detect fruiting
    const prev = {
      accumulatedSun: data.state.accumulatedSun,
      shadeAccumulated: data.state.shadeAccumulated,
      morningSun: data.state.morningSun,
      eveningShade: data.state.eveningShade
    };

    // Update floating labels position & text
    spriteDepthSyncLabels(sprite, data); // helper below

    let gemCount = rule.update(data.state, data.inShadow, dayDelta, scene.dayProgress);

    if (gemCount > 0) {
      // apply upgrade multiplier if any
      const upgradeState = plantManager.PlantUpgrades?.[data.type] || {};
      const multiplier = upgradeState.gemMultiplier ?? 1;
      const total = Math.max(1, Math.round(gemCount * multiplier));
      for (let i = 0; i < total; i++) {
          plantManager.spawnSeedAtPlant(scene, sprite.x, sprite.y, data.type);
      }
    }
  }
}

function spriteDepthSyncLabels(sprite, data) {
  // compute same base depth as you do elsewhere
  const baseDepth = sprite.y + (sprite.displayHeight || 0) / 2;
  sprite.setDepth(baseDepth);

  // Move & update labels
  if (data.labelSun) {
    data.labelSun.setPosition(sprite.x, sprite.y - 24);
    data.labelSun.setText('Sun:' + data.state.accumulatedSun.toFixed(1));
    data.labelSun.setDepth(baseDepth + 1); // ensure above the plant/house
  }
  if (data.labelShade) {
    data.labelShade.setPosition(sprite.x, sprite.y - 24);
    data.labelShade.setText('Shade:' + data.state.shadeAccumulated.toFixed(1));
    data.labelShade.setDepth(baseDepth + 1);
  }
  if (data.labelMorning) {
    data.labelMorning.setPosition(sprite.x, sprite.y - 30);
    data.labelMorning.setText('M:' + data.state.morningSun.toFixed(1));
    data.labelMorning.setDepth(baseDepth + 1);
  }
  if (data.labelEvening) {
    data.labelEvening.setPosition(sprite.x, sprite.y - 18);
    data.labelEvening.setText('E:' + data.state.eveningShade.toFixed(1));
    data.labelEvening.setDepth(baseDepth + 1);
  }
}

function spawnGemAtPlant(scene, x, y) {
  // Avoid spawning duplicates if one already exists very close? (optional)
  const gem = scene.add.image(x + Phaser.Math.Between(-30, 30), y + Phaser.Math.Between(10, 40), 'gem');
  gem.setOrigin(0.5);
  gem.setDisplaySize(18, 18);
  scene.physics.add.existing(gem);
  gem.itemType = 'gem';
  gem.autoCollect = true;
  gem.setDepth(0);
  scene.placedItems.add(gem);

  // Optional: small pop animation
  scene.tweens.add({
    targets: gem,
    y: gem.y - 8,
    duration: 300,
    yoyo: true,
    ease: 'Sine.easeOut'
  });
}
