// Minimal plant configs — only rules
import { updateInventoryDisplay } from "./inventory.js";

export const PlantRules = {
  cactus: {
    threshold: 0.9,// needs lots of sun
    baseFruit: 1,
    update(state, inShadow, dt, dayProgress) {
        if (dayProgress < 0){
            state.accumulatedSun = 0;
            return this.baseFruit;
        }
      if (inShadow) {
        return 0;
      }
      state.accumulatedSun += dt;
      if (state.accumulatedSun >= this.threshold) {
        console.log('Cactus fruited!');
        state.accumulatedSun = 0;
        return this.baseFruit;
      }
      return 0;
    }
  },
  bloomroot: {
    thresholdShade: 0.9, // wants shade
    baseFruit: 1,
    update(state, inShadow, dt, dayProgress) {
      if (!inShadow) {
        state.shadeAccumulated = 0;
        return 0;
      }
      state.shadeAccumulated += dt;
      if (state.shadeAccumulated >= this.thresholdShade) {
        console.log('Bloomroot fruited!');
        state.shadeAccumulated = 0;
        return this.baseFruit;
      }
      return 0;
    }
  },
 fern: {
  baseFruit: 3,
  update(state, inShadow, dt, dayProgress) {
    if (state._wasDay === undefined) state._wasDay = true;
    const isDay = dayProgress > 0;

    // Accumulate only during day
    if (!inShadow && isDay) {
      state.accumulatedSun = (state.accumulatedSun || 0) + dt;
    }

    // Detect transition day -> night
    const justEnteredNight = state._wasDay && !isDay;

    // DEBUG: dump values around transition
    if (justEnteredNight || Math.abs(dayProgress) < 0.05 || Math.abs(dayProgress - 1) < 0.05) {
      console.log({
        tag: 'fern-debug',
        dayProgress: dayProgress.toFixed(3),
        isDay,
        wasDay: state._wasDay,
        accumulatedSun: (state.accumulatedSun || 0).toFixed(3),
        justEnteredNight,
      });
    }

    let fruit = 0;
    if (justEnteredNight) {
      if ((state.accumulatedSun || 0) > 0 && (state.accumulatedSun || 0) <= 0.5) {
        console.log('fern fruited at beginning of night (partial sun)! accumulatedSun=', state.accumulatedSun);  
        fruit = this.baseFruit;
      }
      state.accumulatedSun = 0;
    }

    state._wasDay = isDay;
    return fruit;
  }
},

  begonia: {
    baseFruit: 3,
    morningThreshold: 0.3,
    eveningThreshold: 0.3,
    update(state, inShadow, dt, dayProgress) {
      if (dayProgress < 0.5) {
        // morning phase: needs sun, reset if in shadow
        if (!inShadow) {
          state.morningSun += dt;
        }
      } else {
        // evening phase: needs shade, reset if in sunlight
        if (inShadow) {
          state.eveningShade += dt;
        }
      }

      if (state.morningSun >= this.morningThreshold &&
          state.eveningShade >= this.eveningThreshold) {
        console.log('Begonia fruited!');
        state.morningSun = 0;
        state.eveningShade = 0;
        return this.baseFruit;
      }
      return 0;
    }
  }
};



// runtime upgrade state per plant
const PlantUpgrades = {
  cactus: { sunEfficiency: 1.0, gemMultiplier: 1.0 },
  bloomroot: { shadeEfficiency: 1.0, gemMultiplier: 1.0 },
  fern: { sunEfficiency: 1.0, gemMultiplier: 1.0 },
  begonia: { morningBonus: 1.0, eveningBonus: 1.0, gemMultiplier: 1.0 },
};

