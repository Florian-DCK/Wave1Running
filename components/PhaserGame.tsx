"use client";

import { useEffect, useRef } from "react";
import { MainScene } from "@/phaser/scenes/MainScene";

export default function PhaserGame() {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const gameRef = useRef<any>(null);

    useEffect(() => {
        let game: any;

        async function loadPhaser() {
            const Phaser = await import("phaser"); // ⬅️ LOADED CLIENT SIDE ONLY

            const container = containerRef.current;
            if (!container) return;

            const width = container.clientWidth;
            const height = container.clientHeight;

            game = new Phaser.Game({
                type: Phaser.AUTO,
                width,
                height,
                parent: container,
                scene: [MainScene],
                scale: {
                    mode: Phaser.Scale.RESIZE,
                    autoCenter: Phaser.Scale.CENTER_BOTH,
                },
            });

            gameRef.current = game;
        }

        loadPhaser();

        return () => {
            if (gameRef.current) {
                gameRef.current.destroy(true);
            }
        };
    }, []);

    return (
        <div
            ref={containerRef}
            style={{
                position: "fixed",
                inset: 0,
                width: "100vw",
                height: "100vh",
                overflow: "hidden",
                background: "black",
            }}
        />
    );
}
