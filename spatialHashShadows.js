export class SpatialHash {
  constructor(cellSize = 64) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }
  _cellCoord(v) {
    return Math.floor(v / this.cellSize);
  }
  _key(cx, cy) {
    return `${cx},${cy}`;
  }
  clear() {
    this.cells.clear();
  }
  insert(obj) {
    const cx = this._cellCoord(obj.x);
    const cy = this._cellCoord(obj.y);
    const key = this._key(cx, cy);
    if (!this.cells.has(key)) this.cells.set(key, []);
    this.cells.get(key).push(obj);
  }
  queryAreaRect(minX, minY, maxX, maxY) {
    const cx1 = this._cellCoord(minX);
    const cy1 = this._cellCoord(minY);
    const cx2 = this._cellCoord(maxX);
    const cy2 = this._cellCoord(maxY);
    const results = [];
    for (let cx = cx1; cx <= cx2; cx++) {
      for (let cy = cy1; cy <= cy2; cy++) {
        const bucket = this.cells.get(this._key(cx, cy));
        if (bucket) results.push(...bucket);
      }
    }
    return results;
  }
}
