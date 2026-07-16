"use client";

import { useEffect, useState } from "react";

const MAX_PARTICLES = 100;
const BOX_SIZE = 100; // How many units the box of universe is large
const MAX_SPEED = 20; // units per second

const START_SPEED = [0.1, 1]; // units per second, min and max

export default function Particles() {
    const [particles, setParticles] = useState<Particle[]>(() =>
        Array.from({ length: MAX_PARTICLES }, () => {
            const x = Math.random() * BOX_SIZE;
            const y = Math.random() * BOX_SIZE;
            const vx =
                (Math.random() - 0.5) * (START_SPEED[1] - START_SPEED[0]) * 2 + START_SPEED[0];
            const vy =
                (Math.random() - 0.5) * (START_SPEED[1] - START_SPEED[0]) * 2 + START_SPEED[0];
            const p = new Particle(x, y, vx, vy);
            p.size = Math.random() + 1;
            return p;
        }),
    );

    // ticks
    useEffect(() => {
        let last: number | undefined = undefined;
        let stop = false;
        const step = (timestamp: number) => {
            if (stop) return;
            const dt = (timestamp - (last ?? timestamp)) / 1000;
            last = timestamp;
            setParticles((particles) => {
                return updateParticles(particles, Math.min(dt, 0.05)); // don't go below 20 FPS
            });
            requestAnimationFrame(step);
        };
        requestAnimationFrame(step);

        return () => {
            stop = true;
        };
    }, []);

    const SIZE_FACTOR = 0.2;

    return (
        <div>
            {particles.map((p, i) => {
                return (
                    <span
                        key={i}
                        className="absolute rounded-full bg-white opacity-50"
                        style={{
                            width: `calc(max(2px, ${p.size * SIZE_FACTOR}vmin))`,
                            height: `calc(max(2px, ${p.size * SIZE_FACTOR}vmin))`,
                            left: `calc(50vw + ${p.x - 50}vmax)`,
                            top: `calc(50vh + ${p.y - 50}vmax)`,
                        }}
                    ></span>
                );
            })}
        </div>
    );
}

class Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;

    constructor(x: number, y: number, vx: number, vy: number, size: number = 1) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.size = size;
    }

    clone(): Particle {
        return new Particle(this.x, this.y, this.vx, this.vy, this.size);
    }
}

function updateParticles(particles: readonly Particle[], dt: number): Particle[] {
    return particles.map((p) => {
        p = p.clone();

        // particles are attracted to each other
        const ATTRACTION = 1;
        for (const other of particles) {
            if (other === p) continue;
            const dx = other.x - p.x;
            const dy = other.y - p.y;
            const distSq = Math.max(dx * dx + dy * dy, 0.001);
            const dist = Math.sqrt(distSq);
            const force = (ATTRACTION * other.size) / dist; // note: dist not distSq
            p.vx += force * dt * (dx / dist);
            p.vy += force * dt * (dy / dist);
        }

        {
            // pull towards center
            const CENTER_PULL = 0.05;
            const BIAS = 40;
            const dx = BOX_SIZE / 2 - p.x;
            const dy = BOX_SIZE / 2 - p.y;
            const dist = Math.hypot(dx, dy);
            const force = CENTER_PULL * (dist - BIAS);
            if (force > 0) {
                p.vx += force * dt * (dx / dist);
                p.vy += force * dt * (dy / dist);
            }
        }

        // limit speed
        const speed = Math.hypot(p.vx, p.vy);
        if (speed > MAX_SPEED) {
            p.vx = (p.vx / speed) * MAX_SPEED;
            p.vy = (p.vy / speed) * MAX_SPEED;
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // handle edge of box by wrapping
        if (p.x < 0) p.x += BOX_SIZE;
        if (p.y < 0) p.y += BOX_SIZE;
        p.x %= BOX_SIZE;
        p.y %= BOX_SIZE;

        return p;
    });
}
