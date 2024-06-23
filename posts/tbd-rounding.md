---
datePublished: 2024-06-08
draft: true
inlineCodeLanguage: rust
---

# Rounding numbers: Old new tricks

I recently implemented a new DDS decoder for [the `image` crate](https://github.com/image-rs/image). DDS is a container format that supports a variety of image formats (compressed and uncompressed) with the purpose of storing textures, volumes, cubemaps and more for games and other 3D applications. Pretty much every game that has been released in the last 15 years uses it, so it's very wide-spread. What's interesting about DDS' image formats is that [the specification](https://microsoft.github.io/DirectX-Specs/d3d/archive/D3D11_3_FunctionalSpec.htm#Chapter19Contents) is written in terms of floating point numbers, even though color data is typically stored as n-bit integers for those formats. This presents an interesting optimization problem for decoders that output images with 8 bit per channels (`u8`/`uint8`).

One DDS image format is `B5G6R5_UNORM`, a 16-bit-per-pixel uncompressed (but quantized) RGB format. The R and B channels are 5 bits each, and the G channel is 6 bits. The most basic task of the decoder is to convert this to 8 bits per channel. The formula for converting a $n$-bit number $x$ to 8 bit is:

$$
round(\frac{x}{2^n - 1} \cdot 255)
$$

Simple enough, here's a naive Rust implementation of this formula for converting a 5-bit integer:

```rust
fn u5_to_u8_naive(x: u16) -> u8 {
    (x as f32 / 31.0 * 255.0).round() as u8
}
```

<div class="info">

For those unfamiliar with Rust:

-   `u8` is an 8-bit unsigned integer (`uint8_t` in C).
-   `f32` is a 32-bit floating point number (`float` in C).
-   `expr as T` is a cast between primitive types (`(T) expr` in C).
-   `fn` is the keyword for [defining a function](https://doc.rust-lang.org/book/ch03-03-how-functions-work.html) and `-> T` annotates the return type.
-   The last expression in a function body is the return value of the function.
-   `expr.round()` rounds a floating point number the nearest integer. \
    In Rust, `round` and other floating point operations are instance methods on the `f32` type.

I will explain more Rust-specific concepts as them come up. Otherwise, Rust generally has a C-like syntax and semantics, so if something looks like C, it will most likely behave like it too.

</div>

While talking to the maintainer of the `image` crate, he pointed me towards the direction of [the `bcdec` C library](https://github.com/iOrange/bcdec). So I took a peak at their code and found that they used the follow snippet for converting a 5-bit integer to an 8-bit integer (here, translated to Rust):

```rust
fn u5_to_u8_bcdec(x: u16) -> u8 {
    ((x * 527 + 23) >> 6) as u8
}
```

Somehow, this random collection of operations produces the same results as the naive floating point version (for all `x` between 0 and 31). The only difference is that it's about **20x** faster.

Surprised by this, I did what any sane person would do: I spend a few days analyzing both the naive and `bcdec` version, figured out how the `bcdec` version works, and then spend another few days generalizing what I found to solve a more difficult problem. Specifically, I ended up with a way to multiply an unsigned integer with an arbitrary fraction and round the result to an integer with an arbitrary rounding function. And that all is done using an expression of the form `(x * f + a) >> s`.

In this article, we will:

1. optimize the naive floating point 5-to-8-bit conversion,
2. look at rounded integer division for unsigned integers,
3. analyse the `bcdec` version of the 5-to-8-bit conversion,
4. generalize the `bcdec` version, and finally
5. beat LLVM at optimizing unsigned integer division by constant (sometimes).

The latter half will involve a lot of math, so get ready.

## Benchmarking

Before we start optimizing, let's define a benchmark.

Since there are only 32 possible input value for our 5 bit to 8 bit conversion, we'll just fill a list with 1024 random values between 0 and 31 and convert all of them. Since we're calling the conversion function in a tight loop, we're benchmarking not only the function itself, but also how well the compiler can vectorize it. This is very close to what the DDS decoder I made does, so it decently represents my real-world use case.

All benchmarks in this article were performed with `criterion` and with the following environment:

-   OS: Windows 10
-   CPU: Intel(R) Core(TM) i7-8700K CPU @ 3.70GHz
-   Rust: 1.78.0

Here are the results for the naive and `bcdec` versions. Note the **different units**.

```
                                 low       expected       high
u5_to_u8_naive          time:   [11.108 µs 11.147 µs 11.195 µs]
u5_to_u8_bcdec          time:   [527.47 ns 531.42 ns 536.16 ns]
```

<div class="info">

`criterion` reports a confidence interval instead of just the mean or median runtime per iteration. The center value is `criterion`'s best estimate of the actual runtime per iteration. **Use the center value** for a simple way to compare the performance of different implementations.

The left and right values are the lower and upper bounds of the interval, respectively. `criterion` is 95% confident that the real runtime per iteration is inside this interval.

See [`criterion`'s documentation](https://bheisler.github.io/criterion.rs/book/user_guide/command_line_output.html#time) for more information.

</div>

Yep, `u5_to_u8_bcdec` is 21.15x faster.

That our baseline, so let's try to catch up with the `bcdec` version.

TODO: Source code for the benchmarks

## Optimizing the naive implementation

Let's start by taking a look at the assembly generated by the naive implementation. I'm using [compiler explorer](<https://godbolt.org/#g:!((g:!((g:!((h:codeEditor,i:(filename:'1',fontScale:14,fontUsePx:'0',j:1,lang:rust,selection:(endColumn:1,endLineNumber:9,positionColumn:1,positionLineNumber:9,selectionStartColumn:1,selectionStartLineNumber:9,startColumn:1,startLineNumber:9),source:'%23%5Bno_mangle%5D%0Apub+fn+u5_to_u8_naive(x:+u16)+-%3E+u8+%7B%0A++++(x+as+f32+/+31.0+*+255.0).round()+as+u8%0A%7D%0A%0Afn+main()+%7B%0A++++println!!(%22%7B%7D%22,+u5_to_u8_naive(31))%3B%0A%7D%0A'),l:'5',n:'1',o:'Rust+source+%231',t:'0')),k:46.58379142816912,l:'4',n:'0',o:'',s:0,t:'0'),(g:!((g:!((h:compiler,i:(compiler:r1780,filters:(b:'0',binary:'1',binaryObject:'1',commentOnly:'1',debugCalls:'1',demangle:'0',directives:'0',execute:'1',intel:'0',libraryCode:'0',trim:'1',verboseDemangling:'0'),flagsViewOpen:'1',fontScale:14,fontUsePx:'0',j:1,lang:rust,libs:!(),options:'-C+opt-level%3D2',overrides:!((name:edition,value:'2021')),selection:(endColumn:1,endLineNumber:1,positionColumn:1,positionLineNumber:1,selectionStartColumn:1,selectionStartLineNumber:1,startColumn:1,startLineNumber:1),source:1),l:'5',n:'0',o:'+rustc+1.78.0+(Editor+%231)',t:'0')),k:53.41620857183087,l:'4',m:50,n:'0',o:'',s:0,t:'0'),(g:!((h:executor,i:(argsPanelShown:'1',compilationPanelShown:'0',compiler:r1780,compilerName:'',compilerOutShown:'0',execArgs:'',execStdin:'',fontScale:14,fontUsePx:'0',j:1,lang:rust,libs:!(),options:'',overrides:!((name:edition,value:'2021')),runtimeTools:!(),source:1,stdinPanelShown:'1',wrap:'1'),l:'5',n:'0',o:'Executor+rustc+1.78.0+(Rust,+Editor+%231)',t:'0')),header:(),l:'4',m:50,n:'0',o:'',s:0,t:'0')),k:53.41620857183087,l:'3',n:'0',o:'',t:'0')),l:'2',n:'0',o:'',t:'0')),version:4>) for this, so the assembly might be slightly different from what you get on your machine.

```rust
fn u5_to_u8_naive(x: u16) -> u8 {
    (x as f32 / 31.0 * 255.0).round() as u8
}
```

```asm
.LCPI0_0:
        .long   0x41f80000
.LCPI0_1:
        .long   0x437f0000
u5_to_u8_naive:
        push    rax
        movzx   eax, di
        cvtsi2ss        xmm0, eax                 ; xmm0 = x to f32
        divss   xmm0, dword ptr [rip + .LCPI0_0]  ; xmm0 = xmm0 / 31.0
        mulss   xmm0, dword ptr [rip + .LCPI0_1]  ; xmm0 = xmm0 * 255.0
        call    qword ptr [rip + roundf@GOTPCREL] ; xmm0 = round(xmm0)
        xorps   xmm1, xmm1                        ; xmm1 = 0.0
        maxss   xmm1, xmm0                        ; xmm1 = max(xmm1, xmm0)
        movss   xmm0, dword ptr [rip + .LCPI0_1]  ; xmm0 = 255.0
        minss   xmm0, xmm1                        ; xmm0 = min(xmm0, xmm1)
        cvttss2si       eax, xmm0                 ; convert xmm0 to u8
        pop     rcx
        ret
```

Well, that's not good. A few things to note:

1. The compiler did not optimize `/ 31.0 * 255.0` into a single multiplication.
2. `round` compiles to a function call to `roundf`.
3. `as u8` does a surprising amount of work. It first clamps the float to the range 0-255, then converts it to an integer by truncation. So `f as u8` essentially does `f.clamp(0.0, 255.0).trunc() as u8`.

We can easily remove the division by defining a compile-time constant for `255.0 / 31.0`, so let's move on to more interesting optimizations.

Next: the call to `round`. Mathematically speaking, rounding is defined as:

$$
round(x) := \lfloor x + 0.5 \rfloor, \space x \in \R
$$

Let's apply this definition:

```rust
fn u5_to_u8_naive_v2_wip(x: u16) -> u8 {
    const FACTOR: f32 = 255.0 / 31.0;
    (x as f32 * FACTOR + 0.5).floor() as u8
}
```

<div class="info">

In Rust, `const` defines a compile-time constant. Such values are guaranteed to be computed at compile time.

</div>

<div class="side-note">

We are unfortunately living in an ugly world devoid of the beauty of mathematics. A world with finitely precise 32-bit floating point numbers, where all of the following is true:

```rust
let a: f32 = 0.49999997;
assert!(a != 0.5);
assert!(a + 0.5 == 1.0);
assert!((a + 0.5).floor() == 1.0);
assert!(a.round() == 0.0);
```

So always be careful when dealing with floating point numbers.

That said, these edge cases can't happen with our 5-to-8-bit conversion, so we can ignore all this complexity Rust's `round` method has to deal with.

</div>

We already know that `as u8` _truncates_ the floating point number, so we can remove the call to `floor`. This is correct, because we are only working with non-negative floating point numbers and $\forall x \in R, x \ge 0 : trunc(x) = \lfloor x \rfloor$.

```rust
fn u5_to_u8_naive_v2(x: u16) -> u8 {
    const FACTOR: f32 = 255.0 / 31.0;
    (x as f32 * FACTOR + 0.5) as u8
}
```

```asm
.LCPI0_0:
        .long   0x41039ce7
.LCPI0_1:
        .long   0x3f000000
.LCPI0_2:
        .long   0x437f0000
u5_to_u8_naive_v2:
        movzx   eax, di
        cvtsi2ss        xmm0, eax                ; xmm0 = x to f32
        mulss   xmm0, dword ptr [rip + .LCPI0_0] ; xmm0 = xmm0 * 8.22580624 (255 / 31)
        addss   xmm0, dword ptr [rip + .LCPI0_1] ; xmm0 = xmm0 + 0.5
        xorps   xmm1, xmm1                       ; xmm1 = 0.0
        maxss   xmm1, xmm0                       ; xmm1 = max(xmm1, xmm0)
        movss   xmm0, dword ptr [rip + .LCPI0_2] ; xmm0 = 255.0
        minss   xmm0, xmm1                       ; xmm0 = min(xmm0, xmm1)
        cvttss2si       eax, xmm0                ; convert xmm0 to u8
        ret
```

```
u5_to_u8_naive          time:   [11.108 µs 11.147 µs 11.195 µs]
u5_to_u8_naive_v2       time:   [1.3806 µs 1.3848 µs 1.3898 µs]
u5_to_u8_bcdec          time:   [527.47 ns 531.42 ns 536.16 ns]
```

That's a lot better. Our optimizations made the naive implementation 8x faster, but we still aren't there yet. The `bcdec` version is still 2.6x faster.

The last optimization we'll do is to remove the unnecessary clamping. Since we know that the number passed to `as u8` is already between 0 and 255, there's no need to perform any clamping. We can use Rust's [`f32::to_int_unchecked`](https://doc.rust-lang.org/std/primitive.f32.html#method.to_int_unchecked) method to perform the integer conversion without clamping (at the cost of causing undefined behavior if we give it a value outside the range 0-255.999).

```rust
/// ## Safety
/// The caller must ensure that x < 32.
unsafe fn u5_to_u8_naive_v3(x: u16) -> u8 {
    debug_assert!(x < 32);
    const FACTOR: f32 = 255.0 / 31.0;
    let f = x as f32 * FACTOR + 0.5;
    unsafe { f.to_int_unchecked() }
}
```

<div class="info">

In Rust, `unsafe` allows us to call methods and perform actions that can cause undefined behavior (UB) if used incorrectly. While this enables powerful optimizations, it also requires the programmer to ensure that the code does not cause UB. It is generally recommended to avoid using `unsafe` whenever possible.

</div>

```asm
.LCPI0_0:
        .long   0x41039ce7
.LCPI0_1:
        .long   0x3f000000
u5_to_u8_naive_v3:
        movzx   eax, di
        cvtsi2ss        xmm0, eax                ; xmm0 = x to f32
        mulss   xmm0, dword ptr [rip + .LCPI0_0] ; xmm0 = xmm0 * 8.22580624 (255 / 31)
        addss   xmm0, dword ptr [rip + .LCPI0_1] ; xmm0 = xmm0 + 0.5
        cvttss2si       eax, xmm0                ; convert xmm0 to u8
        ret
```

```
u5_to_u8_naive          time:   [11.108 µs 11.147 µs 11.195 µs]
u5_to_u8_naive_v2       time:   [1.3806 µs 1.3848 µs 1.3898 µs]
u5_to_u8_naive_v3       time:   [614.04 ns 615.98 ns 618.32 ns]
u5_to_u8_bcdec          time:   [527.47 ns 531.42 ns 536.16 ns]
```

We're almost caught up. The `bcdec` version is only 1.17x faster now.

However, we did have to use `unsafe`, which is never nice. Since the floating-point-to-integer conversion is the reason we needed `unsafe` in the first place, let's avoid using floating point altogether.

## Rounded division for unsigned integers

Before we tackle the 5 bit to 8 bit conversion, let's focus on rounded integer division first. Specifically, this:

$$
round(\frac{a}{b}), \space a, b \in \N_0, \space b \neq 0
$$

Using $round(x) = \lfloor x + 0.5 \rfloor$, we get:

$$
\begin{split}
round(\frac{a}{b}) & = \lfloor \frac{a}{b} + 0.5 \rfloor \\
                   & = \lfloor \frac{a}{b} + \frac{b/2}{b} \rfloor \\
                   & = \lfloor \frac{a + b/2}{b} \rfloor \\
                   & \overset{\text{A2}}= \lfloor \frac{a + \lfloor b/2 \rfloor}{b} \rfloor \\
\end{split}
$$

Proof for A2 in the appendix.

Since we now have integers in the denominator and divisor, we can use the standard integer division (which performs truncation):

```rust
fn div_rounded(a: u32, b: u32) -> u32 {
    (a + (b / 2)) / b
}
```

Using this as a basis, we can implement the 5 bit to 8 bit conversion using only integer arithmetic:

```rust
fn u5_to_u8_int(x: u32) -> u8 {
    ((x * 255 + (31 / 2)) / 31) as u8
}
```

```asm
u5_to_u8_int:
        mov     eax, edi            ; eax = x
        shl     eax, 8              ; eax = eax << 8 (= eax * 256)   | This is
        sub     eax, edi            ; eax = eax - x                  | * 255
        add     eax, 15             ; eax = eax + 15
        imul    rcx, rax, 138547333 ; \
        shr     rcx, 32             ;  \
        sub     eax, ecx            ;   | All of this is division
        shr     eax                 ;   | by 31 but faster
        add     eax, ecx            ;  /
        shr     eax, 4              ; /
        ret
```

```
u5_to_u8_naive          time:   [11.108 µs 11.147 µs 11.195 µs]
u5_to_u8_naive_v2       time:   [1.3806 µs 1.3848 µs 1.3898 µs]
u5_to_u8_naive_v3       time:   [614.04 ns 615.98 ns 618.32 ns]
u5_to_u8_int            time:   [580.73 ns 582.60 ns 584.85 ns]
u5_to_u8_bcdec          time:   [527.47 ns 531.42 ns 536.16 ns]
```

LLVM loves optimizing integer operations, so we can see a lot of tricks in the assembly. All of those tricks gave us a nice speed boost, and we are now only 1.1x slower than the `bcdec` version.

But is this fastest we can go with pure integer arithmetic?

## Rounded division with magic constants

We're finally ready to talk about the `bcdec` version.

```rust
fn u5_to_u8_bcdec(x: u16) -> u8 {
    ((x * 527 + 23) >> 6) as u8
}
```

```asm
u5_to_u8:
        imul    eax, edi, 527 ; eax = x * 527
        add     eax, 23       ; eax = eax + 23
        shr     eax, 6        ; eax = eax >> 6
        ret
```

This is magic. In only 3 instructions, this function converts all 5-bit values of `x` to 8-bit values, perfectly rounded and without division.

To understand how this work, let's look at the math. We will add a new parameter $s$ that will be the amount we shift the result to the right. Mathematically, `x >> s` is just $\lfloor x / 2^s \rfloor$. We also define $m = 2^n-1$ to make the formula easier to read.

$$
\begin{split}
round(\frac{x}{m} \cdot 255) &= \lfloor \frac{x \cdot 255 + m/2}{m} \rfloor \\
                             &= \lfloor \frac{(x \cdot 255 + m/2)\cdot 2^s/m}{2^s} \rfloor \\
                             &= \lfloor \frac{x \cdot 255 \cdot 2^s / m + 2^{s-1}}{2^s} \rfloor \\
\end{split}
$$

Let's substitute $m = 31$ and $s = 6$:

$$
\lfloor \frac{x \cdot 526.4516 + 32}{2^6} \rfloor
$$

Now we can kind of see where the magic number 527 comes from. But 23? That's still a mystery.

### Analyzing the expression

Since the magic code has the form `(x * f + a) >> s`, let's see what we can find out by simply analyzing the expression.

Let's define the variables first:

-   $D \in \N, D \ne 0$ is the maximum input number.
-   $T \in \N, T \ne 0$ is the maximum output number.

What are want values for $f \in \N_0$, $a \in \N_0$, and $s \in \N_0$ such that the triple $(f, a, s)$ is a solution for:

$$
\lfloor \frac{x \cdot f + a}{2^s} \rfloor = round(\frac{x}{D} \cdot T), \space \forall x \in \N_0, 0 \le x \le D
$$

Here's what we know:

1. If there exists a solution that satisfies the equation, then there are infinitely many solutions.

    If a triple $(f, a, s)$ is a solution, then $(f \cdot 2, a \cdot 2, s+1)$ and $(f \cdot 2, a \cdot 2 + 1, s+1)$ are also solutions.

    $$
    \lfloor \frac{x \cdot f \cdot 2 + a \cdot 2}{2^{s+1}} \rfloor
    = \lfloor \frac{2 \cdot (x \cdot f + a)}{2 \cdot 2^s} \rfloor
    = \lfloor \frac{x \cdot f + a}{2^s} \rfloor
    $$

    $$
    \lfloor \frac{x \cdot f \cdot 2 + a \cdot 2 + 1}{2^{s+1}} \rfloor
    = \lfloor \frac{2 \cdot (x \cdot f + a + 0.5)}{2 \cdot 2^s} \rfloor
    = \lfloor \frac{x \cdot f + a + 0.5}{2^s} \rfloor
    = \lfloor \frac{x \cdot f + a}{2^s} \rfloor
    $$

    See the appendix for a proof of the last equality.

Since we can derive infinitely many solutions from a single solution, it's useful to focus on solutions that aren't derived. A solution $(f, a, s)$ is _minimal_, iff $(f/2, \lfloor a/2 \rfloor, s-1)$ is not a solution. This allows us to differentiate between different kinds of solutions.

2. $f \ne 0$.

    If $f$ was $0$, then the left side of the equation would simplify to $\lfloor a / 2^s \rfloor$, which is a constant (in regard to $x$). However, the right side of the equation is _not_ a constant, because the results for $x=0$ and $x=D$ are $round(0) = 0 \ne T = round(T)$, because $T\ne 0$. Since a constant can't be two different values, $f$ can't be $0$.

3. If $(f,a,s)$ and $(f,a+k,s),k \in \N$ are solutions, then all triples $\set{(f,a+j,s) | j \in \N ,j \le k}$ are solutions.

    Formally proving this is tedious. The idea is that if $(f,a,s)$ and $(f,a+k,s)$ are solutions, then $\lfloor (x*f+a)/2^s \rfloor = \lfloor (x*f+a+k)/2^s \rfloor$ for all $x$ in the input range. But this equality can only hold if $k$ doesn't increase $x*f+a$ enough to reach the next multiple of $2^s$. And if $k$ isn't enough to reach the next multiple of $2^s$, then $j \le k$ won't be enough either.

4. $s > 0 \land (f,a,s) \text{ is minimal} \implies f \text{ is odd}$.

    If $f$ was even, then $(f/2,\lfloor a/2 \rfloor, s-1)$ would also be a solution, which contradicts the requirement for _minimal_. Here's why:

    $$
    \lfloor \frac{x \cdot f + a}{2^s} \rfloor
    = \lfloor \frac{x \cdot \overbrace{f/2}^{\text{integer}} + a/2}{2^{s-1}} \rfloor
    = \lfloor \frac{x \cdot f/2 + \lfloor a/2 \rfloor}{2^{s-1}} \rfloor
    $$

    For a proof of the last equality, see the appendix.

5. $a < 2^s$.

    If $a \ge 2^s$, then for $x=0$ we would get:

    $$
    \lfloor \frac{x \cdot f + a}{2^s} \rfloor
    = \lfloor \frac{a}{2^s} \rfloor
    > 1
    \ne 0
    = round(0)
    = round(\frac{x}{D} \cdot T)
    $$

    It trivially follows that $s = 0 \implies a = 0$.

6. We can establish bounds for $f$. Let's substitute $x=D$:

    $$
    \lfloor \frac{D \cdot f + a}{2^s} \rfloor = T = round(\frac{D}{D} \cdot T)
    $$

    Using $z-1 < \lfloor z \rfloor \le z, \forall z\in \R$, we get 2 inequalities:

    $$
    \frac{D \cdot f + a}{2^s} \ge T \text{ and } \frac{D \cdot f + a}{2^s} - 1 < T
    $$

    Rearranging for $f$, we get:

    $$
    \frac{T \cdot 2^s - a}{D} \le f < \frac{(T+1) \cdot 2^s - a}{D}
    $$

    Finally, we use $0 \le a < 2^s$ and $s=0 \implies a=0$ to remove $a$ from the inequalities:

    $$
    \begin{split}
    s = 0 &\implies \frac{T}{D} \le f < \frac{T+1}{D} \implies f = \frac{T}{D} \\
    s > 0 &\implies \frac{(T-1) \cdot 2^s}{D} < f < \frac{(T+1) \cdot 2^s}{D} \\
    \end{split}
    $$

    From the "bound" for $s=0$ we can follow that $T \text{ is divisible by }D \implies (f,a,s)=(T/D,0,0)$ is a solution.

    Unfortunately, the bounds are not very tight. In the $s>0$ case, the bounds grow exponentially with $s$.

7. We can improve the bound by giving up on the minimal solution requirement. If we instead substitute $x=k \cdot D, k\in\N,k>0$, we get the bounds:

    $$
    \begin{split}
    s = 0 &\implies f = \frac{T}{D} \\
    s > 0 &\implies \frac{(k \cdot T-1) \cdot 2^s}{k \cdot D} < f < \frac{(k \cdot T+1) \cdot 2^s}{k \cdot D} \\
          &\iff \frac{T \cdot 2^s}{D} - \frac{2^s}{k \cdot D} < f < \frac{T \cdot 2^s}{D} + \frac{2^s}{k \cdot D} \\
    \end{split}
    $$

    If we let $k \to \infin$, then the $s>0$ case converges to $f = T \cdot 2^s/D$ as well. Since we know that $k \to \infin$ makes the bounds of $f$ converge, we can choose a value $k \ge 1$ such that the bound is as small as possible while still containing an odd integer. Since the distance of the lower and upper bound from $T \cdot 2^s/D$ is the same, we know that the optimal $f$ is an odd integer closest to $T \cdot 2^s/D$. Note that there can be 2 such values for $f$ if $T \cdot 2^s/D$ is an even integer.

    While I cannot prove this, I believe that picking a value of $f$ in this manner is optimal in that it (1) is guaranteed to find a solution (if there exists one), and (2) it will find a minimal solution with the smallest possible $s$.

With this, we can now understand the magic number 527 from the 5 bit to 8 bit conversion better. 527 is closest odd integer to $255 * 2^6 / 31 = 526.45$.

From my experimentation, I also discovered the following properties:

8. There are multiple minimal solutions, and there are multiple minimal solutions with the same values for $f$ and $s$.

    E.g. for $D=31, T=255$, all solutions with $s<10$ are (all solutions with an odd $f$ are minimal):

    - $f=527, a=23, s=6$
    - $f=1053, a \in \set{60, 61,62,63, 64}, s=7$
    - $f=1054, a \in \set{46, 47}, s=7$
    - $f=2105, a=140, s=8$
    - $f=2106, a \in \set{120, ..., 129}, s=8$
    - $f=2107, a \in \set{100, ..., 118}, s=8$
    - $f=2108, a \in \set{92, 93,94, 95}, s=8$
    - $f=4210, a \in \set{280, 281}, s=9$
    - $f=4211, a \in \set{260, ..., 270}, s=9$
    - $f=4212, a \in \set{240, ..., 259}, s=9$
    - $f=4213, a \in \set{220, ..., 248}, s=9$
    - $f=4214, a \in \set{200, ..., 237}, s=9$
    - $f=4215, a \in \set{191, ..., 215}, s=9$
    - $f=4216, a \in \set{184, ..., 191}, s=9$

    There can even be multiple minimal solutions with the the smallest $s$ value. E.g. the solutions with the smallest $s$ for $D=123,T=1000$ are:

    - $f=8325, a \in \set{518,...,530}, s=10$

Based on my experiments, I also believe that if $(f,a_0,s)$ and $(f+2,a_2, s)$ are solutions, then a solution $(f+1,a_1,s)$ exists.

### Generalizing the expression

In the above analysis, we did not use 2 properties of our equation:

$$
\lfloor \frac{x \cdot f + a}{2^s} \rfloor = round(\frac{x}{D} \cdot T), \space \forall x \in \N_0, 0 \le x \le D
$$

1. The bounds of $x$. (The only exception here is 2) $f \ne 0$.)
2. The properties of the $round$ function. We only used the property $round(i) = i, i \in \N$, but there are other functions that satisfy this property.

So let's modify the equation to:

$$
\lfloor \frac{x \cdot f + a}{2^s} \rfloor = R(\frac{x}{D} \cdot T), \space \forall x \in \N_0, 0 \le x \le U
$$

Where $U \in \N,U>0$ and $R$ is a function that satisfies the following properties:

1. $R(i) = i, \forall i \in \N_0$,
2. $R(x) \in \N, \forall x\in\R$, and
3. $R$ is monotonically increasing.

Basically, we want $R$ to be a rounding function, but we don't require a specific rounding function. E.g. possible functions are $R(x) = round(x)$, $R(x) = \lfloor x \rfloor$, and $R(x) = \lceil x \rceil$.

We now have something very powerful on our hands. If we can find the right constants for $(f, a, s)$, we can multiply any number $x \in \set{0,1,...,U}$ with an arbitrary fraction $T/D$ and round it to an integer with an arbitrary rounding function $R$. We just need to find the right constants.

### Brute forcing magic constants

Since we've already know quite a bit about the constants we want, brute forcing them is quite straightforward. Here's the basic algorithm in Rust-like pseudo code:

```rust
for s in 0..64 {
    for f in get_optimal_factors(s) {
        for a in 0..(1 << s) {
            if exhaustive_check(f, a, s) {
                return (f, a, s);
            }
        }
    }
}

fn exhaustive_check(f: uint, a: uint, s: uint) -> bool {
    for x in 0..=U {
        if (x * f + a) >> s != get_expected(x) {
            return false;
        }
    }
    return true;
}

fn get_expected(x: uint) -> uint {
    return R((x * T) as decimal / D);
}
```

`get_optimal_factors` returns the optimal values for $f$ for a given $s$ as described in 7).

While this works, it's quite slow since the number of `exhaustive_check`s grows exponentially with $s$. However, we can optimize this using two observations I made:

1. If $(f,a,s)$ is not a solution, because it doesn't work for a specific $x$, then $(f,a+1,s)$ will likely also not work for the same $x$. This means that we can often skip checking the full range by keeping track of the value of $x$ that caused `exhaustive_check` to reject the previous solution.
2. Only a few specific values of $x$ ever cause `exhaustive_check` to reject a solution. So by keeping track of all values of $x$ that previously caused a rejection, we can check these values before checking the full range.

Lastly, we can optimize the values of $a$ that we check. The property we'll use is that $\lfloor (x \cdot f + a') / 2^s \rfloor < R(x \cdot T / D)$ implies that all $a\le a'$ cannot be part of a solution for given values of $f,s,x$. This can used to find the lowest value of $a$ that can be part of a solution. A similar property can be used to find the highest value of $a$. Since we already keep track of values that are likely to reject a solution, we can use a binary-search-like algorithm to find the smallest and largest values of $a$.

Note that none of these optimizations are sufficient to prove that a solution is correct. They only allow us to quickly reject solutions that are guaranteed to be incorrect.

### Playground

I implemented everything we talked about in TypeScript. It's fairly fast and can find the magic constants for most values of $D+T+U<100'000$ in less than a second. Of course, this is just a proof of concept, and the code is not optimized for performance. An optimized implementation in a language like C/C++ or Rust would likely be at least an order of magnitude faster.

```json:custom
{
    "component": "conversion-brute-force"
}
```

## Beating the compiler at its own game

Remember how the compiler replaced the `/ 31` with a multiplication and some other instructions? We can do the same thing with our magic constants.

We select $D=31, T=1, U=255$ and use $R(x) = \lfloor x \rfloor$ as the rounding function.

## Appendix

This is a list of formal proofs for the theorems I used throughout the article.

### A1

Let $a,b \in \N, b \ne 0$ and $r\in\R,0\le r < 1$, then:

$$
\lfloor \frac{a + r}{b} \rfloor = \lfloor \frac{a}{b} \rfloor
$$

Proof:

Since $r\ge 0$ and flooring is a monotonic increasing function, we know that $\lfloor a/b \rfloor \le \lfloor (a+r)/b \rfloor$. Since $r<1$, $a+r$ can never reach the next multiple of $b$. Therefore $\lfloor (a+r)/b \rfloor < \lfloor a/b \rfloor + 1$. Since flooring outputs integers, the statement follows from the above bounds. $\square$

### A2

Let $a,b,c \in \N, c \ne 0$. Then:

$$
\lfloor \frac{a + b/2}{c} \rfloor = \lfloor \frac{a + \lfloor b/2\rfloor}{c} \rfloor
$$

Proof:

1. If $b$ is even, then $b/2 = \lfloor b/2 \rfloor$. So the statement is trivially true.
2. If $b$ is odd, then $b/2 = \lfloor b/2 \rfloor + 0.5$. It follows that:

    $$
    \lfloor \frac{a + b/2}{c} \rfloor
    = \lfloor \frac{a + \lfloor b/2\rfloor + 0.5}{c} \rfloor
    \overset{\text{A1}}{=} \lfloor \frac{a + \lfloor b/2\rfloor}{c} \rfloor
    $$

$\square$
