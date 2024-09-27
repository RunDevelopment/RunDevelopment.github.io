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

-   $\N = \set{0,1,2,3,...}$
-   $\N_1 = \N \setminus \set{0} = \set{1,2,3,...}$
-   $\R^+ = [0,\infin)$

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

The multiply-add method can handle more than just floor division. We can generalize by:

1. Multiplying with a fraction. So instead of $x/D$, we'll do $x \cdot T / D$.
2. Using a different rounding function. Instead of just flooring/truncating the result, we can use an arbitrary rounding function (e.g. `round` or `ceil`).

With these 2 changes, here's the generalized problem:

Given $D,T,U\in\N_1$, and a rounding function $R:\R^+\to\N$ where $R$ is monotonically increasing and $\forall i \in \N : R(i) = i$, find constants $f,a,s\in\N$ such that $\forall x\in\set{0,...,U}$:

$$
R(x \cdot \frac{T}{D}) = \lfloor \frac{xf + a}{2^s} \rfloor
$$

This is the main equation of the **Generalized Multiply-Add method** (GMA). The definition is more complex that the original one, but not by much. We are mostly interested in common rounding functions (`round`, `floor`, `ceil`), so $R$ isn't all that different from the original definition.

Using brute force, it's already possible to find the constants for a given problem. However, the search space is quite large, so we need to be smart about how we search it. Let's start by analyzing the problem.

I'll quickly note that since $f$ and $a$ depend on $s$, the algorithm we'll develop will first pick an $s$ and then try to find values for $f$ and $a$. This means that in our analysis, we can assume that $s$ is fixed.

## Analyzing GMA

To quickly recap, all of the theorems will use the following variables and terms:

-   $D \in \N_1$ is the divisor of the fraction.
-   $T \in \N_1$ is the denominator of the fraction.
-   $U \in \N_1$ is the maximum value of $x$ that we want to check.
-   $R$ is a function that satisfies the following properties:
    1. $\forall i \in \N : R(i) = i$,
    2. $R$ is monotonically increasing.
-   $f, a, s \in \N$ are the constants that we want to find.
-   A triple $(f, a, s)$ is a _solution_ iff it satisfies the equation for all $x \in \N_0, 0 \le x \le U$:

The problem is to find triples that fulfill the following equation for all $x\in\set{0,...,U}$:

$$
R(x \cdot \frac{T}{D}) = \lfloor \frac{xf + a}{2^s} \rfloor
$$

**Inequality definition:** We'll quickly note that by applying $z-1 < \lfloor z \rfloor \le z, \forall z\in \R$, it follows the above equation can be rewritten as:

$$
R(xT/D) \le \frac{xf + a}{2^s} < R(xT/D) + 1
$$

This alternative definition will be used later for geometric arguments.

<div class="info">

Theorems will reference each other as "T1", "T2", and so on. Theorems "A1" and so on can be found in the appendix.

</div>

### Theorem 1

A triple $(f,a,s)$ is a solution iff $(2f, 2a, s+1)$ and $(2f, 2a + 1, s+1)$ are solutions.

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

**Notes:**

1. It trivially follows that if one solution exists, then infinitely many solutions exist. So every problem either has no solutions or infinitely many.
2. It follows that if $(f,a,s)$ is a solution with $f$ is even and $s > 0$, then $(f/2, \lfloor a/2\rfloor, s-1)$ is a solution.
3. The process from note 2 can be repeated $k$ times. Let $k\in\N$ and $(f,a,s)$ be a solution such that $f$ is divisible by $2^k$ and $s>k$. Then $(f/2^k, \lfloor a/2^k\rfloor, s-k)$ is a solution.

### Definition: _minimal_ and _derived_ solutions

