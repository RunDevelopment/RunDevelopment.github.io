---
datePublished: 2024-06-08
dateModified: 2024-08-08
description: A list of all features supported by articles on this website.
draft: true
inlineCodeLanguage: rust
tags: internal
---

# Features of all articles

This document shows and tests all features of the articles.

## Contents

## Frontmatter

Articles have YAML frontmatter to specify metadata. The following fields are supported:

```yaml
---
# required

# The date the article was published.
datePublished: YYYY-MM-DD
# A single sentence describing the article.
description: string

# optional

# The date the article was last modified. Defaults to the published date.
dateModified: YYYY-MM-DD | null = null
# Whether the article is a draft. Defaults to false.
draft: bool = false
# The language of inline code, e.g. "rust" or "c". Defaults to null.
inlineCodeLanguage: string | null = null
# The URL slug of the article. Generated from the title by default.
slug: string | null = null
# A space-separated list of tags. E.g. "rust math".
tags: string = ""
---
```

## Draft

```yaml
---
draft: true
---
```

When an article is marked as draft, it will not be deployed to the website. Draft-mode also enables TODOs, which are highlighted in the text.

TODO: Show how TODOs work

## Markdown

Text can be **bold**, _italic_, or **_both_**. It can also be ~~strikethrough~~. Links can be either [external](https://en.wikipedia.org/wiki/Extended_Euclidean_algorithm) or [internal](/) and are marked accordingly. [Links for `inline code`](https://en.wikipedia.org/wiki/Extended_Euclidean_algorithm) also work.

Heading 1-4 are supported and automatically get links. Header links also work for:

### Headers with `code` and _style_

### Headers with $ma\ne t(h)$

### Lists

Lists just work as expected:

-   One
-   Two
-   Three

1. One
2. Two
3. Three

Continued lists also work:

4. Four
5. Five
6. Six

### Code

Inline `code` and code blocks work as expected:

```rust
fn main() {
    println!("Hello, world!");
}
```

Note that `long inline code blocks won't cause problems on small displays`.

#### Inline code language

The language of inline code can be declared in the front matter of the article:

```yaml
---
inlineCodeLanguage: rust
---
```

### Quotes

Quotes can be added like this:

> This is a single-line quote.

> This is a quote with a source.
>
> There's not much to it.

Use the following to automatically have the source attached:

```md
<blockquote data-src="https://doc.rust-lang.org/std/primitive.f32.html#method.max">

    pub fn max(self, other: f32) -> f32

Returns the maximum of the two numbers, ignoring NaN.

If one of the arguments is NaN, then the other argument is returned. This follows the IEEE 754-2008 semantics for maxNum, except for handling of signaling NaNs; this function handles all NaNs the same way and avoids maxNum’s problems with associativity. This also matches the behavior of libm’s fmax.

</blockquote>
```

<blockquote data-src="https://doc.rust-lang.org/std/primitive.f32.html#method.max">

```rust
pub fn max(self, other: f32) -> f32
```

Returns the maximum of the two numbers, ignoring NaN.

If one of the arguments is NaN, then the other argument is returned. This follows the IEEE 754-2008 semantics for maxNum, except for handling of signaling NaNs; this function handles all NaNs the same way and avoids maxNum’s problems with associativity. This also matches the behavior of libm’s fmax.

</blockquote>

### Math

Math is rendered using [KaTeX](https://katex.org/docs/supported.html) can supports inline math: $round(x) = \lfloor x + {1 \over 2} \rfloor$ and math blocks:

$$
\begin{aligned}
    \text{gcd}(a, b) &= \text{gcd}(b, a \mod b) \\
    \text{gcd}(a, 0) &= a
\end{aligned}
$$

Note that long math blocks won't cause problems on small displays.

$$
foo(x + y)
= \sum_{i=0}^{n} \binom{n}{i} x^i y^{n-i}
< 1
\le 4
= round(x \cdot y)
= \lfloor x \cdot y + {1 \over 2} \rfloor
\le x \cdot y + {1 \over 2} + \text{some long variable name}
$$

## Notes

Notes and side notes can be added like this:

```md
<div class="info">

<details>
<summary>
For those unfamiliar with Rust:
</summary>

Rust explainer. Hehe.

</details>

</div>
```

<div class="info">

<details>
<summary>
For those unfamiliar with Rust:
</summary>

Rust explainer. Hehe.

</details>

</div>

And

```md
<div class="side-note">

This is a side note.

</div>
```

<div class="side-note">

This is a side note.

```
With code!
```

</div>

## Custom components

Custom UI elements can be inserted using a JSON block with the `json:custom` language. The JSON block must contain a `component` field with the component ID. The `props` field is optional.

```json
{
    "component": "component-id",
    "props": {
        "name": "World"
    }
}
```
