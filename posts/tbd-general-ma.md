---
datePublished: 2024-06-08
draft: true
inlineCodeLanguage: rust
---

# Generalized multiply-add method

In the last article, we went over different way to optimize the function $round(x \cdot 255 / 31)$ and the fastest solution was the multiply-add method. In this article, we will analyze the generalized multiply-add method (GMA) and develop and algorithm to quickly iterate all possible constants for a given GMA problem.

## Background

<div class="info">

A quick note on notation:

- $\N = \set{0,1,2,3,...}$
- $\N_1 = \N \setminus \set{0} = \set{1,2,3,...}$
- $\R^+ = [0,\infin)$

</div>

The multiply-add method is used by modern compilers to optimize division by a constant. Division is quite an expensive operation on modern CPUs, so compilers try to replace divisions with cheaper operations whenever possible. The multiply-add method is one way to achieve such an optimization. It works as follows:

Given $U,D\in\N_1$, find constants $f,a,s\in\N$ such that $\forall x\in\set{0,...,U}$:

$$
\lfloor \frac{x}{D} \rfloor = \lfloor \frac{xf + a}{2^s} \rfloor
$$

A few notes:

-   $U$ describes the input range. E.g. for 8-bit integers, $U=255$.
-   Modern CPUs perform _truncating_ division, meaning that they will discard the fractional part of the result. For unsigned integers, this is equivalent to flooring the result, which is why I used $\lfloor x/D\rfloor$ to denote integer division.
-   The floor division by $2^s$ is equivalent to a right bit-shift by $s$.

In programming terms, this means that we can replace `x / D` with `(x * f + a) >> s` and get the same result (with the right constants). Since the cost of multiplication + addition + bit-shift is lower than the cost of a single division, this can be a significant optimization.

However, that's not all. As it turns out, it's possible for find constants with $a=0$, meaning that we don't even have to pay for addition.

## Generalizing

While optimizing floor division is nice and all, the multiply-add method can be used for much more than that. We can generalize by:

1. Multiplying with a fraction. So instead of $x/D$, we'll do $x \cdot T / D$.
2. Using a different rounding function. Instead of just flooring/truncating the result, we can use an arbitrary rounding function (e.g. `round` or `ceil`).

With these 2 changes, here's the generalized problem:

Given $U,T,D\in\N_1$, and a rounding function $R:\R^+\to\N$ where $R$ is monotonically increasing and $\forall i \in \N : R(i) = i$, find constants $f,a,s\in\N$ such that $\forall x\in\set{0,...,U}$:

$$
R(x \cdot \frac{T}{D}) = \lfloor \frac{xf + a}{2^s} \rfloor
$$

This is the main equation of the **Generalized Multiply-Add method** (GMA). The definition is more complex that the original one, but not by much. We are mostly interested in common rounding functions (`round`, `floor`, `ceil`), so $R$ isn't all that different from the original definition.

Using brute force, it's already possible to find the constants for a given problem. However, the search space is quite large, so we need to be smart about how we search it. Let's start by analyzing the problem.

I'll quickly note that since $f$ and $a$ depend on $s$, the algorithm we'll develop will first pick an $s$ and then try to find values for $f$ and $a$. This means that in our analysis, we can assume that $s$ is fixed.

## Analyzing GMA

I'll quickly note that for practical reasons, we want $f$ to be as small as possible. CPUs use fixed-width registers, so the multiplication $x \cdot f$ might overflow. Since $f / 2^s$ has to be roughly equal to $1/D$, we want to find small values for $f$ and $s$.

---

## OLD

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
-   $x \in \N, 0 \le x \le D$ are the possible input values.

What are want values for $f \in \N_0$, $a \in \N_0$, and $s \in \N_0$ such that the triple $(f, a, s)$ is a solution for:

$$
\lfloor \frac{x \cdot f + a}{2^s} \rfloor = round(\frac{x}{D} \cdot T)
$$

Here's what we know:

