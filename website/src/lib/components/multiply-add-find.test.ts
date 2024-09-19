import { findConversion } from "./multiply-add-find";

describe("findConversion unorm", () => {
    it("should find unorm conversions", async () => {
        const MAX_UNORM_BITS = 16;

        const results: string[] = [];

        const promises: Promise<void>[] = [];
        for (let from = 1; from <= MAX_UNORM_BITS; from++) {
            for (let to = 1; to <= MAX_UNORM_BITS; to++) {
                const key = `${String(from).padStart(2)} -> ${String(to).padEnd(2)}`;

                const inputRange = 2 ** from - 1;
                const outputRange = 2 ** to - 1;
                promises.push(
                    findConversion({ inputRange, D: inputRange, T: outputRange, R: "round" })
                        .then(
                            (res) => {
                                if (!res.conversion) {
                                    return `No conversion found`;
                                }
                                const { factor, add, shift } = res.conversion;
                                return `${factor} ${add} ${shift}`;
                            },
                            (err) => {
                                return `Error: ${err.message}`;
                            },
                        )
                        .then((res) => {
                            results.push(`${key}   ${res}`);
                        }),
                );
            }
        }
        await Promise.all(promises);

        expect(results).toMatchSnapshot();
    });
});
