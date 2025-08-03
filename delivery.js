const SEED_TYPES = {
  cactus: 'redseeds',
  coleus: 'greenseeds',
  begonia: 'pinkseeds',
  bloomroot: 'yellowseeds'
};

// how close to deliver to count
const DELIVERY_RADIUS = 50;
// seconds request stays active
const REQUEST_DURATION = 10;

house.request = null; // will hold active request
house.requestTimer = 0;
house.requestBubble = null;
house.requestExpired = false;

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

  // create or reuse bubble container
  if (house.requestBubble) {
    house.requestBubble.destroy();
  }
  const container = scene.add.container(0, 0);
  container.setDepth(1001); // above world
  house.requestBubble = container;

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
  if (scene._requestAccumulator >= 5) {
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
