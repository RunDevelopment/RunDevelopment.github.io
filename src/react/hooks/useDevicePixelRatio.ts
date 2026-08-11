import { useEffect, useState } from "react";

export function useDevicePixelRatio(): number {
    const [devicePixelRatio, setDevicePixelRatio] = useState(1);

    useEffect(() => {
        const dpr = window.devicePixelRatio;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDevicePixelRatio(dpr);

        let mediaMatcher = window.matchMedia(`screen and (resolution: ${dpr}dppx)`);

        const update = () => {
            const dpr = window.devicePixelRatio;
            setDevicePixelRatio(window.devicePixelRatio);

            mediaMatcher.removeEventListener("change", update);
            mediaMatcher = window.matchMedia(`screen and (resolution: ${dpr}dppx)`);
            mediaMatcher.addEventListener("change", update);
        };

        mediaMatcher.addEventListener("change", update);
        return () => {
            mediaMatcher.removeEventListener("change", update);
        };
    }, []);

    return devicePixelRatio;
}
