---
datePublished: 2024-08-04
inlineCodeLanguage: rust
tags: rust floating-point
image: ./images/ds3-m32-2024-08-06.jpg
color: "#c9a061"
---

# Optimizing rounded f32-to-int conversion

I recently came across a problem where I needed to convert a 5-bit unorm to a 8-bit unorm. "Unorm" means **u**nsigned **norm**alized integer. The idea is to represent a real number 0 to 1 as an integer 0 to $2^n-1$, where $n$ is the number of bits used to represent the integer.

Maybe the most widespread application of unorms are colors in computer graphics. If you ever opened Photoshop, Gimp, or some other image editing program, you likely saw that the color picker in these programs shows RGB colors with values between 0 and 255. Those are 8-bit unorms. The same goes for colors on the web. E.g. the CSS color `rgb(255 128 0)` is the same color as `rgb(100% 50% 0%)` (ignoring a slight rounding error), and the hex color `#FF8800` (decimal: 255 136 0) is the same as `#F80` (decimal: 15 8 0).

The real-numbered value of an $n$-bit unorm $x_n \in \set{0, ...,2^n-1}$ is calculated as $x_n / (2^n-1)$. It follows that converting an $n$-bit unorm to an $m$-bit unorm is:

$$
x_m = round(x_n \cdot \frac{2^m - 1}{2^n - 1})
$$

(Rounding is necessary to get integer values.)

Here's a naive Rust implementation for converting a 5-bit unorm to an 8-bit unorm:

```rust
fn u5_to_u8_naive(x: u8) -> u8 {
    debug_assert!(x < 32);
    let factor = 255.0 / 31.0;
    (x as f32 * factor).round() as u8
}
```

<div class="info">

<details>
<summary>
For those unfamiliar with Rust:
</summary>

