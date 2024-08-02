---
datePublished: 2024-07-04
draft: true
inlineCodeLanguage: rust
---

# Optimizing rounded f32-to-int conversion

I recently came across a problem where I needed to convert a 5-bit unorm to a 8-bit unorm. "Unorm" means **u**nsigned **norm**alized integer. The idea is to represent a real number 0 to 1 as an integer 0 to $2^n-1$, where $n$ is the number of bits used to represent the integer.

Maybe the most widespread application of unorms are colors in computer graphics. If you ever opened Photoshop, Gimp, or some other image editing program, you likely saw that the color picker in these programs shows RGB colors with values between 0 and 255. Those are 8-bit unorms. The same goes for colors on the web. E.g. the CSS color `rgb(255 128 0)` is the same color as `rgb(100% 50% 0%)` (ignoring a slight rounding error), and the hex color `#FF8800` (decimal: 255 136 0) is the same as `#F80` (decimal: 15 8 0).

The real-numbered value of an $n$-bit unorm $x_n \in\N, 0 \le x \le 2^n-1$ is calculated as $x_n / (2^n-1)$. It follows that converting an $n$-bit unorm to an $m$-bit unorm is:

$$
x_m = round(x_n \cdot \frac{2^m - 1}{2^n - 1})
$$

(Rounding is necessary to get integer values.)

<div class="side-note">

An interesting special case arises when converting an $n$-bit unorm to a $2n$-bit unorm. Since $2^{2n}-1 = (2^n-1)(2^n+1)$, the formula simplifies to:

$$
x_{2n} = x_n \cdot (2^n+1)
$$

Proving that similar special cases exist for converting any $n$-bit unorm to any $k n$-bit unorm for any $k\in\N, k\ge 1$ is left as a fun exercise to the reader. If you got it and want to check your result, reveal the solution below. (This has nothing to do with the article.)

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

We'll note that this equation is trivially true for $k=1$ as the sum simply becomes $2^{0n} = 1$. The rest, so $k \ge 2$, can be shown via induction. Let's rearrange the equation for $2^{kn}$:

$$
2^{kn} = 1+ (2^n-1) \sum_{i=0}^{k-1} 2^{i n}
$$

Proof by induction:

-   Base: $k=2$
    $$
    \begin{split}
    2^{2n} &= 1+ (2^n-1) \sum_{i=0}^{1} 2^{i n} \\
           &= 1+ (2^n-1)(1+2^n) \\
           &= 1+ 2^{2n} - 1 \\
           &= 2^{2n} \\
    \end{split}
    $$
-   Step: Assuming the equation is valid for a value of $k$, then it is also valid for $k+1$:

    $$
    \begin{split}
    2^{kn} &= 1+ (2^n-1) \sum_{i=0}^{k-1} 2^{i n} \\
    2^n \cdot 2^{kn}  &= 2^n \cdot (1+ (2^n-1) \sum_{i=0}^{k-1} 2^{i n}) \\
    2^{(k+1)n}  &= 2^n \cdot (1+ (2^n-1) (1 + 2^n +...+2^{(k-1)n}) ) \\
           &= 2^n + 2^n (2^n-1) (1 + 2^n +...+2^{(k-1)n} ) \\
           &= 2^n + (2^n-1) (2^n + 2^{2n} +...+2^{kn} ) \\
           &= 1 + (2^n - 1) + (2^n-1) (2^n + 2^{2n} +...+2^{kn} ) \\
           &= 1 + (2^n - 1) (1 + 2^n + 2^{2n}+...+2^{kn} ) \\
           &= 1 + (2^n - 1) \sum_{i=0}^{(k+1)-1} 2^{i n}
    \end{split}
    $$

    $\square$

We can now use this result and plug it into the conversion formula:

$$
\begin{split}
x_{k n} &= round(x_n \cdot \frac{2^{k n} - 1}{2^n - 1}) \\
x_{k n} &= round(\underbrace{x_n \cdot \sum_{i=0}^{k-1} 2^{in}}_{\text{obviously an integer}}) \\
x_{k n} &= x_n \cdot \sum_{i=0}^{k-1} 2^{in}
\end{split}
$$

And that's the general $n$-bit unorm to $k n$-bit unorm conversion formula.

Too bad this has nothing to do with the topic of the article. It's cool and all, but this article is about... erm... Come to think of it, I haven't even introduced the main topic yet, have I? Well, whatever it was, let's get back to it!

</details>

</div>

