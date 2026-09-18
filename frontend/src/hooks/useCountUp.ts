// A number that rises to its value over a moment, for the urgent variant's exposed-accounts tile.
// Frame-driven, so it stops the instant the tile leaves the screen; under `prefers-reduced-motion`
// or in still mode it is simply the value, with nothing scheduled.
import { useEffect, useState } from 'react';

import { prefersReducedMotion } from '~/ui/motion';

export enum CountMode {
    Still = 'still',
    CountUp = 'countUp',
}

const COUNT_UP_MS = 1400;

const isStill = (mode: CountMode): boolean => mode === CountMode.Still;

// Fast at first, settling into the final figure: the eye reads the number, not the motion.
const easeOutCubic = (progress: number): number => 1 - (1 - progress) ** 3;

export const useCountUp = ({ target, mode }: { target: number; mode: CountMode }): number => {
    const [shown, setShown] = useState(target);

    useEffect(() => {
        if (isStill(mode) || prefersReducedMotion()) {
            setShown(target);

            return;
        }
        const startedAt = performance.now();
        // The handle of the frame currently waiting, so the cleanup can cancel whichever one it is.
        const pending = { frame: 0 };
        const tick = (now: number): void => {
            const progress = Math.min(1, (now - startedAt) / COUNT_UP_MS);
            setShown(Math.round(target * easeOutCubic(progress)));
            if (progress < 1) pending.frame = requestAnimationFrame(tick);
        };
        pending.frame = requestAnimationFrame(tick);

        return (): void => {
            cancelAnimationFrame(pending.frame);
        };
    }, [target, mode]);

    return shown;
};
