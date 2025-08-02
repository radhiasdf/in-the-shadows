// Renders the full inventory, regenerating entries

export function updateInventoryDisplay(scene) {
  // Clear old entries
  scene.invContainer.removeAll(true);
  scene.invEntryContainers = [];

  const spacingX = 50;
  scene.itemKeys.forEach((key, idx) => {
    const group = scene.add.container(idx * spacingX, 530);

    // Background box for selection (will be visible only if selected)
    const box = scene.add.rectangle(0, 0, 44, 44);
    box.setOrigin(0, 0);
    box.setStrokeStyle(2, 0xffff00);
    box.setVisible(false); // default off, selection logic will toggle
    group.add(box);

    // Item icon
    const icon = scene.add.image(8, 4, key);
    icon.setOrigin(0, 0);
    icon.setDisplaySize(36, 36);

    // Count text
    const countText = scene.add.text(32, 32, `${scene.inventory[key]}`, {
      font: '24px Arial',
      fill: '#ffffff',
      stroke: '#000000',
      strokeThickness: 5
    });
    countText.setOrigin(0, 0);

    group.add([icon, countText]);

    scene.invContainer.add(group);

    scene.invEntryContainers.push({ container: group, box, key });
    scene.invContainer.setScrollFactor(0).setDepth(100000000);
  });

  refreshSelectionHighlight(scene);
}

// Updates which inventory entry is highlighted as selected
export function refreshSelectionHighlight(scene) {
  scene.invEntryContainers.forEach((entry, idx) => {
    entry.box.setVisible(idx === scene.selectedIndex);
  });
}

// Places the given item sprite at (x,y) and tags it
export function placeItem(scene, key, x, y) {
  const sprite = scene.add.image(x, y, key);
  sprite.setOrigin(0.5);
  sprite.setDisplaySize(40, 40);
  scene.physics.add.existing(sprite);
  sprite.itemType = key;
  scene.placedItems.add(sprite);
}

// Returns the closest placed item within radius, or null. If multiple close, picks the single nearest.
export function getNearestItemWithin(scene, radius) {
  let best = null;
  let bestDist = Infinity;
  scene.placedItems.getChildren().forEach(item => {
    const dx = item.x - scene.player.x;
    const dy = item.y - scene.player.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= radius && dist < bestDist) {
      bestDist = dist;
      best = item;
    }
  });
  return best;
}