Special cases aside, the general formula is quite straightforward to implement. Here's a naive Rust implementation for converting a 5-bit unorm to an 8-bit unorm:

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
-   `let` is used to declare/define immutable variables. They can optionally be type annotated with `let name: T`.
-   `debug_assert!` checks a condition at runtime and stops the program if it's false. The check is only performed in debug and test builds.
-   `expr.round()` rounds a floating point number the nearest integer. In Rust, `round` and other floating point operations are instance methods on the `f32` type.

I will explain more Rust-specific syntax/concepts/oddities as them come up. Otherwise, Rust generally has a C-like syntax and semantics, so if something looks like C, it will most likely behave like it too (minus any undefined behavior).

</details>

</div>

This works correctly and gets the job done, but it's not so great performance-wise. In this article, we'll use this function as the basis for a series of optimizations to get the operation `f.round() as u8` as fast as possible.

Note that goal of this article is **not** to get the fastest possible conversion from a 5-bit unorm to an 8-bit unorm. This will be the topic of a future article (stay tuned). This article is purely about optimizing the `f.round() as u8` operation.

## Contents

## Benchmarking

Before we start optimizing, let's define a benchmark. I'm going to use a simplified version of my real-world use case: DDS B5G5R5A1_UNORM images. [DDS](https://en.wikipedia.org/wiki/DirectDraw_Surface) (DirectDraw Surface) is a container format for images used in DirectX, OpenGL, and other graphics APIs. It can store multiple versions of a texture (mipmaps) in a single file and supports a variatey of different formats to store the pixel data. B5G5R5A1_UNORM stores the RGB channels as 5 unorms each and the alpha as a 1-bit unorm (also called: "a bit"). The benchmark will be to convert a `[u16; 256]` to a `[[u8; 4]; 256]`. This is roughly equivalent to decoding a 16x16 B5G5R5A1_UNORM texture to 8-bit RGBA. Here's the code we'll benchmark:

```rust
fn convert<const N: usize>(
    to_decode: &[u16; N],
    u5_to_u8: impl Fn(u8) -> u8,
) -> [[u8; 4]; N] {
    to_decode.map(|&bgra| {
        let b5 = bgra & 0x1F;
        let g5 = (bgra >> 5) & 0x1F;
        let r5 = (bgra >> 10) & 0x1F;
        let a1 = (bgra >> 15) & 0x1;

        [
            u5_to_u8(r5 as u8),
            u5_to_u8(g5 as u8),
            u5_to_u8(b5 as u8),
            u1_to_u8(a1 as u8),
        ]
    })
}

#[inline(always)]
fn u1_to_u8(x: u8) -> u8 {
    debug_assert!(x < 2);
    x * 255
}
```

<div class="info">

<details>
<summary>
For those unfamiliar with Rust:
</summary>

-   `[u16; N]` is an array with exactly `N` elements of type `u16`.
-   `&[u16; N]` is a reference to an array, called a slice.
-   `u5_to_u8: impl Fn(u8) -> u8` means that the parameter `u5_to_u8` is a function that takes a `u8` and returns a `u8`. The `impl` keyword is just a quick way to define generics to allow the compiler to inline the function.

</details>

</div>

Since the function is generic over different `u5_to_u8` functions, we can easily benchmark different implementations. The `u1_to_u8` function is included to show that the performance of the `u5_to_u8` function is the bottleneck.

Link to full benchmark code (including all optimized variants of the unorm conversion) can be found on my GitHub. All benchmarks in this article were performed with [`criterion`](https://bheisler.github.io/criterion.rs/book/criterion_rs.html) and with the following environment:

-   OS: Windows 10
-   CPU: Intel(R) Core(TM) i7-8700K CPU @ 3.70GHz
-   Rust: 1.78.0

Here is the result for the naive implementation:

```
                    low       expected       high
u5_to_u8_naive     [11.108 µs 11.147 µs 11.195 µs]
```

<div class="info">

`criterion` reports a [confidence interval](https://bheisler.github.io/criterion.rs/book/user_guide/command_line_output.html#time). The left and right values are the lower and upper bounds of the interval, respectively. `criterion` is 95% confident that the real per-iteration runtime is inside this interval. The center value is `criterion`'s best estimate of the actual runtime per iteration.

**Use the center value** for a simple way to compare the performance of different implementations.

</div>

The standard size for textures in modern games became 1024x1024 some years ago. Scaling up to this size, the naive implementation would take around ? ms to decode a single 1024x1024 texture. That's pretty bad considering that modern games need to load around 1000 textures before they can render a single frame. Nobody wants to wait half a minute for a game to load.

TODO: Source code for the benchmarks

## Rounding without `round`

Let's start by taking a look at the assembly generated by the naive implementation. I'm using [compiler explorer](<https://godbolt.org/#g:!((g:!((g:!((h:codeEditor,i:(filename:'1',fontScale:14,fontUsePx:'0',j:1,lang:rust,selection:(endColumn:1,endLineNumber:7,positionColumn:1,positionLineNumber:7,selectionStartColumn:1,selectionStartLineNumber:7,startColumn:1,startLineNumber:7),source:'%23%5Bno_mangle%5D%0Apub+fn+u5_to_u8_naive(x:+u8)+-%3E+u8+%7B%0A++++debug_assert!!(x+%3C+32)%3B%0A++++let+factor+%3D+255.0+/+31.0%3B%0A++++(x+as+f32+*+factor).round()+as+u8%0A%7D%0A%0Afn+main()+%7B%7D%0A'),l:'5',n:'1',o:'Rust+source+%231',t:'0')),k:46.58379142816912,l:'4',n:'0',o:'',s:0,t:'0'),(g:!((g:!((h:compiler,i:(compiler:r1780,filters:(b:'0',binary:'1',binaryObject:'1',commentOnly:'1',debugCalls:'1',demangle:'0',directives:'0',execute:'1',intel:'0',libraryCode:'0',trim:'1',verboseDemangling:'0'),flagsViewOpen:'1',fontScale:14,fontUsePx:'0',j:1,lang:rust,libs:!(),options:'-C+opt-level%3D2',overrides:!((name:edition,value:'2021')),selection:(endColumn:1,endLineNumber:1,positionColumn:1,positionLineNumber:1,selectionStartColumn:1,selectionStartLineNumber:1,startColumn:1,startLineNumber:1),source:1),l:'5',n:'0',o:'+rustc+1.78.0+(Editor+%231)',t:'0')),k:53.41620857183087,l:'4',m:50,n:'0',o:'',s:0,t:'0'),(g:!((h:executor,i:(argsPanelShown:'1',compilationPanelShown:'0',compiler:r1780,compilerName:'',compilerOutShown:'0',execArgs:'',execStdin:'',fontScale:14,fontUsePx:'0',j:1,lang:rust,libs:!(),options:'',overrides:!((name:edition,value:'2021')),runtimeTools:!(),source:1,stdinPanelShown:'1',wrap:'1'),l:'5',n:'0',o:'Executor+rustc+1.78.0+(Rust,+Editor+%231)',t:'0')),header:(),l:'4',m:50,n:'0',o:'',s:0,t:'0')),k:53.41620857183087,l:'3',n:'0',o:'',t:'0')),l:'2',n:'0',o:'',t:'0')),version:4>) for this. (I added comments for all relevant instructions, so experience with assembly is not required to follow along.)

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

As we can see, the assembly is a fairly literal translation of our source code. The compiler just removed the `debug_assert!` and precomputed the factor `255.0 / 31.0`. There are two things that stick out however:

1. `round` is a function call. Apparently, there is no instruction for rounding, so it has to done in software.
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

Since `u5_to_u8_naive` only calls round for non-negative numbers, we can simplify the formula to remove the branch.

$$
round(r) = \lfloor r + 0.5 \rfloor, \space r\ge 0
$$

And now for the main trick: Rust guarantees that [`as u8` truncates](https://doc.rust-lang.org/reference/expressions/operator-expr.html#numeric-cast) the floating-point number. Since $trunc(r) = \lfloor r \rfloor$, we replace `r.round() as u8` with `(r + 0.5) as u8` in our code:

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
u5_to_u8_naive     [11.108 µs 11.147 µs 11.195 µs]
u5_to_u8_v2        [1.3806 µs 1.3848 µs 1.3898 µs]
```

That's a generous 8x speedup. `round` was pretty expensive.

## Faster with `unsafe`

Next, we'll get rid of the clamping.

Rust clamps to the range 0-255 to guarantee safety in the general case. So e.g. `300_f32 as u8` will return `255_u8`. This is unlike C/C++, where no clamping is performed and converting floating-point values that cannot be represented by the target integer type is undefined behavior. So e.g. `(uint8_t) 300.0f` in C is UB.

However, the clamping is entirely unnecessary in our case. Since we know that the input value `x` for the 5 bit to 8 bit conversion is between 0 and 31, we know that the floating-point value being converted will always be between 0.5 and 255.5. Since `as u8` truncates, the floating-point value will always be in-range for `u8`.

Luckily, Rust has a way out. We can use [`f32::to_int_unchecked`](https://doc.rust-lang.org/std/primitive.f32.html#method.to_int_unchecked) to perform the integer conversion without clamping. This function also comes with the same undefined behavior as C, so we need to use `unsafe`.

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
    let f = x as f32 * (255.0 / 31.0) + 0.5;
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
u5_to_u8_naive     [11.108 µs 11.147 µs 11.195 µs]
u5_to_u8_v2        [1.3806 µs 1.3848 µs 1.3898 µs]
u5_to_u8_unsafe    [614.04 ns 615.98 ns 618.32 ns]
```

That's 2.25x faster than the previous version, and 18x faster than the naive implementation.

Unfortunately, the function is `unsafe` will cause undefined behavior if used incorrectly. This makes the function harder to use, as a small mistake can lead to a crash _in the best case_.

## Complaining about LLVM code gen

I want to briefly return to the assembly LLVM generated for the previous safe version:

```rust
fn u5_to_u8_v2(x: u8) -> u8 {
    debug_assert!(x < 32);
    (x as f32 * (255.0 / 31.0) + 0.5) as u8
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

This assembly is suboptimal. The `movss` could have easily been avoided with a slightly smarter use of registers. This is the type of low-level micro-optimization that compilers should excel at, so I don't understand why LLVM missed it here.

```asm
u5_to_u8e_v2:
        movzx   eax, dil
        cvtsi2ss        xmm1, eax                ; xmm0 = x to f32
        mulss   xmm0, dword ptr [rip + .LCPI0_0] ; xmm0 = xmm0 * 8.22580624 (= 255/31)
        addss   xmm0, dword ptr [rip + .LCPI0_1] ; xmm0 = xmm0 + 0.5
        xorps   xmm1, xmm1                       ; xmm1 = 0.0              \
        maxss   xmm0, xmm1                       ; xmm0 = max(xmm0, xmm1)   |
        minss   xmm0, dword ptr [rip + .LCPI0_2] ; xmm0 = min(xmm0, 255.0)  | as u8
        cvttss2si       eax, xmm0                ; convert xmm0 to int     /
        ret
```

But that's not all. A sufficiently smart compiler could have optimized away the `maxss` and `xorps` as well.

The compiler knows that `x: u16` implies that `x >= 0`. So it could have known that `x as f32 * (255.0 / 31.0) + 0.5` is always `>= 0.5`, and thus the `max(0, num)` part of the clamping is unnecessary. Removing the `max(0, z)` part would have allowed the compiler to remove the `xorps` and `maxss` instructions like so:

```asm
u5_to_u8_v2:
        movzx   eax, dil
        cvtsi2ss        xmm1, eax                ; xmm0 = x to f32
        mulss   xmm0, dword ptr [rip + .LCPI0_0] ; xmm0 = xmm0 * 8.22580624 (= 255/31)
        addss   xmm0, dword ptr [rip + .LCPI0_1] ; xmm0 = xmm0 + 0.5
        minss   xmm0, dword ptr [rip + .LCPI0_2] ; xmm0 = min(xmm0, 255.0)  | as u8
        cvttss2si       eax, xmm0                ; convert xmm0 to int      |
        ret
```

Note that this is only a single instruction more than optimized `unsafe` floating-point conversion.

It's somewhat disappointing that the main obstacle towards performant safe numeric conversions is the compiler's inability to reason about floating-point numbers. While floating-point optimizations are, of course, a can of worms best left unopened, this seems simple enough for the compiler to handle.

## Safer `unsafe`

As discussed above, the only difference between the hand-optimized assembly of the safe version and the generated assembly of the `unsafe` version is the `min` operation. So what if we just add a `min` operation to the `unsafe` version?

```rust
fn u5_to_u8_safer(x: u8) -> u8 {
    debug_assert!(x < 32);
    let f = x as f32 * (255.0 / 31.0) + 0.5;
    let g = f.min(255.0);
    unsafe { g.to_int_unchecked() }
}
```

The main advantage of this version is that it's safer. Since `g` is always in the range 0.5 to 255, `to_int_unchecked` can never cause UB. This means that the caller doesn't need to worry about the function causing UB, which is a big plus.

The generated assembly should look familiar:

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

Let's see how it performs:

```
                    low       expected       high
u5_to_u8_naive     [11.108 µs 11.147 µs 11.195 µs]
u5_to_u8_v2        [1.3806 µs 1.3848 µs 1.3898 µs]
u5_to_u8_unsafe    [614.04 ns 615.98 ns 618.32 ns]
u5_to_u8_safer     [???]
```

Expectedly, it falls between `u5_to_u8_v2` and `u5_to_u8_unsafe` versions. The performance is the same as the `unsafe` version, but it's safer.