-   `u8` is an **8**-bit **u**nsigned integer.
-   `f32` is a **32**-bit **f**loating point number.
-   `expr as T` is a cast between primitive types (`(T) expr` in C).
-   `fn` is the keyword for [defining a function](https://doc.rust-lang.org/book/ch03-03-how-functions-work.html) and `-> T` annotates the return type.
-   The last expression in a function body is the return value of the function.
-   `let` is defines a variable.
-   `debug_assert!` checks a condition at runtime and stops the program if it's false. The check is only performed in debug and test builds.
-   `expr.round()` rounds a floating point number the nearest integer. In Rust, `round` and other floating point operations are instance methods on the `f32` type. (Although you can also call these methods statically, e.g. `f32::round(expr)`.)

I will explain more Rust-specific syntax/concepts/oddities as them come up. Otherwise, Rust generally has a C-like syntax and semantics, so if something looks like C, it will most likely behave like it too (minus any undefined behavior).

</details>

</div>

<div class="side-note">

Unfortunately, Rust doesn't have a `u5` type, so `u8` + `debug_assert!` will have to do. I yearn for the day when Rust allows me to express integer types with arbitrary bit widths. (Or even better, arbitrary ranges like 0 to 100, but that day will likely never come...)

</div>

While this function works correctly and gets the job done, it's not great performance-wise. In this article, we will optimize the floating-point operations in this function as much as possible, and learn about Rust and compiler optimizations along the way.

(Note that goal of this article is **not** to get the fastest possible conversion from a 5-bit unorm to an 8-bit unorm, which is done with integer arithmetic. This will be the topic of a future article (stay tuned). This article is purely about optimizing floating-point operations.)

## Benchmarking

Before we start optimizing, let's define a benchmark. I'm going to use a simplified version of my real-world use case: [DDS](https://en.wikipedia.org/wiki/DirectDraw_Surface) `B5G5R5A1_UNORM` images. DDS can store images in a variety of formats, and `B5G5R5A1_UNORM` is an uncompressed RGBA format that stores the RGB channels as 5-bit unorms each and the alpha as a 1-bit unorm (colloquially called a "bit"). The benchmark consists of decoding the pixel data of a 64x64px `B5G5R5A1_UNORM` image to 8-bit RGBA.

TODO: Full Source code for the benchmarks

Link to full benchmark code (including all optimized variants of the unorm conversion) can be found on my GitHub. All benchmarks in this article were performed with [`criterion`](https://bheisler.github.io/criterion.rs/book/criterion_rs.html) and with the following environment:

-   OS: Windows 10
-   CPU: Intel(R) Core(TM) i7-8700K CPU @ 3.70GHz
-   Rust: 1.78.0

Here is the result for the naive implementation:

```
                    low       expected       high
u5_to_u8_naive     [109.47 µs 110.04 µs 110.68 µs]
```

<div class="info">

`criterion` reports a [confidence interval](https://bheisler.github.io/criterion.rs/book/user_guide/command_line_output.html#time). The left and right values are the lower and upper bounds of the interval, respectively. `criterion` is 95% confident that the real per-iteration runtime is inside this interval. The center value is `criterion`'s best estimate of the actual runtime per iteration.

**Use the center value** for a simple way to compare the performance of different implementations.

</div>

## Rounding without `round`

Let's start by taking a look at the assembly generated by the naive implementation. I'm using [compiler explorer](<https://godbolt.org/#g:!((g:!((g:!((h:codeEditor,i:(filename:'1',fontScale:14,fontUsePx:'0',j:1,lang:rust,selection:(endColumn:1,endLineNumber:7,positionColumn:1,positionLineNumber:7,selectionStartColumn:1,selectionStartLineNumber:7,startColumn:1,startLineNumber:7),source:'%23%5Bno_mangle%5D%0Apub+fn+u5_to_u8_naive(x:+u8)+-%3E+u8+%7B%0A++++debug_assert!!(x+%3C+32)%3B%0A++++let+factor+%3D+255.0+/+31.0%3B%0A++++(x+as+f32+*+factor).round()+as+u8%0A%7D%0A%0Afn+main()+%7B%7D%0A'),l:'5',n:'1',o:'Rust+source+%231',t:'0')),k:46.58379142816912,l:'4',n:'0',o:'',s:0,t:'0'),(g:!((g:!((h:compiler,i:(compiler:r1780,filters:(b:'0',binary:'1',binaryObject:'1',commentOnly:'1',debugCalls:'1',demangle:'0',directives:'0',execute:'1',intel:'0',libraryCode:'0',trim:'1',verboseDemangling:'0'),flagsViewOpen:'1',fontScale:14,fontUsePx:'0',j:1,lang:rust,libs:!(),options:'-C+opt-level%3D2',overrides:!((name:edition,value:'2021')),selection:(endColumn:1,endLineNumber:1,positionColumn:1,positionLineNumber:1,selectionStartColumn:1,selectionStartLineNumber:1,startColumn:1,startLineNumber:1),source:1),l:'5',n:'0',o:'+rustc+1.78.0+(Editor+%231)',t:'0')),k:53.41620857183087,l:'4',m:50,n:'0',o:'',s:0,t:'0'),(g:!((h:executor,i:(argsPanelShown:'1',compilationPanelShown:'0',compiler:r1780,compilerName:'',compilerOutShown:'0',execArgs:'',execStdin:'',fontScale:14,fontUsePx:'0',j:1,lang:rust,libs:!(),options:'',overrides:!((name:edition,value:'2021')),runtimeTools:!(),source:1,stdinPanelShown:'1',wrap:'1'),l:'5',n:'0',o:'Executor+rustc+1.78.0+(Rust,+Editor+%231)',t:'0')),header:(),l:'4',m:50,n:'0',o:'',s:0,t:'0')),k:53.41620857183087,l:'3',n:'0',o:'',t:'0')),l:'2',n:'0',o:'',t:'0')),version:4>) for this.

(I will add comments for all relevant instructions, so deep knowledge of assembly is **not** required to follow along. You just need to know that registers (e.g. `rax`, `xmm0`) are like global variables that we can do math on.)

```rust link=run
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

As we can see, the assembly is a fairly literal translation of our source code. The compiler just removed the `debug_assert!` and precomputed `255.0 / 31.0`. There are two things that stick out however:

1. `round` is a function call. Apparently, there is no instruction for rounding, so it has to be done in software.
2. The `minss` and `maxss` instructions. These are used to clamp the floating-point value to the range 0-255 before converting it to an integer.

We'll start with call to `round`.

Mathematically speaking, rounding a real number $r \in \R$ to the nearest integer is defined as:

$$
round(r) = \begin{cases}
    \lfloor r + 0.5 \rfloor & \text{if } r \ge 0 \\
    \lceil r - 0.5 \rceil & \text{otherwise}
\end{cases}
$$

<div class="side-note">

Implementing this formula in code might _seems_ straightforward, but floating-point numbers only have a finite precision, so adding/subtracting 0.5 will return a _rounded_ result. All assertions in the following code will pass:

```rust runnable
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

So always be careful when implementing mathematical formulas when floating-point numbers are involved.

</div>

Since `u5_to_u8_naive` only rounds non-negative numbers, we can simplify the formula to remove the branch.

$$
round(r) = \lfloor r + 0.5 \rfloor, \space r\ge 0
$$

And now for the main trick: Rust guarantees that [`as u8` truncates](https://doc.rust-lang.org/reference/expressions/operator-expr.html#numeric-cast) the floating-point number. Since $trunc(r) = \lfloor r \rfloor$ for all $r \ge 0$, we can replace `r.round() as u8` with `(r + 0.5) as u8` in our code:

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
u5_to_u8_naive     [109.47 µs 110.04 µs 110.68 µs]
u5_to_u8_v2        [18.961 µs 18.980 µs 19.002 µs]
```

That's a generous 5.8x speedup. Simply by avoiding the call to `f32::round`, we are now decoding DDS images almost 6x faster. Not bad.

## Faster with `unsafe`

Next, we'll get rid of the clamping.

Rust clamps to the range 0-255 to guarantee safety in the general case. So e.g. `300_f32 as u8` will return `255_u8`. This is unlike C/C++, where **no** clamping is performed and converting floating-point values that cannot be represented by the target integer type is _undefined behavior_ (UB). So e.g. `(uint8_t) 300.0f` in C is UB.

However, the clamping is entirely unnecessary in our case. Since we know that the input value `x` for the 5 bit to 8 bit conversion is between 0 and 31, we know that the floating-point value being converted will always be between 0.5 and 255.5. Since `as u8` truncates, the floating-point value will always be in-range for `u8`.

Luckily, Rust has a way out. We can use [`f32::to_int_unchecked`](https://doc.rust-lang.org/std/primitive.f32.html#method.to_int_unchecked) to perform the integer conversion without clamping. This function also comes with the same UB as the cast in C, so we need to use `unsafe`.

<div class="info">

<details>
<summary>
For those unfamiliar with Rust:
</summary>

`unsafe` is a keyword with 2 functions:

1. It allows the programmer to opt-in to use certain operations that the compiler cannot prove are safe.
2. It marks functions as unsafe to call, meaning that the caller must ensure that the function is used correctly.

</details>

</div>

```rust
/// ## Safety
/// The caller must ensure `x < 32`.
unsafe fn u5_to_u8_unsafe(x: u8) -> u8 {
    debug_assert!(x < 32);
    let factor = 255.0 / 31.0;
    let f = x as f32 * factor + 0.5;
    unsafe { f.to_int_unchecked() }
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
u5_to_u8_naive     [109.47 µs 110.04 µs 110.68 µs]
u5_to_u8_v2        [18.961 µs 18.980 µs 19.002 µs]
u5_to_u8_unsafe    [7.7393 µs 7.7559 µs 7.7811 µs]
```

That's 2.45x faster than the previous version, and 14.2x faster than the naive implementation.

Unfortunately, the function must be marked as `unsafe`, because it _will cause undefined behavior_ if given a value `x >= 32`. This makes the function harder to use, as a small mistake can invalidate all of Rust's safety guarantees.

## Safer `unsafe`

`u5_to_u8_unsafe` is only `unsafe`, because converting values of `x >= 32` will result in values too large for `u8`, which in turn is UB for `f32::to_int_unchecked`. E.g. `x = 62` will result in `f = 511.5`, which is too large for `u8`. (Remember, the `debug_assert!` is removed in release builds, so it doesn't guarantee safety.)

So how about we bring back the `min` part of the clamping Rust did?

```rust
fn u5_to_u8_safer(x: u8) -> u8 {
    debug_assert!(x < 32);
    let factor = 255.0 / 31.0;
    let f = x as f32 * factor + 0.5;
    let g = f.min(255.0);
    // SAFETY: `g` is guaranteed to be between 0.5 and 255.0
    unsafe { g.to_int_unchecked() }
}
```

Since `g` is now guaranteed to be between 0.5 and 255, `f32::to_int_unchecked` won't cause UB anymore. Since no input passed to `u5_to_u8_safer` can cause UB, we can remove the `unsafe` keyword from the function. Callers of the function no longer have to worry about UB, which is a win for safety.

But enough about UB and safety. Let's look at the assembly and see how it performs:

```asm
.LCPI0_0:
        .long   0x41039ce7 ; 8.22580624 (f32)
.LCPI0_1:
        .long   0x3f000000 ; 0.5 (f32)
.LCPI0_2:
        .long   0x437f0000 ; 255.0 (f32)
u5_to_u8_safer:
        movzx   eax, dil
        cvtsi2ss        xmm0, eax                ; xmm0 = x to f32
        mulss   xmm0, dword ptr [rip + .LCPI0_0] ; xmm0 = xmm0 * 8.22580624 (= 255/31)
        addss   xmm0, dword ptr [rip + .LCPI0_1] ; xmm0 = xmm0 + 0.5
        minss   xmm0, dword ptr [rip + .LCPI0_2] ; xmm0 = min(xmm0, 255.0)  | as u8
        cvttss2si       eax, xmm0                ; convert xmm0 to int      |
        ret
```

```
                    low       expected       high
u5_to_u8_naive     [109.47 µs 110.04 µs 110.68 µs]
u5_to_u8_v2        [18.961 µs 18.980 µs 19.002 µs]
u5_to_u8_unsafe    [7.7393 µs 7.7559 µs 7.7811 µs]
u5_to_u8_safer     [8.2983 µs 8.3108 µs 8.3241 µs]
```

Expectedly, it's a bit slower than `u5_to_u8_unsafe`.

However, the surprising part is that it's more than 2x faster than `u5_to_u8_v2`. Considering that the only difference between `u5_to_u8_v2` and `u5_to_u8_safer` is that we removed the `max` part of the clamping, this huge impact on performance is unexpected. Obviously, `min` and `max` have similar performance (both are a single instruction), so why does removing a single `max` operation make everything so much faster?

I believe the answer is a mix of vectorization and data dependencies. Since our benchmark decodes pixels in a tight loop. This means that we not only measure the performance of our `u5_to_u8_*` functions, but also how much the loop can be vectorized and how well the CPU can execute the instructions in parallel.

Let's take a look at the loop we're benchmarking:

```rust
fn decode(to_decode: &[u16], output: &mut [[u8; 4]], u5_to_u8: impl Fn(u8) -> u8) {
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

#[inline(always)]
fn u1_to_u8(x: u8) -> u8 {
    debug_assert!(x < 2);
    x * 255
}
```

Since `u5_to_u8_v2` needs more floating-point registers because of the `max` operation (2 `xmm*` instead of 1 for `u5_to_u8_safer`), there are naturally more data dependencies, and the compiler has less registers to work with in the unrolled loop. I believe that this causes less efficient auto-vectorization and more data dependencies, causing the CPU to execute instructions in parallel less often.

So while the cost of the `max` operation is small, it prevents other optimizations from happening, which is the real problem.

TODO: asd

## Complaining about the compiler

Given how much performance can be gained from removing a single `max` operation, it's the shame the compiler can't optimize the safe code we wrote. Just to reiterate, here's the safe version:

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

The compiler knows that `x: u16` implies that `x >= 0`. So it could have known that `x as f32 * factor + 0.5` is always `>= 0.5`, and thus that the `max` part of the clamping is unnecessary.

This can be implemented in the compiler by tracking the range of floating-point values (similar to a known-bit analysis). Given that range information can also be used to optimize other code, I'm not sure why the compiler seemingly doesn't implement it.

It's somewhat disappointing that the main obstacle towards performant safe numeric conversions is the compiler's inability to reason about floating-point numbers. While floating-point optimizations are, of course, a can of worms best left unopened, a range analysis with generous error bounds seems simple enough for the compiler to handle.

## `unsafe` performance, but safer

While the compiler is a little dumb when it comes to floating-point optimization, compilers are **_really_** good at optimizing integer operations, especially bitwise operations. Instead of performing a `min` operation on the floating-point value like in `u5_to_u8_safer`, we clamp the value of `x` before converting to floating-point. Like this:

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

The trick here is that `x %= 32` ensures that `x` is always between 0 and 31. This is the guarantee we needed to turn the `unsafe fn` into a (safe) `fn`.

The real trick however is how the compiler optimizes the function. One of the most basic integer optimizations compilers do is to replace $x \bmod 2^n$ with $x \text{ \& } (2^n-1)$ (bitwise AND). So `x % 32` is replaced with `x & 31` (or `x & 0x1F`).

But that's not all. Remember the actual code we benchmark:

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

The values we pass to our `u5_to_u8_*` function are already anded with `0x1F`, so the compiler can optimize away the `x % 32` operation entirely in our benchmark. This gives us the exact same performance as `u5_to_u8_unsafe`, but without needing to make the function itself `unsafe`.

```
                    low       expected       high
u5_to_u8_naive     [109.47 µs 110.04 µs 110.68 µs]
u5_to_u8_v2        [18.961 µs 18.980 µs 19.002 µs]
u5_to_u8_unsafe    [7.7393 µs 7.7559 µs 7.7811 µs]
u5_to_u8_safer     [8.2983 µs 8.3108 µs 8.3241 µs]
u5_to_u8_safer_int [7.7393 µs 7.7559 µs 7.7811 µs]
```

## Conclusion

While it's great the we matched the performance of `u5_to_u8_unsafe` with a safe function, it's a shame that `unsafe` was required in the first place. In our benchmark, the compiler knows that the value passed to `u5_to_u8_v2` is always between 0 and 31, so the compiler could have removed the clamping operation entirely, giving us the same performance as `u5_to_u8_unsafe` right from the start, in pure safe Rust code.

## Bonus: Special cases

An interesting special case arises when converting an $n$-bit unorm to a $2n$-bit unorm. Since $2^{2n}-1 = (2^n-1)(2^n+1)$, the conversion formula simplifies to:

$$
x_{2n} = x_n \cdot (2^n+1)
$$

So e.g. converting a 4-bit unorm to an 8-bit unorm is simply $x_8 = x_4 \cdot 17$. Multiplying by 17 (= 0x11) is the reason why duplicating the hex-digits of a 4-bit hex color yields the equivalent 8-bit hex color. E.g. `#F80` and `#FF8800`.

### General $n$ to $kn$-bit conversion

The special cases don't even with $2n$-bit unorms. Similar simplifications can be found for all $n$-bit to $k n$-bit conversions for any $k\in\N, k\ge 1$.

Finding the general form and proving its correctness is quite fun, so I encourage you to try it yourself. When you got it, reveal the solution below to check your work.

<details>
<summary>Hint:</summary>

Try to find what the result of $(2^{kn}-1)/(2^n-1)$ is for a few values of $k$.

</details>

<details>
<summary>Solution:</summary>

We just need to (1) show that $(2^{kn}-1)/(2^n-1)$ is always an integer and (optionally, 2) find a nice form for the quotient. Let's starts by solving $(2^{kn}-1)/(2^n-1)$ for a few values of $k$ and see if we can spot a pattern. I just used [Wolfram Alpha](https://www.wolframalpha.com/input?i=simplify+%282%5E%28kn%29-1%29%2F%282%5En-1%29%2C+k%3D4) for this:

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
&= (2^n-1) \cdot (1+2^n+...+2^{(k-1)n}) \\
&= 2^n (1+2^n+...+2^{(k-1)n}) - (1+2^n+...+2^{(k-1)n}) \\
&= (2^n+2^{2n}+...+2^{kn}) - (1+2^n+...+2^{(k-1)n}) \\
&= 2^{kn} - 1
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