// central upgrade catalog
const UpgradeCatalog = {
  // PLANT PURCHASES (cheap, adds the plant to inventory)
  buy_cactus: {
    name: 'Buy Cactus',
    appliesTo: [], // no mutation of upgrade state
    cost: { gem: 2 },
    description: 'Needs full sun to fruit (accumulates over whole day). Adds one cactus to your inventory.',
    apply: (upgradeState, scene) => {
      scene.inventory.cactus = (scene.inventory.cactus || 0) + 1;
      scene.itemKeys = Object.keys(scene.inventory);
      updateInventoryDisplay(scene);
    },
    isPlantPurchase: true,
    plantType: 'cactus',
  },
  buy_bloomroot: {
    name: 'Buy Bloomroot',
    appliesTo: [],
    cost: { gem: 2 },
    description: 'Wants shade most of the day to fruit. Adds one bloomroot to your inventory.',
    apply: (upgradeState, scene) => {
      scene.inventory.bloomroot = (scene.inventory.bloomroot || 0) + 1;
      scene.itemKeys = Object.keys(scene.inventory);
      updateInventoryDisplay(scene);
    },
    isPlantPurchase: true,
    plantType: 'bloomroot',
  },
  buy_fern: {
    name: 'Buy fern',
    appliesTo: [],
    cost: { gem: 2 },
    description: 'Needs moderate sun (less than cactus) to fruit. Adds one fern to your inventory.',
    apply: (upgradeState, scene) => {
      scene.inventory.fern = (scene.inventory.fern || 0) + 1;
      scene.itemKeys = Object.keys(scene.inventory);
      updateInventoryDisplay(scene);
    },
    isPlantPurchase: true,
    plantType: 'fern',
  },
  buy_begonia: {
    name: 'Buy Begonia',
    appliesTo: [],
    cost: { gem: 2 },
    description: 'Needs morning sun and evening shade to fruit. Adds one begonia to your inventory.',
    apply: (upgradeState, scene) => {
      scene.inventory.begonia = (scene.inventory.begonia || 0) + 1;
      scene.itemKeys = Object.keys(scene.inventory);
      updateInventoryDisplay(scene);
    },
    isPlantPurchase: true,
    plantType: 'begonia',
  },

  // BOOSTS / UPGRADES (more expensive now)
  cactus_sun_efficiency: {
    name: 'Cactus Sun Efficiency',
    appliesTo: ['cactus'],
    cost: { gem: 6 },
    description: 'Cactus accumulates sun faster when exposed (needs full sun normally).',
    apply: upgradeState => {
      upgradeState.sunEfficiency += 0.2; // bigger bump
    }
  },
  cactus_gem_multiplier: {
    name: 'Cactus Gem Yield',
    appliesTo: ['cactus'],
    cost: { gem: 5 },
    description: 'Cactus gives more gems when it fruits.',
    apply: upgradeState => {
      upgradeState.gemMultiplier += 0.5;
    }
  },
  bloomroot_shade_efficiency: {
    name: 'Bloomroot Shade Efficiency',
    appliesTo: ['bloomroot'],
    cost: { gem: 5 },
    description: 'Bloomroot accumulates shade faster (wants shade to fruit).',
    apply: upgradeState => {
      upgradeState.shadeEfficiency += 0.2;
    }
  },
  bloomroot_gem_multiplier: {
    name: 'Bloomroot Gem Yield',
    appliesTo: ['bloomroot'],
    cost: { gem: 4 },
    description: 'Bloomroot gives more gems when it fruits.',
    apply: upgradeState => {
      upgradeState.gemMultiplier += 0.4;
    }
  },
  fern_sun_efficiency: {
    name: 'fern Sun Efficiency',
    appliesTo: ['fern'],
    cost: { gem: 6 },
    description: 'fern accumulates sun faster (needs moderate sun).',
    apply: upgradeState => {
      upgradeState.sunEfficiency += 0.2;
    }
  },
  fern_gem_multiplier: {
    name: 'fern Gem Yield',
    appliesTo: ['fern'],
    cost: { gem: 5 },
    description: 'fern gives more gems when it fruits.',
    apply: upgradeState => {
      upgradeState.gemMultiplier += 0.5;
    }
  },
  begonia_dual_bonus: {
    name: 'Begonia Morning/Evening Boost',
    appliesTo: ['begonia'],
    cost: { gem: 8 },
    description: 'Improves both morning sun and evening shade accumulation for Begonia.',
    apply: upgradeState => {
      upgradeState.morningBonus += 0.15;
      upgradeState.eveningBonus += 0.15;
    }
  },
  begonia_gem_multiplier: {
    name: 'Begonia Gem Yield',
    appliesTo: ['begonia'],
    cost: { gem: 6 },
    description: 'Begonia gives more gems when it fruits.',
    apply: upgradeState => {
      upgradeState.gemMultiplier += 0.5;
    }
  },
};