Solutions can be categorized into 2 groups: _minimal_ and _derived_. A solution $(f,a,s)$ is called _derived_ iff there exists a solution $(f',a',s')$ such that $f=2f'$, $a\in\set{2a',2a'+1}$, and $s=s'+1$. Otherwise, the solution is called _minimal_.

**Notes:**

1. It's obvious that a solution is minimal iff $f$ is odd or $s=0$.

### Theorem 2: upper bound for $a$

If $(f,a,s)$ is a solution, then $a < 2^s$.

**Proof:** If $a \ge 2^s$, then substituting $x=0$ results in $\lfloor (xf+a)/2^s \rfloor = \lfloor a/2^s \rfloor \ge 1 \ne 0 = R(0)$, which contradicts with the requirement that $(f,a,s)$ is a solution. $\square$

**Notes:**

1. It trivially follows that $s = 0 \implies a = 0$.
1. Even if we allowed $a$ to be negative ($a\in\Z$), a similar argument could be made for why no solution can have an $a < 0$.

### Theorem 3: there are no gaps between solutions in $a$

Let $k\in\N, k\ge 2$. If $(f,a,s)$ and $(f,a+k,s)$ are solutions, then all triples $\set{(f,a+j,s) | j \in \N ,0\le j \le k}$ are solutions.

**Proof:** Since $(f,a,s)$ and $(f,a+k,s)$ are solutions, using the inequality definition, it follows that for all $j \in\N, 0 \le j \le k$:

$$
R(xT/D) \le \frac{x f + a}{2^s} \le \frac{x f + a+j}{2^s} \le \frac{x f + a+k}{2^s} < R(xT/D) + 1
$$

Since all triples $(f,a+j,s)$ fulfill the inequality definition for a solution, they must be solutions. $\square$

**Notes:**

1. This basically means that there are no gaps between solutions with the same $f$ and $s$.
2. This is very interesting to us, because it means that an algorithm to solve the problem can find a whole range of solutions at once. This enables tricks like binary search to find $a$ values, which is very important, because the search space for $a$ grows exponentially with $s$.

### Theorem 4

Let $V = R(U\cdot T/D)$. If $(f,a,s)$ is a solution, then:

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

Using $0 \le a < 2^s$, $a$ can be removed using $(V-1) \cdot 2^s = V \cdot 2^s - 2^s < V \cdot 2^s - a$ and $(V+1) \cdot 2^s - a \le (V+1) \cdot 2^s$. This leaves only:

$$
\frac{(V-1) \cdot 2^s}U < f < \frac{(V+1) \cdot 2^s}U \space \square
$$

**Notes:**

1. For $s=0$, since $f$ needs to be an integer, the bounds can only satisfied for $f = V/U$, which only work when $V \bmod U =0$.
2. From the lower bound, it follows that $V > 0 \implies f > 0$. This means that if $R(xT/D)$ is **not** a constant zero function, then $f \ne 0$.
3. Unfortunately, these bounds are not very tight as they grow exponentially with $s$.

### Definition: _solution range_

We know that solutions come in ranges of $a$ values. This is a useful way to think about solutions, so let's formalize it.

A tuple $(f,A,s), A\subseteq\N$ is called a _solution range_ iff $A \ne \empty$, all $(f,a,s), a\in A$ are solutions, and there exists no $a \notin A$ such that $(f,a,s)$ is a solution.

In other words, a solution range is a non-empty set of all solutions for a given $f$ and $s$.

**Notes:**

1. Because of Theorem 3, a solution range can be defined by its minimum and maximum $a$ values.
2. The definitions for _minimal_ and _derived_ naturally extend to solution ranges, as a solution range can only contain one kind of solution.

### The geometric interpretation of solutions

The inequality definition lends itself to interpret solutions geometrically. Here's the inequality definition again:

$$
R(xT/D) \le \frac{xf + a}{2^s} < R(xT/D) + 1
$$

We can think of this definition as the linear function $y = (xf + a)/2^s$ being in between 2 step functions.

Here's an example for $D=3, T=1, U=1, R(x) = round(x)$ with the solution $f=5,a=9,s=4$. The two step functions are in blue and $(xf + a)/2^s$ is in red:

![](./round-1-over-3-solution.png)

So a solution is just a linear function that is between 2 step functions for all $x\in\set{0,...,U}$. This is a very useful way to think about solutions, because it allows us to reason about them geometrically.

Solution ranges also have a similar geometric interpretation: parallel lines. A solution range is just a range of linear function with the same slope and different offsets. For the same problem as above, the solution range $f=5,A=\set{8,9,10},s=4$ looks like this:

![](./round-1-over-3-solution-range.png)

(This is also a simple visual proof for theorem 3.)

Derived solutions can also be interpreted geometrically. If $(f,a,s)$ is a solution, then $(2f,2a,s+1)$ and $(2f,2a+1,s+1)$ are solutions. While $(2f,2a,s+1)$ is the same linear function as $(f,a,s)$, the solution $(2f,2a+1,s+1)$ is offset slightly:

$$
\frac{x\cdot 2f + 2a + 1}{2^{s+1}} = \frac{xf + a + 0.5}{2^s}
$$

Here is a zoomed in view of the same solution range as before (red), with their derived solutions (green), and the derived solutions of the derived solutions (black). Derived solutions that are the same linear function as the solution they are derived from are not shown.

![](./derive.png)

As we can see, the derived solutions are always half a step above from the original solutions.

### Theorem 5

Let $k\in\N,k\ge 1$. If $(f,A_0,s)$ and $(f+k,A_k,s)$ are solution ranges, then:

1. $\min \space A_0 \ge \min \space A_k$, and
2. $\max \space A_0 \ge \max \space A_k$.

**Proof:** Let's start by observing that the statements are trivially true if $\min \space A_k = 0$ and $\max \space A_k = 0$ respectively. This also means that the statements are true for $s=0$, since $s=0 \implies A_0 = A_k = \set{0}$. From here on, we will only consider cases with $s>0$, $\min \space A_k > 0$, and $\max \space A_k > 0$.

First, $\min \space A_0 \ge \min \space A_k$:

Let $a_k = \min \space A_k$. Since $a_k>0$ is the smallest $a$ for which $(f+k,a,s)$ is a solution, we know that $(f+k,a_k-1,s)$ is not a solution. Since $(f+k,a_k-1,s)$ fulfills the equation for $x=0$, there must exists some $x_r>0$ where it contradicts the inequality definition (specifically the lower bound):

$$
\frac{x_r(f+k)+a_k-1}{2^s} < R(x_rT/D)
$$

From this, it follows that for any $j \in \N_1$:

$$
\frac{x_rf+a_k-j}{2^s} \le \frac{x_rf+a_k-1}{2^s} < \frac{x_r(f+k)+a_k-1}{2^s} < R(x_rT/D)
$$

By this inequality, it follows that no $(f,a_k-j,s)$ can be a solution, because they do not fulfill the inequality definition for $x_r$. It follows that $\min \space A_0 \ge \min \space A_k = a_k$.

Now for $\max \space A_0 \ge \max \space A_k$:

Let $a_0 = \max \space A_0$. We'll note that the statement is trivially true if $a_0 = 2^s-1$ by theorem 2. So only need to consider $a_0 < 2^s-1$. Since $a_0$ is the largest $a$ for which $(f,a_0,s)$ is a solution, we know that $(f,a_0+1,s)$ is not a solution. Since $(f,a_0+1,s)$ fulfills the equation for $x=0$, there must exists some $x_r>0$ where it contradicts the inequality definition (specifically the upper bound):

$$
R(x_rT/D) + 1 \ge \frac{x_rf+a_0+1}{2^s}
$$

From this, it follows that for any $j \in \N_1$:

$$
R(x_rT/D) + 1 \ge \frac{x_rf+a_0+1}{2^s} > \frac{x_r(f+k)+a_0+1}{2^s} \ge \frac{x_r(f+k)+a_0+j}{2^s}
$$

By this inequality, it follows that no $(f+k,a_0+j,s)$ can be a solution, because they do not fulfill the inequality definition for $x_r$. It follows that $a_0 = \max \space A_0 \ge \max \space A_k$.

$\square$

### Theorem 6

Let $k\in\N,k\ge 2$. If $(f,A_0,s)$ and $(f+k,A_k,s)$ are solution ranges, then a solution $(f+j,a_j,s), 0 < j < k$ exists.

**Proof:** We'll note that the statement is trivially true if $A_0 \cap A_k \ne \empty$. Any $a \in A_0 \cap A_k$ will make $(f+j,a,s)$ a solution, because they fulfill the inequality definition for a solution. For all $x \in \N, 0 \le x \le U$:

$$
R(xT/D) \le \frac{xf + a}{2^s} \le \frac{x(f+j) + a}{2^s} \le \frac{x(f+k) + a}{2^s} < R(xT/D) + 1
$$

The geometric interpretation of this is we could squeeze in the linear for $(f+j,a,s)$ between the linear functions for $(f,a,s)$ and $(f+k,a,s)$. Like this:

![](./intersect-at-x=0.png)

Now, let's handle the case where $A_0 \cap A_k = \empty$.

Let $a_0\in A_0, a_k \in A_k$. The geometric interpretation of the solution $(f, a_0, s)$ and $(f+k,a_k,s)$ is that of 2 lines that intersect at some $x_{\text{inter}}>0$. This is always the case, because the lines are not parallel and $a_0 > a_k$ (theorem 5).

![](./intersect-1.png)

(Note that $x_{\text{inter}}$ may not be an integer or even be greater than $U$. This doesn't matter for the proof.)

This means that we just have to choose $a_j$ such that the line for $(f+j,a_j,s)$ intersects the lines for $(f,a_0,s)$ and $(f+k,a_k,s)$ at the same $x_{\text{inter}}$. Of course, there is exactly one such line that fulfills this requirement.

From $(x_{\text{inter}}f+a_0)/2^s = (x_{\text{inter}}(f+j)+a_j)/2^s$, we can rearrange for $a_j$ to get:

$$
a_{j_ \text{ inter}} = a_0-j\cdot x_{\text{inter}}
$$

Unfortunately, this doesn't work as a solution, because $a_j$ needs to be an integer and $a_{j \text{ inter}}$ might not be. We can fix this problem by using the derived solutions. Let's add the derived solutions $(2f,2a_0+1,s+1)$ and $(2f,2a_k+1,s+1)$ to the plot (in green):

![](./intersect-2.png)

![](./intersect-3.png)

The derived solution also intersect at $x_{inter}$, just $1/2^{s+1}$ units higher (as is to be expected). If we let the linear of function $f+j$ go through the intersection point of the derived solutions instead, we get:

$$
a_{j \text{ inter derived}} = a_0-j\cdot x_{\text{inter}} + \frac{1}{2^{s+1}} = a_{j \text{ inter}}+ \frac{1}{2^{s+1}}
$$

While $a_{j \text{ inter derived}}$ (likely) also isn't an integer, we're gained some freedom.

Let $p=a_{j \text{ inter}}$ and $q\in[p, p+\frac{1}{2^{s+1}}]$. Any linear function

$$
\frac{x(f+j)+q}{2^s}
$$

will will always be between the two step functions, because it will always be inside the area enclosed by the linear functions for $(f,a_0,s)$, $(f+k,a_k,s)$, and their derived solutions.

If we expand the function with $2^{s+1}$, we get:

$$
\frac{2^{s+1}x(f+j)+2^{s+1}q}{2^{2s-1}}
$$

Since $q$ is in the range $[p, p+\frac{1}{2^{s+1}}]$, $2^{s+1}q$ is in the range $[2^{s+1}p, 2^{s+1}p+1]$. This interval contains at least one integer, so pick any integer $o \in \N \cap [p, p+\frac{1}{2^{s+1}}]$. Then we know that $(2^{s+1}(f+j),o,2s+1)$ is a solution. Using theorem 1 note 3, we find that $(f+j,\lfloor o/2^{s-1} \rfloor,s)$ is a solution. $\square$

TODO: more rigorous proof. Show that $o$ is in range to be a valid solution.

### Theorem 7

There is at most one _solution range_ with the smallest $s$.

**Proof:** The statement is trivially true if there are no solutions. If there are solutions, then let $(f,A,s)$ be a solution range with the smallest $s$. There are two cases:

1. $s=0$. By theorem 3 note 1, there is exactly one value for $f$ that can fulfill the bounds for $f$. Therefore, there is at most one solution range with $s=0$. Since there is no natural number smaller than $0$, there can't be another solution range with a smaller $s$.
2. $s>0$. Suppose there was another solution range $(f',A',s),f'\ne f$. By theorem 6, there must be solution ranges for all factors between $f$ and $f'$. Since $f \ne f'$, there must be at least one solution range with an _even_ factor. However, a solution range with an even factor and $s>0$ is derived, meaning that there exists another solution range for $s-1$. This contradicts the assumption that $(f,A,s)$ is a solution range with the smallest $s$. Therefore, $(f,A,s)$ must be the only solution range for the smallest $s$. $\square$

**Notes:**

1. Obviously, the smallest solution range will be minimal.
2. Together with theorem 1 and theorem 7, this reveals something interesting about the shape of the solution space. If we order and group all solution ranges by $s$, we notices that the number of solution ranges per $s$ starts with 1 and then grows monotonically. This means that the solution space is a pyramid with a single solution range at the top and multiple solution ranges in the layers further down.

## Finding the smallest solution range

We know a lot about the connections between solutions and solution ranges, but that only applies when we have a solution to start with. So let's talk about how we can find the smallest solution range.

A simple brute-force algorithm to find the smallest solution range could look like this:

```py
for s in Naturals:
    for f in Naturals: # TODO: use bounds
        A = {} # empty set
        for a in range(0, 2**s):
            if is_solution(f, a, s):
                A.add(a)
        if A != {}:
            return (f, A, s)
```

This algorithm will find the smallest solution range, because it checks every possible solution in order of $s$. We'll later proof that a smallest solution always exists for certain classes of rounding function, so this algorithm will always terminate.

Obviously, brute force this is _very_ slow. We'll talk about efficient ways to determine $A$ from $f$ and $s$ later, so let's focus on finding the right $f$ and $s$ first.

### Changes to the problem statement

For the next section, we need to make two changes to the problem statement of the generalized multiply-add method:

1. $T$ and $D$ must be coprime.

    Since the GMA only cares about the ratio $T/D$, we just need to simplify the fraction.

2. $R$ must be a floor-like rounding function.

    The GMA is defined by $R(xT/D)$. No matter $T$ and $D$, $R$ will only ever see inputs of the form $m/n$ for $m\in\N,n\in\N_1$. So defining the rounding function as $\R^+ \to \N$ was too general. We only need $ℚ^+ \to \N$.

    This opens the door for expressing common rounding functions in terms of flooring. E.g. $round(m/n)=\lfloor (m + \lfloor n/2 \rfloor)/n \rfloor$ and $\lceil m/n \rceil=\lfloor (m + n-1)/n \rfloor$. In general, there is a class of rounding functions that can be expressed as $R(m/n) = \lfloor (m + r_n)/n \rfloor$ for $r_n\in\N,r_n<n$.

    With this new rounding function, we can express the problem as:

    $$
    R(x \cdot \frac{T}{D}) = \lfloor \frac{xT+r_D}{D} \rfloor = \lfloor \frac{xf + a}{2^s} \rfloor
    $$

### Trivial solutions

1. If $V=R(U\cdot T/D)=0$, then $(f,A,s)=(0,\set{0},0)$ is a smallest solution range.

    $V=0$ means that $R(xT/D)$ is a constant zero function, this is a trivial solution.

2. If $D=1$, then $(f,A,s)=(T,\set{0},0)$ is a smallest solution range.

    $R(xT/D)=R(xT)=xT$, so choosing $f=T$ gives us the smallest solution.

3. If $D=2^k$ for $k\in\N_1$, then $(f,a,s)=(T,r_D,k)$ is a solution. (But **not** necessarily part of the smallest solution range!)

    $R(xT/D) = \lfloor (xT + r_D) / 2^k \rfloor = \lfloor (xf + a) / 2^s \rfloor$. (This is one reason why we required floor-like rounding functions.)

### Theorem 8

If $(f,A,s),s>0$ is the smallest solution range, then there is exactly one odd positive integer closest to $T \cdot 2^s / D$. "Closest" is here defined has having the minimum absolute difference to $T \cdot 2^s / D$.

**Proof:** Let's start with the "positive" part. $T>0 \land 2^s>0 \implies T \cdot 2^s / D > 0$. Since the number will always be positive, the distance to any negative odd integer will also be greater than 1, while the distance to any positive odd integer will be at most 1. So the closest odd integer will be positive.

Now for the "exactly one" part. Only even numbers have two closest odd integers, so we just need to show that $T \cdot 2^s / D$ cannot be even.

We know that $D\ne 1$, because $D=1$ means that the smallest solution range is for $s=0$, which contradicts with the requirement $s>0$. Since $T$ and $D$ are coprime, we know that $T/D$ cannot be an integer. This means that $T \cdot 2^s / D$ can only be an integer if $D$ is a power of 2. Since $(T, r_D, k)$ is a solution if $D=2^k$, we know that $s\le k$, because $s$ is from the smallest solution range. For $s<k$, $T \cdot 2^s / D$ is not an integer. For $s=k$, $T \cdot 2^s / D = T$. Since $T$ is coprime with $D$ and $D$ is a power of 2 greater than 1, $T$ is an odd integer. $\square$

### Conjecture 1

If $(f,A,s),s>0$ is the smallest solution range, then $f$ will be the odd integer closest to $T \cdot 2^s / D$.

**Indications for correctness:**

-   Since the smallest solution range is minimal and $s>0$, $f$ must be odd.
-   $f$ must also generally be close to $T \cdot 2^s / D$ to match the slope of $R(xT/D)$. In fact, $f=T \cdot 2^s / D$ is the limit for the bounds of $f$ as $U \to \infin$. Given those 2 facts, it seems reasonable that the above statement is true.
-   I was also unable to find a single counter-example through computer search.

Going forward, I will assume that this conjecture is true. This massively speeds up the search algorithm, because the number of factors it needs to check went from $O(2^s)$ to $O(1)$.

TODO: the actual algorthm

## Efficiently finding $A$

At this point, we picked $s$ and $f$, and we want to find $A$. There are multiple approaches we can go with.

### Binary search

A simple way of finding $A$ is via binary search. The basic idea here is that if an $a$ is too large, then all $a$ greater than it will also be too large. Similar for when $a$ is too small.

The basic algorithm looks like this:

```py
# Returns 0 if a is a valid solution, and -1 or 1 if a is too large or too small.
def verify(a):
    for x in range(0, U+1):
        diff = ((x*f + a) >> s) - R(x*T/D)
        if diff != 0:
            return diff
    return 0

def find_any_valid_a():
    return binary_search(range(0, 2**s), verify)
```

This allows us to quickly find a valid $a$ or error if there are no valid $a$ values. We can use 2 additional binary searches to find the minimum and maximum $a$ values.

```py
def find_A():
    a = find_any_valid_a()

    a_min = a
    a_max = a

    def find_min(a):
        result = verify(a)
        if result == 0:
            a_min = min(a_min, a)
            return 1
        return result
    def find_max(a):
        result = verify(a)
        if result == 0:
            a_max = max(a_max, a)
            return -1
        return result

    # these binary searches will fail, so ignore the errors
    # we only care about the side effects of find_min and find_max
    try: binary_search(range(0, a),find_min)
    try: binary_search(range(a+1, 2**s), find_max)

    return range(a_min, a_max+1)
```

**Complexity:** This algorithm runs in $O(U \cdot \log(2^s)) = O(U \cdot s)$ steps with $O(1)$ memory.

#### Not checking all inputs

As it turns out, we only need to check first and last $D$ inputs. This is because the function $R(xT/D) - xT/D$ is periodic with period $D$.

TODO: full argument

But that's not all. If $R(xT/D) = R((x+k)T/D), k\ge 2$, then all inputs $\set{x+1,...,x+k-1}$ do not need to be checked.

TODO: full argument

This means that only $O(\min \set{D,T,U})$ values of $x$ need to be checked. This is a huge win if any of these numbers is small. Overall, this brings down the runtime complexity of the binary search approach to $O(\min \set{D,T,U} \cdot s)$.

### Overlapping ranges

Another way to find $A$ is to determine the range of valid $a$ values for each input $x$, called $A_x$. Then $A = \bigcap_{x=0}^U A_x$.

This approach has the major advantage that we only have to go through all inputs once.

$A_x$ can easily be calculated using the inequality definition:

$$
\begin{split}
R(xT/D) &\le \frac{xf + a}{2^s} < R(xT/D)+1 \\
2^s \cdot R(xT/D) - xf &\le a < 2^s \cdot (R(xT/D)+1) - xf
\end{split}
$$

We can put this a bit more succinctly. Let $b=2^s \cdot R(xT/D) - xf$.

$$
b \le a \le b+2^s-1
$$

Last, we just need to make sure that this range is within the bounds of $a$. So we find that $A_x=[b,b+2^s-1] \cap[0,2^s-1]$.

**Complexity:** Since the runtime of this algorithm on depends on the number of inputs we need to check, it runs in $O(\min \set{D,T,U})$ steps with $O(1)$ memory.

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
