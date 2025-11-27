import * as Phaser from "phaser";
import {MainScene} from "@/phaser/scenes/MainScene";

export const createGameConfig = (parentId: string): Phaser.Types.Core.GameConfig => ({
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: "#000000",
    parent: parentId,           // le conteneur HTML dans lequel Phaser va créer le canvas
    scene: [MainScene],
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
        default: "arcade",
        arcade: {
            debug: false,
        },
    },
});