1. If there exists a solution that satisfies the equation, then there are infinitely many solutions.

    If a triple $(f, a, s)$ is a solution, then $(f \cdot 2, a \cdot 2, s+1)$ and $(f \cdot 2, a \cdot 2 + 1, s+1)$ are also solutions.

    $$
    \begin{split}
    \lfloor \frac{x \cdot f \cdot 2 + a \cdot 2}{2^{s+1}} \rfloor
    &= \lfloor \frac{2 \cdot (x \cdot f + a)}{2 \cdot 2^s} \rfloor \\
    &= \lfloor \frac{x \cdot f + a}{2^s} \rfloor
    \end{split}
    $$

    $$
    \begin{split}
    \lfloor \frac{x \cdot f \cdot 2 + a \cdot 2 + 1}{2^{s+1}} \rfloor
    &= \lfloor \frac{x \cdot f + a + 0.5}{2^s} \rfloor \\
    &\overset{\text{A1}}= \lfloor \frac{x \cdot f + a}{2^s} \rfloor
    \end{split}
    $$

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
    \overset{\text{A2}}= \lfloor \frac{x \cdot f/2 + \lfloor a/2 \rfloor}{2^{s-1}} \rfloor
    $$

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

### Experimental results

From my experimentation, I also discovered the following properties:

8. There can be multiple minimal solutions, and there can be multiple minimal solutions with the same values for $f$ and $s$.

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

9. If a minimal solution exists for a given $s$, then a minimal solution does **not** always exist for $s+1$.

    E.g. for $D=99, T=255$, all solution with $s<13$ are:

    - $f=1319, a \in \set{244, 245, 246}, s=9$
    - $f=2638, a \in \set{488, ..., 493}, s=10$
    - $f=5275, a \in \set{1006, ..., 1056}, s=11$
    - $f=5276, a \in \set{976, ..., 987}, s=11$
    - $f=10549, a \in \set{2098, ..., 2126}, s=12$
    - $f=10550, a \in \set{2012, ..., 2113}, s=12$
    - $f=10551, a \in \set{1972, ..., 2054}, s=12$
    - $f=10552, a \in \set{1952, ..., 1975}, s=12$

Based on my experiments, I also believe that if $(f,a_0,s)$ and $(f+2,a_2, s)$ are solutions, then a solution $(f+1,a_1,s)$ exists.

### Generalizing the expression

In the above analysis, we did not fully use 2 properties of our equation:

$$
\lfloor \frac{x \cdot f + a}{2^s} \rfloor = round(\frac{x}{D} \cdot T), \space \forall x \in \N_0, 0 \le x \le D
$$

1. The bounds of $x$. They were only used implicitly in a few places and can easily be changed.
2. The properties of the $round$ function. We only used the property $round(i) = i, i \in \N$ and that it's monotonically increasing, but there are other functions that satisfy these property.

So let's modify the equation to:

$$
\lfloor \frac{x \cdot f + a}{2^s} \rfloor = R(\frac{x}{D} \cdot T), \space \forall x \in \N_0, 0 \le x \le U
$$

Where $U \in \N,U>0$ and $R$ is a function that satisfies the following properties:

1. $R(i) = i, i \in \Z$,
2. $R(x) \in \N, x\in\R$, and
3. $R$ is monotonically increasing.

Basically, we want $R$ to be a rounding function, but we don't require a specific rounding function. E.g. possible functions are $R(x) = round(x)$, $R(x) = \lfloor x \rfloor$, and $R(x) = \lceil x \rceil$.

We now have something very powerful. If we can find the right constants for $(f, a, s)$, we can multiply any number $x \in \set{0,1,...,U}$ with an arbitrary fraction $T/D$ and round it to an integer with an arbitrary rounding function $R$. We just need to find the right constants.

(Formal proofs for the above theorems for the generalized equation can be found in the appendix.)

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

### General theorems

A list of formal proofs for theorems used throughout the article.

#### A1

**Theorem:** Let $a,b \in \N, b \ne 0$ and $r\in\R,0\le r < 1$, then:

$$
\lfloor \frac{a + r}{b} \rfloor = \lfloor \frac{a}{b} \rfloor
$$

