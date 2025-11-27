// ⚠️ Ici tu peux garder un import statique de Phaser, car CE FICHIER
// n'est chargé que via le import() dynamique dans le useEffect.
import * as Phaser from "phaser";

export class MainScene extends Phaser.Scene {
    constructor() {
        super("MainScene");
    }

    preload() {
        // this.load.image("logo", "/logo.png");
        this.load.image("player", "/assets/player.png")
    }

    create() {
        const { width, height } = this.scale;
        const sprite = this.add.image(400, 300, "player")
        sprite.setScale(2)

        const text = this.add.text(width / 2, height / 2, "Hello Phaser + Next!", {
            fontSize: "32px",
            color: "#ffffff",
        });

        text.setOrigin(0.5, 0.5);
        this.cameras.main.setBackgroundColor("#242424");
    }
}
