import { memo } from "react";
import { UnormConversion } from "../multiply-add/UnormConversion";
import { Bc4ErrorVisualization } from "../bc4-error-vis";
import { Div2pnM1 } from "../Div2pnM1";

const knownComponents = {
    "unorm-conversion": UnormConversion,
    "bc4-error-vis": Bc4ErrorVisualization,
    "div-2pn-m1": Div2pnM1,
};

export const CustomComponent = memo(({ json }: { json: string }) => {
    interface ComponentDesc {
        component: string;
        props?: Record<string, unknown>;
    }
    const value = JSON.parse(json) as ComponentDesc;

    if (!Object.hasOwn(knownComponents, value.component)) {
        console.error("Unknown custom component:", value.component, value);
        return (
            <div className="bg-red-800 p-8 text-xl text-white">
                Invalid component: <code>{value.component}</code>
            </div>
        );
    }

    const Component = knownComponents[value.component as keyof typeof knownComponents];

    return <Component {...(value.props ?? {})} />;
});