**Proof:** Since $r\ge 0$ and flooring is a monotonic increasing function, we know that $\lfloor a/b \rfloor \le \lfloor (a+r)/b \rfloor$. Since $r<1$, $a+r$ can never reach the next multiple of $b$. Therefore $\lfloor (a+r)/b \rfloor < \lfloor a/b \rfloor + 1$. Since flooring outputs integers, the statement follows from the above bounds. $\square$

#### A2

**Theorem:** Let $a,b,c \in \N, c \ne 0$. Then:

$$
\lfloor \frac{a + b/2}{c} \rfloor = \lfloor \frac{a + \lfloor b/2\rfloor}{c} \rfloor
$$

**Proof:**

1. If $b$ is even, then $b/2 = \lfloor b/2 \rfloor$. So the statement is trivially true.
2. If $b$ is odd, then $b/2 = \lfloor b/2 \rfloor + 0.5$. It follows that:

    $$
    \lfloor \frac{a + b/2}{c} \rfloor
    = \lfloor \frac{a + \lfloor b/2\rfloor + 0.5}{c} \rfloor
    \overset{\text{A1}}{=} \lfloor \frac{a + \lfloor b/2\rfloor}{c} \rfloor
    $$

$\square$

### Magic expression theorems

A list of formal proofs for theorems about the generalized magic expression.

All of the theorems use the following variables:

-   $D \in \N, D \ne 0$ is the divisor of the fraction.
-   $T \in \N, T \ne 0$ is the denominator of the fraction.
-   $U \in \N, U > 0$ is the maximum value of $x$ that we want to check.
-   $R$ is a function that satisfies the following properties:
    1. $R(i) = i, \forall i \in \N_0$,
    2. $R(x) \in \N, \forall x\in\R$, and
    3. $R$ is monotonically increasing.
-   $f, a, s \in \N$ are the magic constants that we want to find.
-   A triple $(f, a, s)$ is a _solution_ iff it satisfies the following equation for all $x \in \N_0, 0 \le x \le U$:
    $$
    \lfloor \frac{xf + a}{2^s} \rfloor = R(xT/D)
    $$

Notes:

1. From $z-1 < \lfloor z \rfloor \le z, \forall z\in \R$, it follows the above equation can be rewritten as:

    $$
    R(xT/D) \le \frac{xf + a}{2^s} < R(xT/D) + 1
    $$

    This alternative definition will be used later.

#### B1

**Theorem:** If $(f,a,s)$ is a solution and $R(0) \ne R(U\cdot T/D)$, then $f \ne 0$.

**Proof:** Let $c=\lfloor a / 2^s \rfloor$. If $f=0$, then the equation simplifies to $c = R(xT/D)$. Substituting $x=0$ and $x=U$, it follows that $c = R(0) \ne R(U\cdot T/D) = c$. Since $c \ne c$ is a contradiction, so $f=0$ must be wrong. $\square$

Notes:

1. $R(0) \ne R(U\cdot T/D)$ is always the case when $U \ge D/T$, because $U \ge D/T \implies U\cdot T/D \ge 1 \implies R(U\cdot T/D)) \ge 1 > 0 = R(0)$.
2. If $R(0) = R(U\cdot T/D)$, then $(f=0, a=0, s=0)$ is a trivial solution.

#### B2

**Theorem:** If $(f,a,s)$ is a solution, then $a < 2^s$.

**Proof:** If $a \ge 2^s$, then substituting $x=0$ results in $\lfloor a/2^s \rfloor \ge 1$. This contradits the requirement that $\lfloor a/2^s \rfloor < R(0) + 1 = 1$, so triples with $a \ge 2^s$ cannot be solutions. $\square$

Notes:

1. It trivially follows that $s = 0 \implies a = 0$.
1. If instead of $a\in\N$, it was defined as $a\in\Z$, a similar argument could be made for why no solution can have an $a < 0$.

#### B3

**Theorem:** Let $k\in\N, k\ge 2$. If $(f,a,s)$ and $(f,a+k,s)$ are solutions, then all triples $\set{(f,a+j,s) | j \in \N ,0\le j \le k}$ are solutions.

**Proof:** Since $(f,a,s)$ and $(f,a+k,s)$ are solutions, using the inequality definition for solution, it follows that for all $j \in\N, 0 \le j \le k$:

$$
R(xT/D) \le \frac{x f + a}{2^s} \le \frac{x f + a+j}{2^s} \le \frac{x f + a+k}{2^s} < R(xT/D) + 1
$$

Since all triples $(f,a+j,s)$ fulfill the inequality definition for a solution, they must be solutions. $\square$

#### B4

**Theorem:** If $(f,a,s)$ is a solution, then $(2f, 2a, s+1)$ and $(2f, 2a + 1, s+1)$ are solutions.

**Proof:**

$$
\begin{split}
\lfloor \frac{2 x f + 2a}{2^{s+1}} \rfloor
= \lfloor \frac{2 \cdot (x f + a)}{2 \cdot 2^s} \rfloor
&= \lfloor \frac{x f + a}{2^s} \rfloor
= R(xT/D) \\

\lfloor \frac{2x f + 2a + 1}{2^{s+1}} \rfloor
= \lfloor \frac{x f + a + 0.5}{2^s} \rfloor
&\overset{\text{A1}}= \lfloor \frac{x f + a}{2^s} \rfloor
= R(xT/D)
\end{split}
$$

$\square$

#### Definition: minimal solutions

A solution $(f,a,s)$ is _minimal_ iff there exists such solution $(f',a',s')$ such that $(f,s,a) = (2f', 2a', s'+1)$ or $(f,s,a) = (2f', 2a'+1, s'+1)$.

An alternative equivalent definition is that $(f,a,s)$ is _minimal_ iff $(f/2, \lfloor a/2 \rfloor, s-1)$ is not a solution.

Similarly, a solution is called _derived_ if it is not minimal.

#### B5

**Theorem:** If $(f,a,s)$ is a minimal solution and $s > 0$, then $f$ is odd.

**Proof:** If $f$ was even, then $(f/2, \lfloor a/2 \rfloor, s-1)$ would be a solution, because:

$$
\lfloor \frac{x f + a}{2^s} \rfloor
= \lfloor \frac{x \cdot \overbrace{f/2}^{\text{integer}} + a/2}{2^{s-1}} \rfloor
\overset{\text{A2}}= \lfloor \frac{x f/2 + \lfloor a/2 \rfloor}{2^{s-1}} \rfloor
$$

This contradicts with $(f,a,s)$ being _minimal_, so $f$ cannot be even. $\square$

#### B6

**Theorem:** Let $V = R(U\cdot T/D)$. If $(f,a,s)$ is a solution, then:

$$
\frac{(V-1)\cdot 2^s}U < f < \frac{(V+1)\cdot 2^s}U.
$$

**Proof:** Substituting $x=U$ and using the inequality definition for a solution results in:

$$
V \le \frac{U \cdot f + a}{2^s} < V + 1
$$

Rearranging for $f$:

$$
\frac{V \cdot 2^s - a}U \le f < \frac{(V+1) \cdot 2^s - a}U
$$

Using $0 \le a < 2^s$ to remove $a$ from the inequalities:

$$
\frac{(V-1) \cdot 2^s}U < f < \frac{(V+1) \cdot 2^s}U \space \square
$$

Notes:

1. For $s=0$, the bounds are $V/U \le f < (V+1)/U$. Note that these bounds can only be satisfied if $V \bmod U =0$.
2. Unfortunately, these bounds are not very tight as they grow exponentially with $s$.

#### B7

**Conjecture:** Let $a(f,s) = \set{ a | (f,a,s) \text{ is a solution}}$. Let $f,s \in\N$. If $a(f,s) \ne \empty$ and $a(f+1,s) \ne \empty$, then:

$$
min(a(f,s)) \le min(a(f+1,s)) \\
max(a(f,s)) \le max(a(f+1,s))
$$

#### B8

**Conjecture:** Let $k\in\N, k\ge 2$. If $(f,a,s)$ and $(f+k,a',s)$ are solutions, then a solution $(f+1,a'',s)$ exists.

Notes:

This can trivially be extended to show that there exist solutions $(f+j,a''_j,s)$ for any $j\in\N,0\le j\le k$.
