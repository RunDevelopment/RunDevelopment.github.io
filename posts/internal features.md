---
datePublished: 2024-06-08
dateModified: 2024-08-08
title: Features of all articles
description: A list of all features supported by articles on this website.
draft: true
inlineCodeLanguage: rust
tags: internal
---

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
# The cover image of the article. E.g. "./images/cover.jpg".
image: string | null = null
# The small image shows as the article's thumbnail. E.g. "./images/cover_small.jpg".
imageSmall: string | null = null
# The cover color of the article. E.g. "#f0f0f0". If no color is given, a random color will be generated.
color: string | null = null
---
```

Additional notes:

- `description` will be used both for post cards and for the meta description.
- `datePublished` and `dateModified` must be in the format `YYYY-MM-DD`.
- `image`/`imageSmall` must be either a file path relative to the article's `.md` file or a URL.
- `color` must be a valid CSS color and should ideally go together with `image`.

Also, when an article is marked as draft, it will not be deployed to the website. Draft-mode also enables TODOs, which are highlighted in the text.

TODO: Show how TODOs work

## Markdown

Text can be **bold**, _italic_, or **_both_**. It can also be ~~strikethrough~~. Links can be either [external](https://en.wikipedia.org/wiki/Extended_Euclidean_algorithm) or [internal](/) and are marked accordingly. [Links for `inline code`](https://en.wikipedia.org/wiki/Extended_Euclidean_algorithm) also work.

Heading 1-4 are supported and automatically get links. Header links also work for:

### H3

#### H4

### Headers with `code` and _style_

### Headers with $ma\ne t(h)$

### Lists

Lists just work as expected:

- One
- Two
- Three

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

Lines inside code blocks shouldn't be too long to avoid horizontal scrolling. Here's how much space there is:

```
                                                        60 |
                                                                            80 |
                                                                                               100 |
                                                                                                                   120 |
```

**80 characters is recommended**. There isn't quite enough space for 120 characters, so try to keep it 100 or shorter.

#### Inline code language

The language of inline code can be declared in the front matter of the article:

```yaml
---
inlineCodeLanguage: rust
---
```

#### Code block meta

You can specify additional meta information after the code language.

`rust @rust-playground` will add a "Run" button that opens the code in the Rust Playground.

````md @render
```rust @rust-playground
assert_eq!(2 + 2, 4);
```
````

`@render` will render the code block as Markdown (if the code language is markdown). This is useful for showing Markdown examples and is used in this document.

````md @render
```md @render
Hello!
```
````

### Tables

| Tables   | are   | cool |
| -------- | ----- | ---- |
| They     | can   | have |
| multiple | lines | too  |

Very large tables will be horizontally scrollable on small displays:

| Header 1 | Header 2 | Header 3 | Header 4 | Header 5 | Header 6 | Header 7 | Header 8 | Header 9 | Header 10 | Header 11 | Header 12 |
| -------- | -------- | -------- | -------- | -------- | -------- | -------- | -------- | -------- | --------- | --------- | --------- |
| Data 1   | Data 2   | Data 3   | Data 4   | Data 5   | Data 6   | Data 7   | Data 8   | Data 9   | Data 10   | Data 11   | Data 12   |
| Data 1   | Data 2   | Data 3   | Data 4   | Data 5   | Data 6   | Data 7   | Data 8   | Data 9   | Data 10   | Data 11   | Data 12   |
| Data 1   | Data 2   | Data 3   | Data 4   | Data 5   | Data 6   | Data 7   | Data 8   | Data 9   | Data 10   | Data 11   | Data 12   |

### Images

![](https://i.kym-cdn.com/photos/images/newsfeed/001/401/347/312.jpg)

Images can be either relative paths to a file or URLs.

```md
![](https://i.kym-cdn.com/photos/images/newsfeed/001/401/347/312.jpg)

![](./images/foo.png)
```

Relative paths are resolved from the article's `.md` file. This means that you can use regular Markdown editors to preview images.

#### `@max-width`

A maximum width can be set using `@max-width:100px` at the end of the image's text. E.g.

```md @render
![@max-width:100px](https://i.kym-cdn.com/photos/images/newsfeed/001/401/347/312.jpg)

![@max-width:200px](https://i.kym-cdn.com/photos/images/newsfeed/001/401/347/312.jpg)

![I have text @max-width:300px](https://i.kym-cdn.com/photos/images/newsfeed/001/401/347/312.jpg)
```

#### `@narrow`

To set the maximum width to the text width, use `@narrow`:

```md @render
![@narrow](https://upload.wikimedia.org/wikipedia/commons/7/73/Lion_waiting_in_Namibia.jpg)
```

### Quotes

Quotes can be added like this:

```md @render
> This is a single-line quote.

> This is a quote with a source.
>
> There's not much to it.
```

Use the following to automatically have the source attached:

````md @render
<blockquote data-src="https://doc.rust-lang.org/std/primitive.f32.html#method.max">

```rust
pub fn max(self, other: f32) -> f32
```

Returns the maximum of the two numbers, ignoring NaN.

If one of the arguments is NaN, then the other argument is returned. This follows the IEEE 754-2008 semantics for maxNum, except for handling of signaling NaNs; this function handles all NaNs the same way and avoids maxNum’s problems with associativity. This also matches the behavior of libm’s fmax.

</blockquote>
````

### Math

Math is rendered using [KaTeX](https://katex.org/docs/supported.html) can supports inline math: $round(x) = \lfloor x + {1 \over 2} \rfloor$ and math blocks:

$$
\begin{aligned}
    \text{gcd}(a, b) &= \text{gcd}(b, a \bmod b) \\
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

And invalid math gets displayed as is.

$$
a + b - \whatAmI
$$

## Details

Details work as expected:

```md @render
<details>
<summary>
This is a summary
</summary>

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean convallis egestas felis. Ut rutrum, ex eu maximus pharetra, nulla est gravida elit, at consequat quam dui nec dui. Sed ipsum nulla, commodo ac varius id, vestibulum non arcu. Donec feugiat ut lectus sit amet cursus. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Suspendisse facilisis interdum ultrices.

    Can contain code blocks.

</details>
```

## Notes

Notes can be added like this:

```md @render
<div class="info">

<details>
<summary>
For those unfamiliar with Rust:
</summary>

Rust explainer. Hehe.

</details>

</div>
```

Notes can also have a title:

```md @render
<div class="info" data-title="Side note">

This is a side note.

    With code!

</div>
```

## Custom components

Custom UI elements can be inserted using a JSON block with the `json:custom` language. The JSON block must contain a `component` field with the component ID. The `props` field is optional.

````md @render
```json:custom
{
    "component": "component-id",
    "props": {
        "name": "World"
    }
}
```
````
