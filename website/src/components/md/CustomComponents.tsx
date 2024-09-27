import { memo } from "react";
import { UnormConversion } from "../multiply-add/UnormConversion";

const knownComponents = {
    "unorm-conversion": UnormConversion,
};

export const CustomComponent = memo(({ json }: { json: string }) => {
    interface ComponentDesc {
        component: string;
        props?: Record<string, unknown>;
    }
    const value = JSON.parse(json) as ComponentDesc;

    if (!Object.hasOwn(knownComponents, value.component)) {
        throw new Error(`Unknown component: ${value.component}`);
    }

    const Component = knownComponents[value.component as keyof typeof knownComponents];

    return <Component {...(value.props ?? {})} />;
});
