"use client";

import { useEffect, useRef } from "react";

const PARTICLE_COUNT = 200;
const BOX_SIZE = 100; // How many units the box of universe is large
const MAX_SPEED = 20; // units per second

const START_SPEED = [0.1, 1]; // units per second, min and max

// How this is fast:
// 1. DOM nodes are managed manually. No React.
// 2. Use `transform: translate3d` instead of top/left to avoid page layout reflows.
// 3. Use `will-change: transform` to hint the browser to optimize for transforms.

export default function Particles() {
    const containerRef = useRef<HTMLDivElement>(null);

    const SIZE_FACTOR = 0.2;

    useEffect(() => {
        // initialize particles
        let particles = Array.from({ length: PARTICLE_COUNT }, () => {
            const x = Math.random() * BOX_SIZE;
            const y = Math.random() * BOX_SIZE;
            const vx =
                (Math.random() - 0.5) * (START_SPEED[1] - START_SPEED[0]) * 2 + START_SPEED[0];
            const vy =
                (Math.random() - 0.5) * (START_SPEED[1] - START_SPEED[0]) * 2 + START_SPEED[0];
            const p = new Particle(x, y, vx, vy);
            p.size = Math.random() + 1;
            return p;
        });

        const renderParticles = () => {
            const container = containerRef.current;
            if (!container) return;

            // create particle elements
            while (container.children.length < particles.length) {
                const p = particles[container.children.length];
                const el = document.createElement("span");
                el.style.width = `calc(max(2px, ${p.size * SIZE_FACTOR}vmin))`;
                el.style.height = `calc(max(2px, ${p.size * SIZE_FACTOR}vmin))`;
                el.style.left = `50vw`;
                el.style.top = `50vh`;
                container.appendChild(el);
            }
            if (container.children.length > particles.length) {
                while (container.children.length > particles.length) {
                    container.removeChild(container.lastChild!);
                }
            }

            // const vw = window.innerWidth;
            // const vh = window.innerHeight;
            // const vmax = Math.max(vw, vh) / 100;
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                const el = container.children[i] as HTMLSpanElement;
                if (!el) continue;
                el.style.transform = `translate3d(${p.x - 50}vmax, ${p.y - 50}vmax, 0)`;
            }
        };

        // update loop
        let frameId: number;
        let lastTimestamp: number | undefined = undefined;

        const step = (timestamp: number) => {
            const dt = (timestamp - (lastTimestamp ?? timestamp)) / 1000;
            lastTimestamp = timestamp;

            particles = updateParticles(particles, Math.min(dt, 0.05)); // don't go below 20 FPS
            renderParticles();

            frameId = requestAnimationFrame(step);
        };
        frameId = requestAnimationFrame(step);

        return () => cancelAnimationFrame(frameId);
    }, []);

    return (
        <>
            <style>{`#particles > span { position: absolute; background: white; opacity: 0.5; border-radius: 100%; will-change: transform; }`}</style>
            <div ref={containerRef} id="particles" className="contain-layout" />
        </>
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
        const ATTRACTION = 100 / PARTICLE_COUNT;
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
