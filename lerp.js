export function lerpColor(color1, color2, t) {
    const c1 = Phaser.Display.Color.HexStringToColor(color1).color;
    const c2 = Phaser.Display.Color.HexStringToColor(color2).color;

    const r1 = (c1 >> 16) & 0xff;
    const g1 = (c1 >> 8) & 0xff;
    const b1 = c1 & 0xff;

    const r2 = (c2 >> 16) & 0xff;
    const g2 = (c2 >> 8) & 0xff;
    const b2 = c2 & 0xff;

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return Phaser.Display.Color.GetColor(r, g, b);
}