// Plant factory
export function makePlant(type, x, y) {
  return {
    type,
    x, y,
    state: {
      accumulatedSun: 0,
      shadeAccumulated: 0,
      morningSun: 0,
      eveningShade: 0
    },
    inShadow: false
  };
}

// Example: plants array
const plants = [
];

// Main update
export function updatePlants(dt, dayProgress) {
  for (let plant of plants) {
    const rule = PlantRules[plant.type];
    rule.update(plant.state, plant.inShadow, dt, dayProgress);
  }
}

function makeFixed(ui) {
  if (!ui) return;
  ui.setScrollFactor(0);
  // Containers store children in `list`
  if (ui.list && Array.isArray(ui.list)) {
    ui.list.forEach(child => makeFixed(child));
  }
}

export function pickRandomUpgradesForShop() {
  const allKeys = Object.keys(UpgradeCatalog);
  // simple reservoir/sample without repeats
  const shuffled = allKeys.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3).map(k => ({ key: k, def: UpgradeCatalog[k] }));
}

export function openUpgradeMenu(scene, shop) {
  scene.upgradeMenuOpen = true;
  scene.physics.pause();
  scene.input.keyboard.enabled = false;

  scene.currentShopOffers = pickRandomUpgradesForShop();

  // Dark backdrop
  const cam = scene.cameras.main;
const centerX = cam.width / 2;
const centerY = cam.height / 2;

// Dark backdrop
scene.menuOverlay = scene.add.rectangle(
  centerX,
  centerY,
  cam.width,
  cam.height,
  0x000000,
  0.6
)
.setOrigin(0.5)
.setDepth(200000000)
.setScrollFactor(0)
.disableInteractive();

// Container for menu
scene.menuContainer = scene.add.container(centerX, centerY)
  .setDepth(2000000001)
  .setScrollFactor(0);

  const cardWidth = 180;
  const cardHeight = 250;
  const spacing = 200;
  const startX = -spacing; // so cards are centered around the menu

  scene.currentShopOffers.forEach((offer, idx) => {
  const { def } = offer;
  const xPos = startX + idx * spacing;

  // Card background
  const cardBg = scene.add.rectangle(xPos, 0, cardWidth, cardHeight, 0xF5DEB3, 1)
    .setStrokeStyle(3, 0x8B7355)
    .setOrigin(0.5);
  scene.menuContainer.add(cardBg);

  // Determine which plant sprite to show
  let plantType = null;
  if (def.isPlantPurchase && def.plantType) {
    plantType = def.plantType;
  } else if (Array.isArray(def.appliesTo) && def.appliesTo.length > 0) {
    plantType = def.appliesTo[0];
  }

  if (plantType) {
    const plantSprite = scene.add.image(xPos, -cardHeight / 2 + 50, plantType)
      .setOrigin(0.5)
      .setDisplaySize(64, 64);
    scene.menuContainer.add(plantSprite);
  }

  // Description (middle)
  const desc = scene.add.text(xPos, 0, def.description, {
    fontSize: '14px',
    fill: '#000',
    wordWrap: { width: cardWidth - 20, useAdvancedWrap: true },
    align: 'center'
  }).setOrigin(0.5);
  scene.menuContainer.add(desc);

  // Buy button (bottom)
  const costStr = Object.entries(def.cost).map(([c, v]) => `${v}💎`).join(', ');
  const buyBtn = scene.add.text(xPos, cardHeight / 2 - 25, `Buy (${costStr})`, {
    fontSize: '16px',
    fill: '#fff',
    backgroundColor: '#444',
    padding: { x: 10, y: 5 }
  })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });

  buyBtn.on('pointerover', () => buyBtn.setStyle({ backgroundColor: '#666' }));
  buyBtn.on('pointerout', () => buyBtn.setStyle({ backgroundColor: '#444' }));
  buyBtn.on('pointerdown', () => {
    if (attemptCatalogUpgrade(scene, offer)) {
      performPurchaseAnimation(scene, offer, cardBg, buyBtn);
    }
  });

  scene.menuContainer.add(buyBtn);
});


  // Close button in top-right corner
  const closeBtn = scene.add.text(cardWidth + 60, -cardHeight / 2 - 40, '✕', {
    fontSize: '28px',
    fill: '#ff4444'
  })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', () => closeUpgradeMenu(scene));
  scene.menuContainer.add(closeBtn);

  makeFixed(scene.menuOverlay);
    makeFixed(scene.menuContainer);
}

