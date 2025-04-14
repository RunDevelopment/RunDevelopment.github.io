---
datePublished: 2024-09-20
dateModified: 2024-09-24
description: Optimizing the conversion of 5-bit unorms to 8-bit unorms in Rust.
inlineCodeLanguage: rust
tags: rust optimization unorm
image: ./ds3-m32-2024-09-19.jpg
color: "#55b0ed"
---

# Fast Unorm Conversions

I recently came across a problem where I needed to convert a 5-bit unorm to an 8-bit unorm. "Unorm" means **u**nsigned **norm**alized integer. The idea is to represent a real number 0 to 1 as an integer 0 to $2^n-1$, where $n$ is the number of bits used to represent the integer.

Maybe the most widespread application of unorms is color in computer graphics. Image editing programs like Photoshop and Gimp typically show RGB color channels as values between 0 and 255. Those are 8-bit unorms. The same goes for colors on the web. E.g. the CSS color `rgb(255 128 0)` is the same color as `rgb(100% 50% 0%)`, and the hex color `#0099EE` (decimal: 0 153 238) is the same as `#09E` (decimal: 0 9 14).

Color is also where my problem originated. I wanted to decode images that store pixel color as `B5G5R5A1`. This is an RGBA format that encodes the RGB channels with 5 bits each and the alpha channel with 1 bit, for a total of 16 bits per pixel. I needed to convert all channels to 8-bit. This is easy for the 1-bit alpha channel (just multiply with 255), but the 5-bit unorms of the RGB channels are a bit (or four) more tricky.

The value of an $n$-bit unorm $x_n \in \set{0, ...,2^n-1}$ is calculated as $x_n / (2^n-1)$. So converting an $n$-bit unorm to an $m$-bit unorm can be done with this formula:

$$
x_m = round(x_n \cdot \frac{2^m - 1}{2^n - 1})
$$

(Rounding is necessary to get the closest integer value.)

Plugging in the numbers for a 5-bit to 8-bit unorm conversion, we get:

$$
x_8 = round(x_5 \cdot \frac{255}{31})
$$

Using floats, this translates very naturally into code. Here's a naive implementation of this formula in Rust:

```rust
fn u5_to_u8_naive(x: u8) -> u8 {
    debug_assert!(x < 32);
    let factor = 255.0 / 31.0;
    (x as f32 * factor).round() as u8
}
```

<div class="side-note">

Unfortunately, Rust doesn't have a `u5` type, so `x: u8` + `debug_assert!` will have to do. I yearn for the day when Rust allows me to express integer types if arbitrary bit width. (Or even better, arbitrary ranges like 0 to 100, but that day will likely never come...)

</div>

While this function works correctly and gets the job done, it's not so great performance-wise. My goal wasn't just to decode images correctly, but to do it quickly. In my application, any millisecond spend decoding images is a millisecond not spend doing actual work. So I set out to optimize this function.

This article will show various ways to optimize the problem of converting unorms. We'll start with some floating-point tricks to make the naive implementation faster and work our way up to a version that is **46x faster**.

<div class="info">

