import { memo } from "react";
import { ConversionConstantsSearch } from "../ConversionConstantsSearch";

const knownComponents = {
    "conversion-brute-force": ConversionConstantsSearch,
};

export const CustomComponent = memo(({ json }: { json: string }) => {
    interface ComponentDesc {
        component: string;
        props?: Record<string, unknown>;
    }
    const value = JSON.parse(json) as ComponentDesc;

    const Component = knownComponents[value.component as keyof typeof knownComponents];

    return <Component {...(value.props ?? {})} />;
});