function attemptCatalogUpgrade(scene, offer) {
  const { key, def } = offer;
  const gemCost = def.cost.gem || 0;

  if ((scene.inventory.gem || 0) < gemCost) {
    // insufficient feedback
    const warn = scene.add
      .text(scene.cameras.main.centerX, scene.cameras.main.centerY + 160, 'Not enough gems', {
        fontSize: '40px',
        fill: '#ff4444',
        stroke: '#000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(220000000)
      .setScrollFactor(0);
    scene.time.delayedCall(1000, () => warn.destroy());
    return false;
  }

  // pay
  scene.inventory.gem -= cost;
    refreshItemKeys(scene);
    updateInventoryDisplay(scene);


  if (def.isPlantPurchase) {
    // plant purchase uses its own apply with scene context
    def.apply(null, scene);
  } else {
    // regular upgrade: mutate upgrade state(s)
    def.appliesTo.forEach(plantType => {
      const state = PlantUpgrades[plantType];
      if (state) def.apply(state);
    });
  }

  return true;
}


function closeUpgradeMenu(scene) {
  if (!scene.upgradeMenuOpen) return;
  scene.upgradeMenuOpen = false;
  // destroy UI
  scene.menuContainer.destroy();
  scene.menuOverlay.destroy();
  // restore input and physics
  scene.physics.resume();
  scene.input.keyboard.enabled = true;
}

function performPurchaseAnimation(scene, offer, cardBg, buyBtn) {
  // pop the card: scale up briefly then back
  scene.tweens.add({
    targets: cardBg,
    scale: 1.05,
    duration: 120,
    yoyo: true,
    ease: 'Cubic.easeOut',
  });

  scene.tweens.add({
    targets: glow,
    alpha: 0,
    duration: 500,
    onComplete: () => glow.destroy(),
  });

  // gem flying into inventory
  // create a temporary gem sprite near the buy button
  const startWorld = buyBtn.getWorldTransformMatrix
    ? buyBtn.getWorldTransformMatrix().getDecomposedMatrix()
    : { translateX: buyBtn.x, translateY: buyBtn.y };
  const gemIcon = scene.add.image(buyBtn.x, buyBtn.y, 'gem').setDisplaySize(20, 20).setDepth(2000000000).setScrollFactor(0);

  // target position: find inventory gem count display position (approximate)
  // assuming your inventory UI is at (10,10) container; adjust if different
  const targetX = 60; // tweak so gem flies into the gem slot
  const targetY = 30;

  scene.tweens.add({
    targets: gemIcon,
    x: targetX,
    y: targetY,
    scale: 0.5,
    duration: 600,
    ease: 'Cubic.easeIn',
    onComplete: () => {
      // small pulse on inventory to reinforce
      const pulse = scene.tweens.add({
        targets: gemIcon,
        scale: 1.0,
        duration: 150,
        yoyo: true,
      });
      scene.time.delayedCall(200, () => gemIcon.destroy());
    },
  });
}

export const PlantToSeed = {
  cactus: 'yellowseed',
  fern: 'greenseed',
  begonia: 'pinkseed',
  bloomroot: 'blueseed'
};

export function spawnSeedAtPlant(scene, x, y, plantType) {
  const seedKey = PlantToSeed[plantType];
  if (!seedKey) return;

  const seed = scene.add.image(
    x + Phaser.Math.Between(-30, 30),
    y + Phaser.Math.Between(10, 40),
    seedKey
  );
  seed.setOrigin(0.5);
  seed.setDisplaySize(18, 18);
  scene.physics.add.existing(seed);
  seed.itemType = seedKey; // so pickup logic recognizes
  seed.autoCollect = true;
  scene.placedItems.add(seed);
  seed.setDepth(0);
  
  // small pop animation
  scene.tweens.add({
    targets: seed,
    y: seed.y - 8,
    duration: 300,
    yoyo: true,
    ease: 'Sine.easeOut'
  });
}