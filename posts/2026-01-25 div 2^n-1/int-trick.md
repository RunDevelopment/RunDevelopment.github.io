---
datePublished: 2026-01-25
title: Fast division by 2^n-1
description: Fast methods for division by 2^n-1 with different rounding for unsigned integers.
inlineCodeLanguage: rust
tags: optimization math division

image: ./m38_2026-01-25.avif
imageSmall: ./m38_2026-01-25_small.avif
imageFadeColor: "#070B11"
color: "#e8a47d"
---

$$
% global macro definitions
\gdef\round{\operatorname{round}}
$$

I recently found this code snippet in the source code of [`pic-scale-safe`](https://github.com/awxkee/pic-scale-safe):

```rs
fn div_round_by_1023(v: u32) -> u32 {
    let round = 1 << 9;
    let w = v + round;
    ((w >> 10) + w) >> 10
}
```

This function computes $\round(v / 1023)$ for inputs $v<2^{20}+2^9-1$ with just a few bit shifts and additions in 32-bit arithmetic. Quite efficient.

But that's not all. This trick only 21 bits for the intermediate results. Other approaches like the multiply-add method require 31 bits for intermediate results to perform the same rounded division by 1023 in the range $v<2^{20}+2^9-1$. While not the case for division by 1023, in general this trick needs at most one additional bit, which can be the difference between being able to use 32-bit arithmetic or having to resort to 64-bit arithmetic. This is especially important in SIMD code and code the compiler is supposed to auto-vectorize.

As I hinted, this trick doesn't work just for division by 1023. In general, it works for any divisor of the form $2^n-1$ for inputs $v<2^{2n}+2^{n-1}-1$. Here is the generalized version:

```rs
fn div_round_by_2pn_m1(v: u32, n: u32) -> u32 {
    let round = 1 << (n - 1);
    let w = v + round;
    ((w >> n) + w) >> n
}
```

This function returns exactly $\round(v / (2^n-1))$ for all inputs $v < 2^{2n} + 2^{n-1} - 1$. For larger inputs, the results are typically close, but not exact. This makes it an approximation for rounded division by $2^n-1$.

Unfortunately, it's not obvious at all why this approximation is exact for $v<2^{2n}+2^{n-1}-1$, and why it stops working at $v=2^{2n}+2^{n-1}-1$.

In this article, I will answer both questions and generalize the trick to (1) increase the input range and (2) support `floor` and `ceil` division as well.

## Contents

## Results

Before I start with the derivations and proofs, here is a summary of the results.

1. $\round(\frac v {2^n-1})$ can be approximated using:

    $$
    \begin{split}
    R_1 &:= \lfloor\frac{v+2^{n-1}}{2^n}\rfloor \\
    R_{i+1} &:= \lfloor \frac{R_i + v+2^{n-1}}{2^n} \rfloor \\
    \end{split}
    $$

    The approximation $R_i$ is exact for all inputs $v < 2^{in} + 2^{n-1} - 1$.

1. $\lfloor \frac v {2^n-1} \rfloor$ can be approximated using:

    $$
    \begin{split}
    F_1 &:= \lfloor\frac{v+1}{2^n}\rfloor \\
    F_{i+1} &:= \lfloor \frac{F_i + v+1}{2^n} \rfloor \\
    \end{split}
    $$

    The approximation $F_i$ is exact for all inputs $v < 2^{in} + 2^n - 2$.

1. $\lceil \frac v {2^n-1} \rceil$ can be approximated using:

    $$
    \begin{split}
    C_1 &:= \lfloor\frac{v+2^n-1}{2^n}\rfloor \\
    C_{i+1} &:= \lfloor \frac{C_i + v+2^n-1}{2^n} \rfloor \\
    \end{split}
    $$

    The approximation $C_i$ is exact for all inputs $v < 2^{in}$.

<div class="info" data-title="Note">

These are _theoretical_ results. In practice, integer overflow has to be carefully considered in order to determine the true range of inputs for which a particular _implementation_ is exact.

The below tool determines bounds for correctness automatically based on the given settings.

</div>

### Code Generation

I also implemented a little code gen tool that uses these results to generate Rust code. You can set $n$, the iteration count, the rounding mode, and the integer type all operations will be performed in. Everything (except for the integer type) can also be made variable at runtime by checking the _Parameter_ box.

```json:custom
{
    "component": "div-2pn-m1"
}
```

<div class="info" data-title="Limitation">

If $2^n$ cannot be represented by the chosen integer type, generated code may fail to compile or panic at runtime (if $n$ is a parameter). Such cases are mostly nonsensical anyway, so just avoid them.

</div>

## Proving correctness

Formally, the approximation is defined as follows: Let $v\in\N,n\in\N_1$, then:

$$
\round(\frac v {2^n-1}) \approx \lfloor \frac{\lfloor\frac{v + 2^{n-1}}{2^n}\rfloor + v + 2^{n-1}}{2^n} \rfloor
$$

<div class="info">

This looks more complicated than it really is. $\lfloor x / 2^n \rfloor$ is just `x >> n` in code, and $\lfloor (x+2^{n-1}) /2^n \rfloor$ is the same as $\round(x / 2^n)$. So really, the approximation is just two nested rounded divisions (implemented as bit shifts in code). I will keep it in floor division form for the rest of the article, since it makes the proofs easier.

</div>

To capture how good the approximation is, I will introduce an error term $\delta$ defined as follows:

$$
\delta := \lfloor \frac{\lfloor\frac{v + 2^{n-1}}{2^n}\rfloor + v + 2^{n-1}}{2^n} \rfloor - \round(\frac v {2^n-1})
$$

Consequently, the approximation is exact for an input $v$ iff $\delta=0$.

Now, I will write $v$ a bit differently. Let $v=a(2^n-1)+b+2^{n-1}$ for $a\in\Z,b\in\N_0,b<2^n-1$. While a bit unusual, it should be obvious that all integers can be uniquely expressed in this form. I choose this form because it has the nice property that $\round(v/(2^n-1)) = a + 1$.

<details>
<summary>Proof:</summary>

$$
\begin{split}
\round(\frac{v}{2^n-1})  &= \lfloor \frac{a(2^n-1)+b+2^{n-1} + \lfloor (2^n-1)/2\rfloor}{2^n-1} \rfloor \\
 &= \lfloor \frac{a(2^n-1)+b+2^{n-1} + 2^{n-1}-1}{2^n-1} \rfloor \\
 &= \lfloor \frac{a(2^n-1)+b + (2^n-1)}{2^n-1} \rfloor \\
 &= \lfloor \frac{b}{2^n-1}+a+1 \rfloor \\
 &= \lfloor \overbrace{(\frac{b}{2^n-1})}^{\in[0,1)} \rfloor+a+1 \\
 &= a+1 \\
\end{split}
$$

(Note: $\lfloor b/(2^n-1) \rfloor = 0$ since $b$ is defined as $0 \le b < 2^n - 1$.)

</details>

<div class="info">

All proofs that use this form of $v$ will make heavy use of the following properties:

- $\round(v/(2^n-1)) = a + 1$
- $\lfloor b/(2^n-1) \rfloor = 0$
- $\lfloor b/2^n \rfloor = 0$
- $\lfloor (b+1)/2^n \rfloor = 0$

</div>

This makes it possible to simplify the error term:

$$
\begin{split}
\delta :&= \lfloor \frac{\lfloor\frac{v + 2^{n-1}}{2^n}\rfloor + v + 2^{n-1}}{2^n} \rfloor - \round(\frac v {2^n-1}) \\
&= \lfloor \frac{\lfloor\frac{a(2^n-1)+b+2^{n-1} + 2^{n-1}}{2^n}\rfloor + a(2^n-1)+b+2^{n-1} + 2^{n-1}}{2^n} \rfloor - a-1 \\
&= \lfloor \frac{\lfloor\frac{b-a +a2^n+2^n}{2^n}\rfloor +b-a +a2^n+2^n}{2^n} \rfloor - a-1 \\
&= \lfloor \frac{\lfloor\frac{b-a}{2^n}\rfloor+a+1 +b-a}{2^n}+a+1 \rfloor - a-1 \\
&= \lfloor \frac{\lfloor\frac{b-a}{2^n}\rfloor+b+1}{2^n} \rfloor \\
\end{split}
$$

Now it is easy to show that $-2^n \le b-a < 2^n \implies \delta = 0$.

$$
0\le b-a < 2^n \implies \delta
= \lfloor\frac{\overbrace{\lfloor\frac{b-a}{2^n}\rfloor}^{=0} +b+1}{2^n} \rfloor
= \lfloor\frac{b+1}{2^n} \rfloor
= 0
$$

$$
-2^n\le b-a < 0 \implies \delta
= \lfloor\frac{\overbrace{\lfloor\frac{b-a}{2^n}\rfloor}^{=-1} +b+1}{2^n} \rfloor
= \lfloor\frac{b}{2^n} \rfloor
= 0
$$

All that is left to do, is to show that for all inputs $v < 2^{2n} + 2^{n-1}-1$, it holds that $-2^n \le b-a < 2^n$. This is done in two cases:

1. $a\in\set{0,...,2^n}$: This corresponds to $v\in\set{2^{n-1},...,2^{2n}+2^{n-1}-2}$.

    Two cases:
    1. $a\le b \implies 0 \le b-a < 2^n-1 \implies -2^n \le b-a < 2^n \implies \delta=0$.
    1. $a > b \implies -2^n \le b-a < 2^{n-1} \implies -2^n \le b-a < 2^n \implies \delta=0$.

1. $a=-1$: This corresponds to $v\in\set{-2^{n-1}+1,...,2^{n-1}-1}$.

    $a=-1 \implies 1 \le b-a < 2^n \implies -2^n \le b-a < 2^n \implies \delta=0$.

    Note: While this case algebraically includes negative values for $v$, the bounds $v\ge 0$ are implied by $v\in\N$. So this cannot be taken as proof that the approximation works for negative inputs.

Taken together, this proves $0\le v < 2^{2n} + 2^{n-1} - 1 \implies \delta =0$, which means that the approximation is exactly equal to rounded division by $2^n-1$ for those input.

Further, proving that the approximation is _not_ exact for $v=2^{2n} + 2^{n-1} - 1$ is easy. This number corresponds to $a=2^n+1,b=0$, which results in a non-zero error term:

$$
\delta = \lfloor \frac{\lfloor\frac{b-a}{2^n}\rfloor+b+1}{2^n} \rfloor
= \lfloor \frac{\lfloor\frac{-2^n-1}{2^n}\rfloor+1}{2^n} \rfloor
= \lfloor \frac{-2+1}{2^n} \rfloor
= -1
$$

Therefore, $v=2^{2n} + 2^{n-1} - 1$ is the smallest (non-negative) input for which the approximation is not exact.

### Showing failure points

After proving that the approximation fails, I thought it might also be interesting to see it fail for a few values of $n$. So here are the smallest inputs where the approximation starts to differ from the actual result for $n$ from 1 to 15:

|   n | First non-exact input v | v rewritten    | Approx&shy;imation | $\text{round}(\frac v {2^n-1})$ |
| --: | ----------------------: | -------------- | -----------------: | ------------------------------- |
|   1 |                       4 | $2^2+0$        |                  3 | 4                               |
|   2 |                      17 | $2^4+1$        |                  5 | 6                               |
|   3 |                      67 | $2^6+3$        |                  9 | 10                              |
|   4 |                     263 | $2^8+7$        |                 17 | 19                              |
|   5 |                    1039 | $2^{10}+15$    |                 33 | 34                              |
|   6 |                    4127 | $2^{12}+31$    |                 65 | 66                              |
|   7 |                   16447 | $2^{14}+63$    |                129 | 130                             |
|   8 |                   65663 | $2^{16}+127$   |                257 | 258                             |
|   9 |                  262399 | $2^{18}+255$   |                513 | 514                             |
|  10 |                 1049087 | $2^{20}+511$   |               1025 | 1026                            |
|  11 |                 4195327 | $2^{22}+1023$  |               2049 | 2050                            |
|  12 |                16779263 | $2^{24}+2047$  |               4097 | 4098                            |
|  13 |                67112959 | $2^{26}+4095$  |               8193 | 8194                            |
|  14 |               268443647 | $2^{28}+8191$  |              16385 | 16386                           |
|  15 |              1073758207 | $2^{30}+16383$ |              32769 | 32770                           |

These numbers were found experimentally using brute-force search.

## Extending the input range

Depending on the use case, an input range of $v < 2^{2n} + 2^{n-1} - 1$ might be too small. However, the trick can be extended to support larger inputs.

The main insight here is this equality:

$$
\begin{split}
\frac v{2^n-1} = \frac {\frac{v} {2^n-1} + v}{2^n}
\end{split}
$$

Derived from:

$$
\begin{split}
\frac v{2^n-1}
= \frac {\frac{2^n} {2^n-1} \cdot v}{2^n}
= \frac {\frac{1 + (2^n-1)} {2^n-1} \cdot v}{2^n}
= \frac {\frac{v} {2^n-1} + v}{2^n}
\end{split}
$$

This makes it possible to recursively rewrite the division by $2^n-1$ into a series of divisions by $2^n$.

Let $R_i$ be the approximation of rounded division by $2^n-1$ after $i$ iterations, defined as follows:

$$
\begin{split}
R_1 &:= \lfloor\frac{v + 2^{n-1}}{2^n}\rfloor \\
R_{i+1} &:= \lfloor \frac{R_i + v + 2^{n-1}}{2^n} \rfloor \\
\end{split}
$$

The trick from above then corresponds to $R_2$.

Let's see the smallest inputs $v$ the approximations $R_i$ start to fail for:

|   n | $R_1$     | $R_2$        | $R_3$        | $R_4$       | $R_5$       |
| --: | --------- | ------------ | ------------ | ----------- | ----------- |
|   1 | $2^1+0$   | $2^2+0$      | $2^3+0$      | $2^4+0$     | $2^5+0$     |
|   2 | $2^2+1$   | $2^4+1$      | $2^6+1$      | $2^8+1$     | $2^{10}+1$  |
|   3 | $2^3+3$   | $2^6+3$      | $2^9+3$      | $2^{12}+3$  | $2^{15}+3$  |
|   4 | $2^4+7$   | $2^8+7$      | $2^{12}+7$   | $2^{16}+7$  | $2^{20}+7$  |
|   5 | $2^5+15$  | $2^{10}+15$  | $2^{15}+15$  | $2^{20}+15$ | $2^{25}+15$ |
|   6 | $2^6+31$  | $2^{12}+31$  | $2^{18}+31$  | $2^{24}+31$ | -           |
|   7 | $2^7+63$  | $2^{14}+63$  | $2^{21}+63$  | -           | -           |
|   8 | $2^8+127$ | $2^{16}+127$ | $2^{24}+127$ | -           | -           |

These numbers were found experimentally using a brute-force search. I aborted the search when it took too long, so some entries are missing.

The pattern is very clear. It seems that $R_i$ is exact for all inputs $v < 2^{in} + 2^{n-1} - 1$. So the trick can be extended to support arbitrarily large input ranges by increasing the number of iterations.

In code, this is implemented as follows:

```rs
fn div_round_2pn_m1_iters(v: u32, n: u32, iters: u8) -> u32 {
    let round = 1 << (n - 1);
    let w = v + round;
    let mut r = w >> n; // R_1
    for _ in 1..iters {
        r = (r + w) >> n; // R_{i+1}
    }
    r
}
```

### Proving correctness for extended ranges

Let $v,n,a,b$ be defined as before: $v=a(2^n-1)+b+2^{n-1}$. Further, let $i\in\N_1$ be the i-th iteration of the approximation $R_i$ as defined above and $\delta_i:=R_i-\round(v/(2^n-1))$. As before, $R_i$ is exact for inputs $v$ iff $\delta_i=0$.

I will start by simplifying the error term $\delta_i$:

$$
\begin{split}
\delta_1 &= R_1 - \round(\frac v {2^n-1})  \\
&= \lfloor\frac{v + 2^{n-1}}{2^n}\rfloor - \round(\frac v {2^n-1}) \\
&= \lfloor\frac{a(2^n-1)+b+2^{n-1} + 2^{n-1}}{2^n}\rfloor - a-1 \\
&= \lfloor\frac{b-a}{2^n}+a+1\rfloor - a-1 \\
&= \lfloor\frac{b-a}{2^n}\rfloor
\end{split}
$$

$$
\begin{split}
\delta_{i+1} &= R_{i+1} - \round(\frac v {2^n-1})  \\
&= \lfloor \frac{R_i + v + 2^{n-1}}{2^n} \rfloor - \round(\frac v {2^n-1}) \\
&= \lfloor \frac{\delta_i+\round(\frac v {2^n-1}) + v + 2^{n-1}}{2^n} \rfloor - \round(\frac v {2^n-1}) \\
&= \lfloor \frac{\delta_i+a+1 + v + 2^{n-1}}{2^n} \rfloor -a-1 \\
&= \lfloor \frac{\delta_i+a+1 + a(2^n-1)+b+2^{n-1} + 2^{n-1}}{2^n} \rfloor -a-1 \\
&= \lfloor \frac{\delta_i+b+1}{2^n}+a+1 \rfloor -a-1 \\
&= \lfloor \frac{\delta_i+b+1}{2^n} \rfloor \\
\end{split}
$$

With the error term in a nicer form, it's now easy to show by induction that $a=-1\implies\delta_i=0$:

- **Base case** ($i=1$): $a=-1 \implies \delta_1 = \lfloor(b-a)/2^n\rfloor = \lfloor(b+1)/2^n\rfloor = 0$.
- **Induction step**: $\delta_{i+1} = \lfloor (\delta_i+b+1) / 2^n \rfloor = \lfloor (b+1) / 2^n \rfloor = 0$.

Since $a=-1$ corresponds to $v\in\set{-2^{n-1}+1,...,2^{n-1}-1}$, this shows that the approximations (for any number of iterations) are exact for this range. (Again, the bounds $v\ge 0$ are implied by $v\in\N$.)

To make things simpler going forward, I derived an explicit formula for $\delta_i$ by unrolling the recursion:

$$
\delta_i = \lfloor \frac{b-a}{2^{in}} + \sum_{l=1}^{i-1} \frac{b+1}{2^{ln}} \rfloor \\
$$

<details>
<summary>Proof for the explicit error term:</summary>

The correctness of the explicit error term formula can be shown using induction over $i$:

- **Base case** ($i=1$):

    $$
    \delta_1
    =\lfloor\frac{b-a}{2^n}\rfloor
    = \lfloor \frac{b-a}{2^{1\cdot n}} + \overbrace{\sum_{l=1}^{0} \frac{b+1}{2^{ln}}}^{=0} \rfloor \\
    $$

- **Induction step** (from $i$ to $i+1$):

    $$
    \begin{split}
    \delta_{i+1} &= \lfloor \frac{\delta_i+b+1}{2^n} \rfloor \\
    &= \lfloor \frac{\lfloor \frac{b-a}{2^{in}} + \sum_{l=1}^{i-1} \frac{b+1}{2^{ln}} \rfloor + b + 1}{2^n} \rfloor \\
    &= \lfloor \frac{ \frac{b-a}{2^{in}} + \sum_{l=1}^{i-1} \frac{b+1}{2^{ln}} + b + 1}{2^n} \rfloor \\
    &= \lfloor \frac{b-a}{2^{(i+1)n}} + \sum_{l=1}^{i-1} \frac{b+1}{2^{(l+1)n}} + \frac{b+1}{2^n} \rfloor \\
    &= \lfloor \frac{b-a}{2^{(i+1)n}} + \sum_{l=2}^{i} \frac{b+1}{2^{ln}} + \frac{b+1}{2^n} \rfloor \\
    &= \lfloor \frac{b-a}{2^{(i+1)n}} + \sum_{l=1}^{i} \frac{b+1}{2^{ln}} \rfloor \\
    \end{split}
    $$

    $\square$

</details>

Using the explicit formula for $\delta_i$, it's easy to show that $v=2^{in}+2^{n-1}-1$ results in $\delta_i=-1$, making the approximation non-exact for that input. $v=2^{in}+2^{n-1}-1$ corresponds to $a=\sum_{l=0}^{i-1} 2^{ln},b=0$. Plugging this into the explicit formula for $\delta_i$ gives:

$$
\begin{split}
\delta_i &= \lfloor \frac{b-a}{2^{in}} + \sum_{l=1}^{i-1} \frac{b+1}{2^{ln}} \rfloor \\
&= \lfloor \frac{-\sum_{l=0}^{i-1} 2^{ln}}{2^{in}} + \sum_{l=1}^{i-1} \frac{1}{2^{ln}} \rfloor \\
&= \lfloor -\sum_{l=1}^{i} \frac{1}{2^{ln}} + \sum_{l=1}^{i-1} \frac{1}{2^{ln}} \rfloor \\
&= \lfloor -\frac{1}{2^{in}} \rfloor \\
&= -1 \\
\end{split}
$$

Before I can prove the rest, I need split $a$ similar to how I split $v$ into $a,b$. Let $a=j_i2^{in}+k_i$ for $j_i\in\Z,j_i:=\lfloor a/2^{in} \rfloor$ and $k_i\in\N,k_i<2^{in},k_i:=a \bmod 2^{in}$ at iteration $i$.

Plugging this into the explicit formula for $\delta_i$ gives:

$$
\delta_i = -j_i + \underbrace{\lfloor \frac{b - k_i}{2^{in}} + \sum_{l=1}^{i-1} \frac{b+1}{2^{ln}} \rfloor}_{=:\gamma_i}
$$

This way of representing $\delta_i$ reveals that $\delta_i$ is just $-j_i$ plus some small correction term $\gamma_i$ that depends on $k_i$ and $b$ but not $j_i$.

It's rather easy to show that $\gamma_i \in \{-1,0\}$ is always the case, which implies that $\delta_i \in \{-j_i-1,-j_i\}$.

<details>
<summary>Proof:</summary>

$$
\begin{split}
\gamma_i &= \lfloor \frac{b - k_i}{2^{in}} + \sum_{l=1}^{i-1} \frac{b+1}{2^{ln}} \rfloor \\
&= \lfloor \frac{(b+1)+(-1 - k_i)}{2^{in}} + \sum_{l=1}^{i-1} \frac{b+1}{2^{ln}} \rfloor \\
&= \lfloor -\frac{k_i+1}{2^{in}} + \sum_{l=1}^{i} \frac{b+1}{2^{ln}} \rfloor \\
\end{split}
$$

Now I will determine the range for the two terms inside the floor function:

- Range for the first term:

    $$
    \begin{split}
    & 0 \le k_i \le 2^{in}-1 \\
    \implies& \frac{1}{2^{in}} \le \frac{k_i+1}{2^{in}} \le \frac{2^{in}}{2^{in}} = 1 \\
    \implies& \frac{k_i+1}{2^{in}} \in (0,1]
    \end{split}
    $$

- Range for the second term:

    $$
    \begin{split}
    & 0 \le b \le 2^n-2 \\
    \implies& \sum_{l=1}^{i} \frac{1}{2^{ln}} \le \sum_{l=1}^{i} \frac{b+1}{2^{ln}} \le \sum_{l=1}^{i} \frac{2^n-1}{2^{ln}} \\
    \end{split}
    $$

    Note that:
    - $i \ge 1 \implies \frac{1}{2^n} \le \sum_{l=1}^{i} \frac{1}{2^{ln}}$.
    - $\sum_{l=0}^{\infty} \frac{1}{2^{ln}} = \frac{1}{1-\frac{1}{2^n}} = \frac{2^n}{2^n-1}$, so $\sum_{l=1}^{\infty} \frac{1}{2^{ln}} = \frac{1}{2^n-1}$. Therefore, $0<i<\infty \implies \sum_{l=1}^{i} \frac{2^n-1}{2^{ln}} = (2^n-1)\sum_{l=1}^{i} \frac{1}{2^{ln}} < (2^n-1)\sum_{l=1}^{\infty} \frac{1}{2^{ln}}$.

    Therefore:

    $$
    \begin{split}
    &\sum_{l=1}^{i} \frac{1}{2^{ln}} \le \sum_{l=1}^{i} \frac{b+1}{2^{ln}} \le \sum_{l=1}^{i} \frac{2^n-1}{2^{ln}} \\
    \implies& \frac{1}{2^n} \le \sum_{l=1}^{i} \frac{b+1}{2^{ln}} < 1 \\
    \implies& \sum_{l=1}^{i} \frac{b+1}{2^{ln}} \in (0,1) \\
    \end{split}
    $$

From those two ranges, it follows that $\gamma_i \in \{-1,0\}$.

</details>

However, that's not all that can be shown about $\gamma_i$. There is more structure to it. This structure becomes obvious by looking at a few concrete values. So are the possible values of $\gamma_2$ (with $n=2$) depending on $k_2$:

| $k_2$ | $\gamma_2$ values | Note             |
| ----: | ----------------- | ---------------- |
|     0 | $\set{0}$         | ┐                |
|     1 | $\set{0}$         | ┃                |
|     2 | $\set{0}$         | ┃ always zero    |
|     3 | $\set{0}$         | ┃                |
|     4 | $\set{0}$         | ┘                |
|     5 | $\set{-1, 0}$     | ┐                |
|     6 | $\set{-1, 0}$     | ┃                |
|   ... | ...               | ┃ always -1 or 0 |
|    14 | $\set{-1, 0}$     | ┃                |
|    15 | $\set{-1, 0}$     | ┘                |

The table shows that $\gamma_2$ starts being always zero for $k_2<5$ and then switches to being either $-1$ or $0$ for $k_2\ge 5$.

This pattern persists across all values for $i,n$, but the switch occurs at different values $k_i$. I will call the value $k_i$ where the switch occurs the critical value, denoted as $c_i$. Here are a few values of $c_i$ I determined experimentally (missing values were too slow to compute):

|   n | $c_1$ | $c_2$ | $c_3$ | $c_4$ | $c_5$ |
| --: | ----- | ----- | ----- | ----- | ----- |
|   1 | 1     | 3     | 7     | 15    | 31    |
|   2 | 1     | 5     | 21    | 85    | 341   |
|   3 | 1     | 9     | 73    | 585   | 4681  |
|   4 | 1     | 17    | 273   | 4369  | -     |
|   5 | 1     | 33    | 1057  | -     | -     |

The pattern is $c_i=\sum_{l=0}^{i-1} 2^{ln} = (2^{in}-1)/(2^n-1)$.

Showing that $k_i < c_i \implies \gamma_i=0$ is easy.

<details>
<summary>Proof:</summary>

$$
\gamma_i = \lfloor -\frac{k_i+1}{2^{in}} + \sum_{l=1}^{i} \frac{b+1}{2^{ln}} \rfloor
$$

Since $\gamma_i\in\set{-1,0}$ has already been proven, I just have to show that the lower bound of the expression inside the floor function is at least $0$. That expression has its minimum when $b$ is minimal ($\implies b=0$) and $k_i$ is maximal ($\implies k_i=c_i-1$). Plugging in those values gives:

$$
\begin{split}
-\frac{k_i+1}{2^{in}} + \sum_{l=1}^{i} \frac{b+1}{2^{ln}}
&= -\frac{c_i}{2^{in}} + \sum_{l=1}^{i} \frac{1}{2^{ln}} \\
&= -\frac{\sum_{l=0}^{i-1} 2^{ln}}{2^{in}} + \sum_{l=1}^{i} \frac{1}{2^{ln}} \\
&= -\sum_{l=1}^{i} \frac 1 {2^{ln}} + \sum_{l=1}^{i} \frac{1}{2^{ln}} \\
&= 0
\end{split}
$$

$\square$

</details>

With this proven, 2 facts about $\delta_i$ are now known:

1. $\delta_i \in \{-j_i-1,-j_i\}$.
2. $k_i < c_i \implies \delta_i = -j_i$.

Since $v=2^{in}+2^{n-1}-1$ corresponds to $a=\sum_{l=0}^{i-1} 2^{ln}=c_i$ and $b=0$, it follows from (2) that $a\in\set{0,...,c_i-1} \implies \delta_i=0$. This range of $a$ corresponds to inputs $v\in\set{2^{n-1},...,2^{in}+2^{n-1}-2}$. Together with the earlier result for $a=-1$, this proves that the approximation $R_i$ is correct for all inputs $v < 2^{in} + 2^{n-1} - 1$. $\square$

## Other rounding modes

As it turns out, other rounding modes can also be implemented by making a small modification to the approximation. Similar to how $R_i$ was defined, $F_i$ and $C_i$ can be defined for floor and ceiling division, respectively:

$$
\begin{split}
F_1 &:= \lfloor\frac{v+1}{2^n}\rfloor \\
F_{i+1} &:= \lfloor \frac{F_i + v+1}{2^n} \rfloor \\
C_1 &:= \lfloor\frac{v + 2^n - 1}{2^n}\rfloor \\
C_{i+1} &:= \lfloor \frac{C_i + v + 2^n - 1}{2^n} \rfloor \\
\end{split}
$$

where:

$$
\begin{split}
F_i &\approx \lfloor\frac{v}{2^n-1}\rfloor \\
C_i &\approx \lceil\frac{v}{2^n-1}\rceil \\
\end{split}
$$

$F_i$ is exact for all inputs $v < 2^{in} + 2^n - 2$, and $C_i$ is exact for all inputs $v < 2^{in}$.

### Proving correctness for floor division

The proof for floor division is very similar to the proof for rounded division. The main difference is that $v$ is split differently. Let $v=a_F(2^n-1)+b_F+2^n-1$ with $a_F,b_F$ defined similarly to before. Let $\delta_i^F := F_i - \lfloor v/(2^n-1) \rfloor$ be the error term for floor division after $i$ iterations. Simplifying the error term gives:

$$
\begin{split}
\delta_1^F &= F_1 - \lfloor \frac v {2^n-1} \rfloor \\
&= \lfloor\frac{v + 1}{2^n}\rfloor - \lfloor \frac v {2^n-1} \rfloor \\
&= \lfloor\frac{a_F(2^n-1)+b_F+2^n-1 + 1}{2^n}\rfloor - \lfloor \frac{a_F(2^n-1)+b_F+2^n-1}{2^n-1} \rfloor \\
&= \lfloor\frac{b_F - a_F}{2^n} + a_F+1 \rfloor - a_F-1 \\
&= \lfloor\frac{b_F - a_F}{2^n} \rfloor
\end{split}
$$

$$
\begin{split}
\delta_{i+1}^F &= F_{i+1} - \lfloor \frac v {2^n-1} \rfloor \\
&= \lfloor \frac{F_i + v+1}{2^n} \rfloor - \lfloor \frac v {2^n-1} \rfloor \\
&= \lfloor \frac{\delta_i^F + \lfloor \frac v {2^n-1} \rfloor + v+1}{2^n} \rfloor - \lfloor \frac v {2^n-1} \rfloor \\
&= \lfloor \frac{\delta_i^F + a_F+1 + v+1}{2^n} \rfloor - a_F-1 \\
&= \lfloor \frac{\delta_i^F + a_F + a_F(2^n-1)+b_F+2^n-1+1}{2^n} \rfloor - a_F -1\\
&= \lfloor \frac{\delta_i^F +b_F+1}{2^n}+a_F+1 \rfloor - a_F -1\\
&= \lfloor \frac{\delta_i^F +b_F+1}{2^n} \rfloor \\
\end{split}
$$

Note that $\delta_i^F$ has the same recursive structure as $\delta_i$ (rounded division). Therefore, the rest of the proof follows the same steps as before, leading to the conclusion that $F_i$ is exact for all inputs $v < 2^{in} + 2^n - 2$. Writing out this proof will be left as an exercise to the reader. $\square$

### Proving correctness for ceiling division

Same game again. Let $v=a_C(2^n-1)+b_C+1$ with $a_C,b_C$ defined similarly to before. Let $\delta_i^C := C_i - \lceil v/(2^n-1) \rceil$ be the error term for ceiling division after $i$ iterations. Simplifying the error term gives:

$$
\begin{split}
\delta_1^C &= C_1 - \lceil \frac v {2^n-1} \rceil \\
&= \lfloor\frac{v + 2^n-1}{2^n}\rfloor - \lfloor \frac {v+2^n-2} {2^n-1} \rfloor \\
&= \lfloor\frac{a_C(2^n-1)+b_C+1+2^n-1}{2^n}\rfloor - \lfloor \frac{a_C(2^n-1)+b_C+1+2^n-2}{2^n-1} \rfloor \\
&= \lfloor\frac{b_C - a_C}{2^n} + a_C+1 \rfloor - a_C-1 \\
&= \lfloor\frac{b_C - a_C}{2^n} \rfloor
\end{split}
$$

$$
\begin{split}
\delta_{i+1}^C &= C_{i+1} - \lceil \frac v {2^n-1} \rceil \\
&= \lfloor \frac{C_i + v+2^n-1}{2^n} \rfloor - \lceil \frac v {2^n-1} \rceil \\
&= \lfloor \frac{\delta_i^C + \lceil \frac v {2^n-1} \rceil + v+2^n-1}{2^n} \rfloor - \lceil \frac v {2^n-1} \rceil \\
&= \lfloor \frac{\delta_i^C + a_C+1 + v+2^n-1}{2^n} \rfloor - a_C-1 \\
&= \lfloor \frac{\delta_i^C + a_C + a_C(2^n-1)+b_C+1+2^n-1}{2^n} \rfloor - a_C -1\\
&= \lfloor \frac{\delta_i^C +b_C+1}{2^n}+a_C+1 \rfloor - a_C -1\\
&= \lfloor \frac{\delta_i^C +b_C+1}{2^n} \rfloor \\
\end{split}
$$

Same as before, $\delta_i^C$ has the same recursive structure as $\delta_i$ (rounded division). Therefore, the rest of the proof follows the same steps as before, leading to the conclusion that $C_i$ is exact for all inputs $v < 2^{in}$. Writing out this proof will be left as an exercise to the reader. $\square$

## Interesting extra: Division by $2^n+1$

Similar to how:

$$
\frac v {2^n-1} = \frac {v + \frac{v} {2^n-1}}{2^n}
$$

something similar is also true for division by $2^n+1$:

$$
\frac v {2^n+1} = \frac {v - \frac{v} {2^n+1}}{2^n}
$$

So, is turning one plus into a minus enough to make the trick work for division by $2^n+1$? No. Well, it is _almost_ enough.

As it turns out, the number added to $v$ (called `round` in the code) has to be changed for floor and ceiling division. Furthermore, the _evenness_ of the iteration count $i$ also matters.

```rs
enum RoundingMode {
    Floor,
    Round,
    Ceil,
}
fn div_2pn_p1(v: u32, n: u32, i: u32, mode: RoundingMode) -> u32 {
    let round = match mode {
        RoundingMode::Floor => 0,
        RoundingMode::Round => 1 << (n - 1),
        RoundingMode::Ceil => 1 << n,
    };
    let w = v + round - i % 2;
    let mut r = w >> n;
    for _ in 1..i {
        r = (w - r) >> n;
    }
    r
}
```

As before, here are tables for the smallest inputs $v$ the approximations start to fail for. First for rounded division by $2^n+1$:

|   n | $i=1$     | $i=2$        | $i=3$        | $i=4$       | $i=5$       | $i=6$      | $i=7$      | $i=8$      |
| --: | --------- | ------------ | ------------ | ----------- | ----------- | ---------- | ---------- | ---------- |
|   1 | $2^1+2$   | $2^2+1$      | $2^3+2$      | $2^4+1$     | $2^5+2$     | $2^6+1$    | $2^7+2$    | $2^8+1$    |
|   2 | $2^2+3$   | $2^4+2$      | $2^6+3$      | $2^8+2$     | $2^{10}+3$  | $2^{12}+2$ | $2^{14}+3$ | $2^{16}+2$ |
|   3 | $2^3+5$   | $2^6+4$      | $2^9+5$      | $2^{12}+4$  | $2^{15}+5$  | $2^{18}+4$ | $2^{21}+5$ | $2^{24}+4$ |
|   4 | $2^4+9$   | $2^8+8$      | $2^{12}+9$   | $2^{16}+8$  | $2^{20}+9$  | $2^{24}+8$ | $2^{28}+9$ | -          |
|   5 | $2^5+17$  | $2^{10}+16$  | $2^{15}+17$  | $2^{20}+16$ | $2^{25}+17$ | -          | -          | -          |
|   6 | $2^6+33$  | $2^{12}+32$  | $2^{18}+33$  | $2^{24}+32$ | -           | -          | -          | -          |
|   7 | $2^7+65$  | $2^{14}+64$  | $2^{21}+65$  | $2^{28}+64$ | -           | -          | -          | -          |
|   8 | $2^8+129$ | $2^{16}+128$ | $2^{24}+129$ | -           | -           | -          | -          | -          |

Second for ceiling division by $2^n+1$:

|   n | $i=1$   | $i=2$    | $i=3$      | $i=4$    | $i=5$      | $i=6$    | $i=7$      | $i=8$    |
| --: | ------- | -------- | ---------- | -------- | ---------- | -------- | ---------- | -------- |
|   1 | $2^1+1$ | $2^{2}$  | $2^{3}+1$  | $2^{4}$  | $2^{5}+1$  | $2^{6}$  | $2^{7}+1$  | $2^{8}$  |
|   2 | $2^2+1$ | $2^{4}$  | $2^{6}+1$  | $2^{8}$  | $2^{10}+1$ | $2^{12}$ | $2^{14}+1$ | $2^{16}$ |
|   3 | $2^3+1$ | $2^{6}$  | $2^{9}+1$  | $2^{12}$ | $2^{15}+1$ | $2^{18}$ | $2^{21}+1$ | $2^{24}$ |
|   4 | $2^4+1$ | $2^{8}$  | $2^{12}+1$ | $2^{16}$ | $2^{20}+1$ | $2^{24}$ | $2^{28}+1$ | -        |
|   5 | $2^5+1$ | $2^{10}$ | $2^{15}+1$ | $2^{20}$ | $2^{25}+1$ | -        | -          | -        |
|   6 | $2^6+1$ | $2^{12}$ | $2^{18}+1$ | $2^{24}$ | -          | -        | -          | -        |
|   7 | $2^7+1$ | $2^{14}$ | $2^{21}+1$ | $2^{28}$ | -          | -        | -          | -        |
|   8 | $2^8+1$ | $2^{16}$ | $2^{24}+1$ | -        | -          | -        | -          | -        |

And lastly for floor division by $2^n+1$:

|   n | $i=1$ | $i=2$        | $i=3$ | $i=4$        | $i=5$ | $i=6$       | $i=7$ | $i=8$      |
| --: | ----- | ------------ | ----- | ------------ | ----- | ----------- | ----- | ---------- |
|   1 | $0$   | $2^{2}+2$    | $0$   | $2^{4}+2$    | $0$   | $2^{6}+2$   | $0$   | $2^{8}+2$  |
|   2 | $0$   | $2^{4}+4$    | $0$   | $2^{8}+4$    | $0$   | $2^{12}+4$  | $0$   | $2^{16}+4$ |
|   3 | $0$   | $2^{6}+8$    | $0$   | $2^{12}+8$   | $0$   | $2^{18}+8$  | $0$   | $2^{24}+8$ |
|   4 | $0$   | $2^{8}+16$   | $0$   | $2^{16}+16$  | $0$   | $2^{24}+16$ | $0$   | -          |
|   5 | $0$   | $2^{10}+32$  | $0$   | $2^{20}+32$  | $0$   | -           | $0$   | -          |
|   6 | $0$   | $2^{12}+64$  | $0$   | $2^{24}+64$  | $0$   | -           | $0$   | -          |
|   7 | $0$   | $2^{14}+128$ | $0$   | $2^{28}+128$ | $0$   | -           | $0$   | -          |
|   8 | $0$   | $2^{16}+256$ | $0$   | -            | $0$   | -           | $0$   | -          |

Floor division fails at $v=0$ for odd iteration counts, because it tries to compute `v - 1`. This either (1) panics or (2) underflows to a huge number. If (3) the backing number type is _signed_, so that `w = -1` can be represented, then the function returns `-1`, which is also incorrect. No matter what, it's wrong.

If $v=0$ is ignored, the table for floor division looks like this:

|   n | $i=1$     | $i=2$        | $i=3$        | $i=4$        | $i=5$       | $i=6$       | $i=7$       | $i=8$      |
| --: | --------- | ------------ | ------------ | ------------ | ----------- | ----------- | ----------- | ---------- |
|   1 | $2^1+3$   | $2^{2}+2$    | $2^{3}+3$    | $2^{4}+2$    | $2^{5}+3$   | $2^{6}+2$   | $2^{7}+3$   | $2^{8}+2$  |
|   2 | $2^2+5$   | $2^{4}+4$    | $2^{6}+5$    | $2^{8}+4$    | $2^{10}+5$  | $2^{12}+4$  | $2^{14}+5$  | $2^{16}+4$ |
|   3 | $2^3+9$   | $2^{6}+8$    | $2^{9}+9$    | $2^{12}+8$   | $2^{15}+9$  | $2^{18}+8$  | $2^{21}+9$  | $2^{24}+8$ |
|   4 | $2^4+17$  | $2^{8}+16$   | $2^{12}+17$  | $2^{16}+16$  | $2^{20}+17$ | $2^{24}+16$ | $2^{28}+17$ | -          |
|   5 | $2^5+33$  | $2^{10}+32$  | $2^{15}+33$  | $2^{20}+32$  | $2^{25}+33$ | -           | -           | -          |
|   6 | $2^6+65$  | $2^{12}+64$  | $2^{18}+65$  | $2^{24}+64$  | -           | -           | -           | -          |
|   7 | $2^7+129$ | $2^{14}+128$ | $2^{21}+129$ | $2^{28}+128$ | -           | -           | -           | -          |
|   8 | $2^8+257$ | $2^{16}+256$ | $2^{24}+257$ | -            | -           | -           | -           | -          |

Better. However, this makes the trick less useful for floor division by $2^n+1$, since it requires an even iteration count or special handling for $v=0$.

In any case, this is all I have for division by $2^n+1$. I haven't formally analyzed the error terms, so I can't explain why it works and why the weirdness around odd iteration counts exists.

For those inclined, this might be a fun exercise to spend the weekend on.
