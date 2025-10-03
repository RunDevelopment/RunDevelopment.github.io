# pyright: strict
from dataclasses import dataclass
import math


@dataclass(frozen=True, kw_only=True)
class Problem:
    u: int
    t: int
    d: int
    r_d: int

    def __post_init__(self) -> None:
        assert self.u >= 0
        assert self.t >= 0
        assert self.d > 0
        assert 0 <= self.r_d < self.d

    @staticmethod
    def floor(u: int, t: int, d: int) -> "Problem":
        return Problem(u=u, t=t, d=d, r_d=0)

    @staticmethod
    def round(u: int, t: int, d: int) -> "Problem":
        return Problem(u=u, t=t, d=d, r_d=d // 2)

    @staticmethod
    def ceil(u: int, t: int, d: int) -> "Problem":
        return Problem(u=u, t=t, d=d, r_d=d - 1)

    def simplified(self) -> "Problem":
        if self.at(self.u) == 0:
            # the problem is a constant 0 function
            return Problem(u=self.u, t=0, d=1, r_d=0)

        gcd = math.gcd(self.t, self.d)
        return Problem(
            u=self.u,
            t=self.t // gcd,
            d=self.d // gcd,
            r_d=self.r_d // gcd,
        )

    def at(self, x: int) -> int:
        """
        Returns the value of the function at x.
        """
        return (x * self.t + self.r_d) // self.d


@dataclass(frozen=True, kw_only=True)
class Solution:
    f: int
    a: int
    s: int


@dataclass(frozen=True)
class Range:
    """
    A range of integers from min to max, inclusive.
    """

    min: int
    max: int

    def __post_init__(self) -> None:
        assert self.min <= self.max


@dataclass(frozen=True, kw_only=True)
class SolutionRange:
    f: int
    A: Range
    s: int

    def pick_any(self) -> Solution:
        f = self.f
        A = self.A
        s = self.s

        if A.min == 0:
            a = 0
        elif A.min <= f <= A.max:
            a = f
        elif A.max == 2**s - 1:
            a = A.max
        else:
            a = A.min

        return Solution(f=f, a=a, s=s)


U8: int = 2**8 - 1
U16: int = 2**16 - 1
U32: int = 2**32 - 1
U64: int = 2**64 - 1


def div_ceil(a: int, b: int) -> int:
    return -(a // -b)


def algorithm_1f(p: Problem, a: int, s: int, X: set[int]) -> Range | None:
    v = (p.u * p.t + p.r_d) // p.d
    f_min = div_ceil((v << s) - a, p.u)
    f_max = (((v + 1) << s) - a) // p.u

    for x in X:
        if x == 0:
            continue

        y = (x * p.t + p.r_d) // p.d

        f_min = max(f_min, div_ceil((y << s) - a, x))
        f_max = min(f_max, (((y + 1) << s) - a - 1) // x)

        if f_min > f_max:
            return None

    return Range(f_min, f_max)


def algorithm_1a(p: Problem, f: int, s: int, X: set[int]) -> SolutionRange | None:
    a_min = 0
    a_max = (1 << s) - 1

    for x in X:
        y = (x * p.t + p.r_d) // p.d

        a_min = max(a_min, (y << s) - x * f)
        a_max = min(a_max, ((y + 1) << s) - x * f - 1)

        if a_min > a_max:
            return None

    return SolutionRange(f=f, A=Range(a_min, a_max), s=s)


def find_minimal(p: Problem, log: bool = True) -> SolutionRange:
    p = p.simplified()

    if p.t == 0 or p.d == 1:
        # trivial solution
        return SolutionRange(f=p.t, A=Range(0, 0), s=0)

    if p.t >= p.d:
        # reduce the problem to a smaller one
        k = p.t // p.d
        solution = find_minimal(Problem(u=p.u, t=p.t % p.d, d=p.d, r_d=p.r_d), log=log)
        return SolutionRange(
            f=solution.f + (k << solution.s),
            A=solution.A,
            s=solution.s,
        )

    X = get_input_set(p)
    if log:
        print(f"|X| = {len(X)}")
    K = 1

    s = 0
    while True:
        f = get_closest_f(p, s, K)
        solution = algorithm_1a(p, f=f, s=s, X=X)
        if solution is not None:
            return solution
        s += 1


def get_closest_f(p: Problem, s: int, k: int) -> int:
    assert k > 0
    # find the closest odd integer to t/d*2**s
    closest_d = p.t << s
    close_floor = closest_d // p.d
    close_ceil = div_ceil(closest_d, p.d)
    if close_floor == close_ceil:
        return close_floor

    if close_floor % 2 == 0:
        return close_ceil
    else:
        return close_floor


def get_input_set(p: Problem) -> set[int]:
    def add_range(X: set[int], start: int, stop: int) -> set[int]:
        X.add(start)
        X.add(stop)
        jump = p.d // p.t - 1
        if jump > 0:
            last = p.at(start)

            # skip to the first x value for which p.at(x) > last
            x = ((last + 1) * p.d - p.r_d) // p.t - 1
            while x <= stop and p.at(x) <= last:
                x += 1

            if x > stop:
                return X

            assert p.at(x) == last + 1, f"failed for {start=} {stop=} {last=} {x=}"
            X.add(x - 1)
            X.add(x)
            last = p.at(x)

            while True:
                x += jump
                current = p.at(x)
                while current == last:
                    x += 1
                    current = p.at(x)

                if x > stop:
                    break

                X.add(x - 1)
                X.add(x)
                last = current
        else:
            # add the range start..stop
            X.update(range(start + 1, stop))
        return X

    if p.d * 2 < p.u:
        # only consider the first and last d values
        X = {0}
        add_range(X, 1, p.d + 1)  # this is shifted, because 1f ignores 0
        add_range(X, p.u - p.d, p.u)
        return X
    else:
        # consider all x values
        return add_range(set(), 0, p.u)


def find_a_zero(p: Problem) -> Solution | None:
    p = p.simplified()

    if p.t == 0 or p.d == 1:
        # trivial solution
        return Solution(f=p.t, a=0, s=0)

    if p.t >= p.d:
        # reduce the problem to a smaller one
        k = p.t // p.d
        solution = find_a_zero(Problem(u=p.u, t=p.t % p.d, d=p.d, r_d=p.r_d))
        if solution is None:
            return None
        return Solution(
            f=solution.f + (k << solution.s),
            a=0,
            s=solution.s,
        )

    X = get_input_set(p)

    # +10 to be safe
    s = math.ceil(math.log2(p.u)) + math.ceil(math.log2(p.d)) + 10
    F = algorithm_1f(p, a=0, s=s, X=X)
    if F is None:
        return None
    assert F.min > 0

    f = pick_most_even(F)
    while f % 2 == 0:
        f //= 2
        s -= 1

    return Solution(f=f, a=0, s=s)


def pick_most_even(range: Range) -> int:
    """
    Returns the most even number in the range.
    """
    a = range.min
    b = range.max
    if a == 0:
        return 0

    scale = 0
    while a < b:
        scale += 1
        a = (a + 1) // 2
        b = b // 2

    return a << scale


def verify(p: Problem, s: Solution | SolutionRange, log: bool = True) -> bool | None:
    """
    Verifies that the solution (range) is correct.
    """
    if min(p.u, p.d) > 1_000_000:
        print(f" ⚠️ {s}")
        print(" ⚠️ Unable to verify, because the input space is too large!")
        return None

    if isinstance(s, SolutionRange):
        s_min = Solution(f=s.f, a=s.A.min, s=s.s)
        s_max = Solution(f=s.f, a=s.A.max, s=s.s)
        correct = verify(p, s_min, log=False) and verify(p, s_max, log=False)
        assert correct is not None
    else:
        incorrect_x = None
        if p.d * 2 < p.u:
            # only check the first and last d values
            for x in range(0, p.d + 1):
                if p.at(x) != (x * s.f + s.a) >> s.s:
                    incorrect_x = x
                    break
            if incorrect_x is None:
                for x in range(p.u - p.d, p.u + 1):
                    if p.at(x) != (x * s.f + s.a) >> s.s:
                        incorrect_x = x
                        break
        else:
            # check all x values
            for x in range(p.u + 1):
                if p.at(x) != (x * s.f + s.a) >> s.s:
                    incorrect_x = x
                    break

        correct = incorrect_x is None
        if incorrect_x is not None:
            expected = p.at(incorrect_x)
            actual = (incorrect_x * s.f + s.a) >> s.s
            print(
                f" ❌ INCORRECT: Expected {expected} but got {actual} for x={incorrect_x}"
            )

    if log:
        if not correct:
            print(f" ❌ {s}")
        else:
            print(f" ✅ {s}")
    return correct


def is_minimal(p: Problem, s: Solution | SolutionRange) -> bool:
    """
    If a solution with a smaller s exists, return False.
    """

    if s.s == 0:
        return True

    X = get_input_set(p)

    if algorithm_1a(p, s.f + 1, s.s, X=X) is not None:
        return False
    if s.f > 0:
        if algorithm_1a(p, s.f - 1, s.s, X=X) is not None:
            return False

    return True


def solve(p: Problem) -> None:
    print(f"Solving {p}")
    print()
    print("    Minimal solution range:")
    minimal = find_minimal(p, log=False)
    verify(p, minimal)

    print()
    zero = find_a_zero(p)
    if zero is None:
        print("    No solutions with a=0 exist")
    else:
        print("    Smallest solution with a=0:")
        verify(p, zero)
    print()