The benchmark previously had [a bug](https://github.com/RunDevelopment/rounding-bench-rs/issues/1) that affected the timing of `u5_to_u8_naive`. No other implementations were affected. The bug was fixed on 2024-09-24.

</div>

## Contents

## The Benchmark

Before we start optimizing, let's define a benchmark. Since my problem is about decoding `B5G5R5A1` images, the benchmark will be to decode the pixel data of a 64x64px `B5G5R5A1` image to 8-bit RGBA (8 bits per channel, 32 bits per pixel).

Here's the main function we'll benchmark. It takes a slice of 16-bit pixels, decodes each one, and writes them into the output buffer of 8-bit RGBA pixels. The 5-to-8-bit-unorm conversion function is passed in as a generic argument. Since decoding is done in a tight loop, we not only benchmark the `u5_to_u8` function, but also how well the compiler can vectorize it. All conversion functions are marked with `#[inline(always)]`, so the compiler can optimize across function boundaries.

```rust
fn decode(
    to_decode: &[u16],
    output: &mut [[u8; 4]],
    u5_to_u8: impl Fn(u8) -> u8
) {
    for (bgra, out) in to_decode.iter().zip(output.iter_mut()) {
        let b5 = bgra & 0x1F;
        let g5 = (bgra >> 5) & 0x1F;
        let r5 = (bgra >> 10) & 0x1F;
        let a1 = (bgra >> 15) & 0x1;

        *out = [
            u5_to_u8(r5 as u8),
            u5_to_u8(g5 as u8),
            u5_to_u8(b5 as u8),
            u1_to_u8(a1 as u8),
        ];
    }
}
```

The full benchmark code can be found on [my GitHub](https://github.com/RunDevelopment/rounding-bench-rs). All benchmarks in this article were performed with [`criterion`](https://bheisler.github.io/criterion.rs/book/criterion_rs.html) on the following system:

-   OS: Windows 10
-   CPU: Intel® Core™ i7-8700K CPU @ 3.70GHz
-   Rust: 1.80.1

Here is the result for the naive implementation:

```
                    low       expected       high
u5_to_u8_naive     [196.99 µs 197.75 µs 198.71 µs]
```

<div class="info">

`criterion` reports a [confidence interval](https://bheisler.github.io/criterion.rs/book/user_guide/command_line_output.html#time). The left and right values are the lower and upper bounds of the interval, respectively. `criterion` is 95% confident that the real per-iteration runtime is inside this interval. The center value is `criterion`'s best estimate of the actual runtime per iteration.

**Use the center value** for a simple way to compare the performance of different implementations.

</div>

## Diving into assembly

Since the goal is to micro-optimize a small function, let's take a look at the assembly generated by the compiler. This will show us what optimizations that compiler is and is not applying to our code and will give us some insight on what the CPU is actually doing.

[Compiler Explorer](<https://godbolt.org/#g:!((g:!((g:!((h:codeEditor,i:(filename:'1',fontScale:14,fontUsePx:'0',j:1,lang:rust,selection:(endColumn:1,endLineNumber:9,positionColumn:1,positionLineNumber:9,selectionStartColumn:1,selectionStartLineNumber:9,startColumn:1,startLineNumber:9),source:'%23%5Bno_mangle%5D%0Apub+fn+u5_to_u8_naive(x:+u8)+-%3E+u8+%7B%0A++++debug_assert!!(x+%3C+32)%3B%0A++++let+factor+%3D+255.0+/+31.0%3B%0A++++(x+as+f32+*+factor).round()+as+u8%0A%7D%0A%0Afn+main()+%7B%7D%0A'),l:'5',n:'1',o:'Rust+source+%231',t:'0')),k:46.58379142816912,l:'4',n:'0',o:'',s:0,t:'0'),(g:!((g:!((h:compiler,i:(compiler:r1800,filters:(b:'0',binary:'1',binaryObject:'1',commentOnly:'1',debugCalls:'1',demangle:'0',directives:'0',execute:'1',intel:'0',libraryCode:'0',trim:'1',verboseDemangling:'0'),flagsViewOpen:'1',fontScale:14,fontUsePx:'0',j:1,lang:rust,libs:!(),options:'-C+opt-level%3D3',overrides:!((name:edition,value:'2021')),selection:(endColumn:1,endLineNumber:1,positionColumn:1,positionLineNumber:1,selectionStartColumn:1,selectionStartLineNumber:1,startColumn:1,startLineNumber:1),source:1),l:'5',n:'0',o:'+rustc+1.80.0+(Editor+%231)',t:'0')),k:53.41620857183087,l:'4',m:50,n:'0',o:'',s:0,t:'0'),(g:!((h:executor,i:(argsPanelShown:'1',compilationPanelShown:'0',compiler:r1780,compilerName:'',compilerOutShown:'0',execArgs:'',execStdin:'',fontScale:14,fontUsePx:'0',j:1,lang:rust,libs:!(),options:'',overrides:!((name:edition,value:'2021')),runtimeTools:!(),source:1,stdinPanelShown:'1',wrap:'1'),l:'5',n:'0',o:'Executor+rustc+1.78.0+(Rust,+Editor+%231)',t:'0')),header:(),l:'4',m:50,n:'0',o:'',s:0,t:'0')),k:53.41620857183087,l:'3',n:'0',o:'',t:'0')),l:'2',n:'0',o:'',t:'0')),version:4>) is a quick and easy way to see the assembly of a function. Copy-paste some code and the website will show the assembly along with documentation for instructions, a mapping between your code and the generated assembly, and much more. Just remember to add `-C opt-level=3` to the Rust compiler flags to get optimized assembly.

All relevant assembly in this article is annotated with comments, so _no prior knowledge of assembly is required_. Anyone that knows that registers are like global variables and that instructions are kind of like functions with side effects can follow along.

With that out of the way, here's the assembly generated by the naive implementation:

```rust
fn u5_to_u8_naive(x: u8) -> u8 {
    debug_assert!(x < 32);
    let factor = 255.0 / 31.0;
    (x as f32 * factor).round() as u8
}
```

```asm
.LCPI0_0:
        .long   0x41039ce7 ; 8.22580624 (f32) (this is 255/31)
.LCPI0_1:
        .long   0x437f0000 ; 255.0 (f32)
u5_to_u8_naive:
        push    rax
        movzx   eax, dil
        cvtsi2ss        xmm0, eax                 ; xmm0 = x to f32
        mulss   xmm0, dword ptr [rip + .LCPI0_0]  ; xmm0 = xmm0 * 8.22580624 (= 255/31)
        call    qword ptr [rip + roundf@GOTPCREL] ; xmm0 = round(xmm0)
        xorps   xmm1, xmm1                        ; xmm1 = 0.0             \
        maxss   xmm1, xmm0                        ; xmm1 = max(xmm1, xmm0)  \
        movss   xmm0, dword ptr [rip + .LCPI0_1]  ; xmm0 = 255.0             | as u8
        minss   xmm0, xmm1                        ; xmm0 = min(xmm0, xmm1)  /
        cvttss2si       eax, xmm0                 ; convert xmm0 to int    /
        pop     rcx
        ret
```

As we can see, the assembly is a fairly literal translation of our Rust code. The compiler just removed the `debug_assert!` ([as it should](https://doc.rust-lang.org/std/macro.debug_assert.html)) and precomputed `255.0 / 31.0`. There are two things that stick out however:

1. `f32::round` is a function call. Apparently, there is no instruction for rounding, so it has to be done in software. Software implementations are typically a lot slower than hardware instructions, so this likely costs a lot.
2. The `minss` and `maxss` instructions for `as u8`. These are used to clamp the floating-point value to the range 0-255 before converting it to an integer. We don't really need this, so it would be nice to get rid of it.

Since rounding results in a call to a function of unknown complexity, we'll start by optimizing the call to `f32::round`.

## Rounding without `round`

Mathematically speaking, rounding a real number $r \in \R$ to the nearest integer is defined as:

$$
round(r) = \begin{cases}
    \lfloor r + 0.5 \rfloor & \text{if } r \ge 0 \\
    \lceil r - 0.5 \rceil & \text{otherwise}
\end{cases}
$$

<div class="side-note">

Implementing this formula in code might _seem_ straightforward, but floating-point numbers only have a finite precision, so adding/subtracting 0.5 will return a _rounded_ result. All assertions in the following code will pass:

```rust
fn simple_round(x: f32) -> f32 {
    if x >= 0.0 {
        (x + 0.5).floor()
    } else {
        (x - 0.5).ceil()
    }
}

let a: f32 = 0.49999997;
assert!(a < 0.5);
assert!(a + 0.5 == 1.0);
assert!((a + 0.5).floor() == 1.0);
assert!(simple_round(a) == 1.0);
assert!(a.round() == 0.0);
println!("All asserts passed!");
```

So be always careful when implementing mathematical formulas when floating-point numbers are involved.

</div>

Since `u5_to_u8_naive` only rounds non-negative numbers, we can simplify the formula to remove the branch.

$$
round(r) = \lfloor r + 0.5 \rfloor, \space r\ge 0
$$

And now for the main trick: [`as u8` truncates](https://doc.rust-lang.org/reference/expressions/operator-expr.html#numeric-cast). Rust guarantees that floating-point numbers are turned into integers via truncation. Since $trunc(r) = \lfloor r \rfloor$ for all $r \ge 0$, we can replace `r.round() as u8` with `(r + 0.5) as u8` in our code:

```rust
fn u5_to_u8_v2(x: u8) -> u8 {
    debug_assert!(x < 32);
    let factor = 255.0 / 31.0;
    (x as f32 * factor + 0.5) as u8
}
```

```asm
.LCPI0_0:
        .long   0x41039ce7 ; 8.22580624 (f32)
.LCPI0_1:
        .long   0x3f000000 ; 0.5 (f32)
.LCPI0_2:
        .long   0x437f0000 ; 255.0 (f32)
u5_to_u8_v2:
        movzx   eax, dil
        cvtsi2ss        xmm0, eax                ; xmm0 = x to f32
        mulss   xmm0, dword ptr [rip + .LCPI0_0] ; xmm0 = xmm0 * 8.22580624 (= 255/31)
        addss   xmm0, dword ptr [rip + .LCPI0_1] ; xmm0 = xmm0 + 0.5
        xorps   xmm1, xmm1                       ; xmm1 = 0.0              \
        maxss   xmm1, xmm0                       ; xmm1 = max(xmm1, xmm0)   \
        movss   xmm0, dword ptr [rip + .LCPI0_2] ; xmm0 = 255.0              | as u8
        minss   xmm0, xmm1                       ; xmm0 = min(xmm0, xmm1)   /
        cvttss2si       eax, xmm0                ; convert xmm0 to int     /
        ret
```

```
                    low       expected       high
u5_to_u8_naive     [196.99 µs 197.75 µs 198.71 µs]
u5_to_u8_v2        [17.730 µs 17.771 µs 17.817 µs]  11.1x
```

Yep, 11x faster just by avoiding the call to `f32::round`.

However, the takeaway here is **not** to avoid `f32::round` or other `f32::*` functions at all costs. Some functions are efficiently implemented in hardware, while others are not. It's your responsibility to find out which ones are fast and to search for alternatives for the slow ones.

## Faster with `unsafe`

Next, we'll get rid of the clamping.

`as u8` clamps the input number to the range 0-255. E.g. `300_f32 as u8` will return `255_u8`. This is unlike C/C++, where **no** clamping is performed and converting floating-point values that cannot be represented by the target integer type is _undefined behavior_ (UB). So e.g. `(uint8_t) 300.0f` in C is UB. Rust keeps us safe, but this comes at a performance cost.

However, clamping is entirely unnecessary in our case. Since the input value `x` is between 0 and 31, we know that the floating-point value being converted to a `u8` will always be between 0.5 and 255.5. After truncation, the floating-point value will always be in-range for `u8`. So we're paying the cost of clamping for no reason.

Luckily, Rust has a way out. [`f32::to_int_unchecked`](https://doc.rust-lang.org/std/primitive.f32.html#method.to_int_unchecked) will perform the integer conversion without clamping. This function also comes with the same UB as casts in C, so we need to use `unsafe`.

```rust
/// ## Safety
/// The caller must ensure `x < 32`.
unsafe fn u5_to_u8_unsafe(x: u8) -> u8 {
    debug_assert!(x < 32);
    let factor = 255.0 / 31.0;
    let f = x as f32 * factor + 0.5;
    unsafe {
        // SAFETY: If 0 <= x <= 31, then 0.5 <= f <= 255.5. Since `to_int_unchecked` truncates,
        //         the integer value of f will be between in-range for u8.
        f.to_int_unchecked()
    }
}
```

```asm
.LCPI0_0:
        .long   0x41039ce7
.LCPI0_1:
        .long   0x3f000000
u5_to_u8_unsafe:
        movzx   eax, dil
        cvtsi2ss        xmm0, eax                ; xmm0 = x to f32
        mulss   xmm0, dword ptr [rip + .LCPI0_0] ; xmm0 = xmm0 * 8.22580624 (255 / 31)
        addss   xmm0, dword ptr [rip + .LCPI0_1] ; xmm0 = xmm0 + 0.5
        cvttss2si       eax, xmm0                ; convert xmm0 to u8
        ret
```

```
                    low       expected       high
u5_to_u8_naive     [196.99 µs 197.75 µs 198.71 µs]
u5_to_u8_v2        [17.730 µs 17.771 µs 17.817 µs]  11.1x
u5_to_u8_unsafe    [7.2110 µs 7.2304 µs 7.2551 µs]  27.3x
```

That's over 2x faster than the previous version, and 27.3x faster than the naive implementation.

Unfortunately, the function must be marked as `unsafe`, because it _will cause UB_ if given a value `x >= 32`. This makes the function harder to use, since a small mistake can invalidate all of Rust's safety guarantees. So we need a way to guarantee that `x` is always is in the range 0-31, and ideally at no runtime cost.

### Safer `unsafe` performance

If Rust had a 5-bit integer type, we could just say `x: u5` and the compiler would guarantee that `x < 32`. But since Rust doesn't have such a type, we need to find another way.

Another cheap option is to compute `x % 32`. This will ensure that `x` is always in the range 0-31. The modulo operator is also very cheap for powers of 2, since it can be optimized to a single bitwise AND operation. E.g. `x % 32` is the same as `x & 31`. In general, computers can calculate $x \bmod 2^k$ quickly as $x \space \& \space (2^k - 1)$.

The modulo operation also means that values `x >= 32` will return nonsense, but this is fine since we don't care about those input values anyway.

```rust
fn u5_to_u8_safer_int(mut x: u8) -> u8 {
    debug_assert!(x < 32);
    x %= 32;
    let factor = 255.0 / 31.0;
    let f = x as f32 * factor + 0.5;
    // SAFETY: `f` is guaranteed to be between 0.5 and 255.5
    unsafe { f.to_int_unchecked() }
}
```

```asm
.LCPI0_0:
        .long   0x41039ce7 ; 8.22580624 (f32)
.LCPI0_1:
        .long   0x3f000000 ; 0.5 (f32)
u5_to_u8_safer_int:
        and     edi, 31                          ; x = x & 31
        cvtsi2ss        xmm0, edi                ; xmm0 = x to f32
        mulss   xmm0, dword ptr [rip + .LCPI0_0] ; xmm0 = xmm0 * 8.22580624 (= 255/31)
        addss   xmm0, dword ptr [rip + .LCPI0_1] ; xmm0 = xmm0 + 0.5
        cvttss2si       eax, xmm0                ; convert xmm0 to int
        ret
```

The assembly is exactly the same except for one additional bitwise AND. Bitwise operations are cheap, but cheap isn't free, so let's see how it performs:

```
                    low       expected       high
u5_to_u8_naive     [196.99 µs 197.75 µs 198.71 µs]
u5_to_u8_v2        [17.730 µs 17.771 µs 17.817 µs]  11.1x
u5_to_u8_unsafe    [7.2110 µs 7.2304 µs 7.2551 µs]  27.3x
u5_to_u8_safer_int [7.2187 µs 7.2372 µs 7.2576 µs]  27.3x
```

Huh.

Okay, so it's just as fast as the previous `unsafe` version (within the margin of error). Let's take a look at the benchmark code again to figure out why:

```rust
let b5 = bgra & 0x1F;
let g5 = (bgra >> 5) & 0x1F;
let r5 = (bgra >> 10) & 0x1F;
let a1 = (bgra >> 15) & 0x1;

*out = [
    u5_to_u8(r5 as u8),
    u5_to_u8(g5 as u8),
    u5_to_u8(b5 as u8),
    u1_to_u8(a1 as u8),
];
```

Aha! See those `& 0x1F`? Hex `0x1F` is 31 in decimal. In other words, the benchmark code is already doing `x & 31` while unpacking the color channels. The compiler noticed this and completely optimized away the redundant `x % 32` from `u5_to_u8_safer_int`. This is why we pay no extra runtime cost in our benchmark.

Of course, if we had a different benchmark then we might have had to pay the extra `x % 32`. This is why choosing a benchmark that closely resembles the real-world use case is important.

## Lookup tables

Enough with the floating-point operations. Let's take a look at a different approach: lookup tables (LUT). A LUT can be very fast, especially when an operation is expensive and the input domain is small. Our operation isn't exactly expensive, but let's see!

Since our input domain is only 32 values, we can easily create a LUT for the conversion.

```rust
fn u5_to_u8_lut(x: u8) -> u8 {
    debug_assert!(x < 32);
    const LUT: [u8; 32] = [
        0, 8, 16, 25, 33, 41, 49, 58, 66, 74, 82, 90, 99, 107, 115, 123, 132, 140, 148, 156, 165,
        173, 181, 189, 197, 206, 214, 222, 230, 239, 247, 255,
    ];
    LUT[(x as usize) % 32]
}
```

```asm
u5_to_u8_lut:
        and     edi, 31                    ; x = x & 31 (= x % 32)
        lea     rax, [rip + .L__unnamed_1] ; compute the address of the LUT
        movzx   eax, byte ptr [rdi + rax]  ; LUT[x]
        ret

.L__unnamed_1: ; this is the LUT encoded as a byte array
        .ascii  "\000\b\020\031!)1:BJRZcks{\204\214\224\234\245\255\265\275\305\316\326\336\346\357\367\377"
```

I used `x % 32` to allow the compiler to optimize away bounds checks. Just like before, `x % 32` will be optimized away in the benchmark, but we'll see a bitwise AND in the assembly of the function itself. Speaking of the benchmark:

```
                    low       expected       high
u5_to_u8_naive     [196.99 µs 197.75 µs 198.71 µs]
u5_to_u8_v2        [17.730 µs 17.771 µs 17.817 µs]  11.1x
u5_to_u8_unsafe    [7.2110 µs 7.2304 µs 7.2551 µs]  27.3x
u5_to_u8_safer_int [7.2187 µs 7.2372 µs 7.2576 µs]  27.3x
u5_to_u8_lut       [6.7951 µs 6.8097 µs 6.8261 µs]  29.0x
```

And it's faster than our highly-optimized floating-point code. Not but much, but still. Considering how simple the LUT is (to make and understand), this is a great result.

Especially for small input domains, LUTs are cache-friendly and can be hard to beat in terms of simplicity and performance. In our case, the LUT is just 32 bytes, so it even fits in a single cache line (assuming favorable alignment).

<div class="side-note">

In a previous version of this article, I used Rust 1.78.0 for benchmarking. This version of Rust had a performance regression that caused the LUT version to be more than 2x slower (around 14µs). Essentially, the compiler thought it was a good idea to first copy the LUT onto the stack before using it. It even did that inside the tight loop of the benchmark, always writing the entire LUT to the stack before reading the data back.

This article originally contained multiple versions of LUT to work around this compiler bug. Rust 1.80.0 thankfully fixed the issue. The simple, straightforward and safe LUT implementation now performs optimally again.

</div>

## Integer rounding

There is an old trick to get rounded integer division. It's based on the fact that integer division truncates the result. E.g. `5 / 3 == 1`. Just like how we used the truncation of `as u8` before, we can use the truncation of integer division to get rounded results.

Let's look at the math. For $a \in \N$ and $b\in\N,b>0$:

$$
\begin{split}
round(\frac{a}{b}) &= \lfloor \frac{a}{b} + 0.5 \rfloor \\
 &= \lfloor \frac{a + b/2}{b} \rfloor \\
 &= \lfloor \frac{a +\lfloor b/2 \rfloor}{b} \rfloor \\
\end{split}
$$

(The last equality holds because $\lfloor (c+0.5)/b \rfloor = \lfloor c/b \rfloor$ for any $c\in\N$.)

Since we are only dealing with non-negative numbers, we can use truncating division instead of floor division everywhere. In Rust code, this is simply:

```rust
fn div_round(a: u8, b: u8) -> u8 {
    (a + b / 2) / b
}
```

(I'm ignoring problems with overflow and `b == 0` here.)

With this trick in hand, we can rewrite our 5-to-8-bit conversion function using integer division instead of floating-point operations. We just need to be careful with the intermediate results to avoid overflow.

```rust
fn u5_to_u8_int(x: u8) -> u8 {
    debug_assert!(x < 32);
    ((x as u16 * 255 + (31 / 2)) / 31) as u8
}
```

```asm
u5_to_u8_int:
        movzx   eax, dil
        mov     ecx, eax       ; ecx = x
        shl     ecx, 8         ; ecx = ecx << 8 (= ecx * 256)   | This is
        sub     ecx, eax       ; ecx = ecx - x                  | * 255
        add     ecx, 15        ; ecx = ecx + 15  (15 = 31/2)
        movzx   eax, cx        ; \
        imul    edx, eax, 2115 ;  \
        shr     edx, 16        ;   \
        sub     ecx, edx       ;    | All of this is / 31
        movzx   eax, cx        ;    | but faster™
        shr     eax            ;   /
        add     eax, edx       ;  /
        shr     eax, 4         ; /
        ret
```

Alright, so the assembly is just a tiny bit cryptic.

Integer division is rather slow on modern CPUs. Since the compiler statically knows we divide by 31, it used a trick to replace the integer division instruction with a faster sequence of operations to compute the division. Even though there are a lot of instructions, this is pretty fast:

```
                    low       expected       high
u5_to_u8_naive     [196.99 µs 197.75 µs 198.71 µs]
u5_to_u8_v2        [17.730 µs 17.771 µs 17.817 µs]  11.1x
u5_to_u8_unsafe    [7.2110 µs 7.2304 µs 7.2551 µs]  27.3x
u5_to_u8_safer_int [7.2187 µs 7.2372 µs 7.2576 µs]  27.3x
u5_to_u8_lut       [6.7951 µs 6.8097 µs 6.8261 µs]  29.0x
u5_to_u8_int       [5.0247 µs 5.0486 µs 5.0715 µs]  39.2x
```

Yep. It easily beats the floating-point versions and even the LUT.

### The multiply-add method

Let's return to the optimization the compiler made to avoid division by 31. The above assembly as pretty cryptic, but that's only because the compiler needs to handle numeric overflow properly. We can use the `x % 32` trick as before to make the compiler realize that it doesn't need to handle any overflow.

```rust
fn u5_to_u8_int(mut x: u8) -> u8 {
    debug_assert!(x < 32);
    x %= 32;
    ((x as u16 * 255 + (31 / 2)) / 31) as u8
}
```

```asm
u5_to_u8_int:
        and     edi, 31         ; x = x & 31 (= x % 32)
        mov     eax, edi        ; eax = x
        shl     eax, 8          ; eax = eax << 8 (= eax * 256)   | This is
        sub     eax, edi        ; eax = eax - x                  | * 255
        add     eax, 15         ; eax = eax + 15  (15 = 31/2)
        movzx   eax, ax         ; eax = eax as u32   \
        imul    eax, eax, 16913 ; eax = eax * 16913   | This is / 31
        shr     eax, 19         ; eax = eax >> 19    /
        ret
```

<div class="side-note">

Performance-wise, `x % 32` doesn't make it any faster. Just like with `u5_to_u8_safer_int`, the compiler already knows that `x` is between 0 and 31 because of the bit-wise AND in the benchmark. So the above version with `x % 32` simply shows us the assembly that the compiler is generating in our benchmark (or rather, assembly very close to it).

</div>

Now we can see the trick more clearly. The compiler replaced `i / 31` with `i * 16913 >> 19`, trading an expensive division for a multiplication and cheap bit shift. This trick is called the _multiply-add method_ for constant integer division.

Now, I hear you ask, _"why is this called the multiply-**add** method when it's just doing a multiplication and a shift?"_ That's because the added number just so happens to be 0!

The multiply-add method is based on the observation that any division $\lfloor x / d \rfloor, x \in\set{0,...,U},d\in\N_1$ (where $U$ is the maximum value of $x$, e.g. if $x$ is an 8-bit integer then $U=2^8-1=255$) can be expressed as:

$$
\lfloor \frac{x}{d} \rfloor
= \lfloor \frac{x\cdot f+a}{2^s} \rfloor
$$

for suitable values of $f,a,s\in\N$. Since floor division by a power of 2 is just a right bit shift, this means that we can express `x / d` as `(x * f + a) >> s`. This is the multiply-add method. Not only is it always possible to find suitable $f,a,s$ for any $d$, and we can even find some with $a=0$.

You can think of the multiply-add method as a generalization of the old "replace division by a power of 2 with a right bit shift" trick. And indeed, if $d$ is a power of two, then $f=1$, $a=0$, and $s=\log_2 d$ are the optimal constants for the multiply-add method. (Optimal in the sense that they result in the least amount of work for the computer.)

## Generalized multiply-add method

As it turns out, the multiply-add method is not limited to floor division. We can also find constants for other rounding functions (e.g. `ceil` and `round`). We aren't even limited to division. Multiplication with arbitrary fractions $t/d$ can be done.

Since our unorm conversion is just $round(x \cdot 255/31)$, we can use the multiply-add method to perform the whole conversion. **IF** we can find the right constants that is. I'll soon write a whole article on this topic, so let's just assume the constants were brute-forced for now. For $x\in\set{0,...,31}$, we find that $f=527$, $a=23$, and $s=6$ are the smallest constants that work. Unfortunately, there exist no constants with $a=0$ for this case.

Putting this into code is very simple. The only pitfall is that $31 \cdot 527=16337$ doesn't fit into `u8`, so we need `u16` for the intermediate result again.

```rust
fn u5_to_u8_ma(x: u8) -> u8 {
    debug_assert!(x < 32);
    ((x as u16 * 527 + 23) >> 6) as u8
}
```

```asm
u5_to_u8_ma:
        movzx   eax, dil      ; eax = x
        imul    eax, eax, 527 ; eax = eax * 527
        add     eax, 23       ; eax = eax + 23
        shr     eax, 6        ; eax = eax >> 6
        ret
```

The assembly is a very literal translation of our code. Let's see how it performs:

```
                    low       expected       high
u5_to_u8_naive     [196.99 µs 197.75 µs 198.71 µs]
u5_to_u8_v2        [17.730 µs 17.771 µs 17.817 µs]  11.1x
u5_to_u8_unsafe    [7.2110 µs 7.2304 µs 7.2551 µs]  27.3x
u5_to_u8_safer_int [7.2187 µs 7.2372 µs 7.2576 µs]  27.3x
u5_to_u8_lut       [6.7951 µs 6.8097 µs 6.8261 µs]  29.0x
u5_to_u8_int       [5.0247 µs 5.0486 µs 5.0715 µs]  39.2x
u5_to_u8_ma        [4.5759 µs 4.5909 µs 4.6094 µs]  43.1x
```

And it's the fastest method.

Since it is doing strictly less work than the integer rounding method, this result is not surprising. However, the generalized multiply-add method is only 10% faster, so that's still a little disappointing.

### Constants

In case you need constants for other unorm conversions, here's a little tool. Given the _From_ and _To_ bits of the unorm conversion, it will return constants for the multiply-add method. The tool will also generate Rust and C code for the specified unorm conversion with those constants.

```json:custom
{
    "component": "unorm-conversion"
}
```

<div class="info">

Limitations:

-   This tool is limited to a maximum of 32 bits in either direction. (All constants were precomputed.)

-   The generated C code may not be standard conforming, due to the lack of a standardized 128-bit integer type. If the code uses the `uint128_t` type, replace it with the appropriate 128-bit integer type for your compiler. See [this Stack Overflow answer](https://stackoverflow.com/a/54815033/7595472) for more details.

</div>

### Vectorization-friendly constants

This trick was suggested by [u/rofrol](https://www.reddit.com/r/rust/comments/1fl7uo4/comment/lo8s3ij/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1&utm_content=share_button) on Reddit. The idea is to use constants that allow the compiler to skip the bit shift entirely. If $s$ is 8, 16, 32 or 64, the bit shift can be performed implicitly by just reading the upper byte(s) of the result. On its own, this doesn't actually perform any better than a bit shift, but it's very useful for SIMD! The compiler auto-vectorizes our benchmark code and can take advantage of this.

So how do we get constants with favorable $s$ values? If the constants $(f,a,s)$ work, then $(2f,2a,s+1)$ also work, because:

$$
\lfloor \frac{x\cdot f+a}{2^s} \rfloor = \lfloor \frac{x\cdot 2f+2a}{2^{s+1}} \rfloor
$$

So we can make $s$ as large as we want, we just have to increase $f$ and $a$ accordingly.

We previously used the constants $f=527,a=23,s=6$, so we know that the constants $f=2108,a=92,s=8$ will also work. Luckily, these constants don't overflow `u16`, so we plug them directly into our code:

```rust
fn u5_to_u8_ma8(x: u8) -> u8 {
    debug_assert!(x < 32);
    ((x as u16 * 2108 + 92) >> 8) as u8
}
```

```asm
u5_to_u8_ma8:
        movzx   eax, dil       ; eax = x
        imul    eax, eax, 2108 ; eax = eax * 2108
        add     eax, 92        ; eax = eax + 92
        shr     eax, 8         ; eax = eax >> 8
        ret
```

Nothing interesting is going on in the assembly here, but this will change in the decoding loop of our benchmark:

```
                    low       expected       high
u5_to_u8_naive     [196.99 µs 197.75 µs 198.71 µs]
u5_to_u8_v2        [17.730 µs 17.771 µs 17.817 µs]  11.1x
u5_to_u8_unsafe    [7.2110 µs 7.2304 µs 7.2551 µs]  27.3x
u5_to_u8_safer_int [7.2187 µs 7.2372 µs 7.2576 µs]  27.3x
u5_to_u8_lut       [6.7951 µs 6.8097 µs 6.8261 µs]  29.0x
u5_to_u8_int       [5.0247 µs 5.0486 µs 5.0715 µs]  39.2x
u5_to_u8_ma        [4.5759 µs 4.5909 µs 4.6094 µs]  43.1x
u5_to_u8_ma8       [4.2081 µs 4.2210 µs 4.2356 µs]  46.8x
```

Yup, the compiler was able to take advantage of the shift by 8 and generated faster assembly for our benchmark.

I suspect that we could push it even further with some handwritten SIMD, but that's beyond the scope of this article. For now, 46x faster is good enough for me.

## Conclusion

The sky is the limit when it comes to optimizations. Hopefully some of the tricks I show-cased in this article will be useful to you in the future.

However, I also want to stress correctness **always** comes before performance. The multiply-add method may be fast, but it's almost impossible for a human to verify that the constants are correct. This can of course be [mitigated with tests](https://github.com/RunDevelopment/rounding-bench-rs/blob/b66b6baeaf06043346232f2ff24bdcbdf985be47/src/lib.rs#L67) (there are only 32 possible inputs after all), but code that isn't obviously correct is a problem in itself.

Anyway, that's it for now. I'm currently working on a follow-up article that will explain how to find the constants for the multiply-add method. Please check it out when it's ready if you're interested.

Until then, have a great day!

## Bonus: Special cases

An interesting special case arises when converting an $n$-bit unorm to a $2n$-bit unorm. Since $2^{2n}-1 = (2^n-1)(2^n+1)$, the conversion formula simplifies to:

$$
x_{2n} = x_n \cdot (2^n+1)
$$

So e.g. converting a 4-bit unorm to an 8-bit unorm is simply $x_8 = x_4 \cdot 17$. Multiplying by 17 (= 0x11) is the reason why duplicating the hex-digits of a 4-bit hex color yields the equivalent 8-bit hex color. E.g. `#F80` and `#FF8800` are the same color.

### General $n$ to $kn$-bit conversion

The special cases don't end with $2n$-bit unorms. Similar simplifications can be found for all $n$-bit to $k n$-bit conversions for any $k\in\N, k\ge 1$.

Finding the general form and proving its correctness is quite fun, so I encourage you to try it yourself. When you got it, reveal the solution below to check your work.

<details>
<summary>Hint:</summary>

Try to find what the result of $(2^{kn}-1)/(2^n-1)$ is for a few values of $k$.

</details>

<details>
<summary>Solution:</summary>

We just need to (1) show that $(2^{kn}-1)/(2^n-1)$ is always an integer and (optionally), (2) find a nice form for the quotient. Let's start by solving $(2^{kn}-1)/(2^n-1)$ for a few values of $k$ and see if we can spot a pattern. I just used [Wolfram Alpha](https://www.wolframalpha.com/input?i=simplify+%282%5E%28kn%29-1%29%2F%282%5En-1%29%2C+k%3D4) for this:

-   $k=1$: $2^n-1 = (2^n-1)(1)$
-   $k=2$: $2^{2n}-1 = (2^n-1)(1 + 2^n)$
-   $k=3$: $2^{3n}-1 = (2^n-1)(1 + 2^n + 2^{2n})$
-   $k=4$: $2^{4n}-1 = (2^n-1)(1 + 2^n + 2^{2n} + 2^{3n})$
-   $k=5$: $2^{5n}-1 = (2^n-1)(1 + 2^n + 2^{2n} + 2^{3n} + 2^{4n})$

So the pattern seems to be:

$$
2^{kn}-1 = (2^n-1) \sum_{i=0}^{k-1} 2^{in}
$$

To show that the equality holds, we just have to expand the sum:

$$
\begin{split}
2^{kn}-1 &= (2^n-1) \sum_{i=0}^{k-1} 2^{in} \\
&= 2^n \sum_{i=0}^{k-1} 2^{in} - \sum_{i=0}^{k-1} 2^{in} \\
&= \sum_{i=1}^{k} 2^{in} - \sum_{i=0}^{k-1} 2^{in} \\
&= 2^{kn} - 1 \\
\end{split}
$$

We can now use this result and plug it into the conversion formula:

$$
\begin{split}
x_{k n} &= round(x_n \cdot \frac{2^{k n} - 1}{2^n - 1}) \\
x_{k n} &= round(\underbrace{x_n \cdot \sum_{i=0}^{k-1} 2^{in}}_{\text{obviously an integer}}) \\
x_{k n} &= x_n \cdot \sum_{i=0}^{k-1} 2^{in}
\end{split}
$$

And that's the general $n$-bit unorm to $k n$-bit unorm conversion formula.

Note that the factorization for $2^{kn}-1$ we just found is the reason why [Mersenne primes](https://en.wikipedia.org/wiki/Mersenne_prime) are necessarily of the form $2^p-1$ (where $p$ is prime).

</details>
