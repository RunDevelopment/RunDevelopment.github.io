---
datePublished: 2024-06-08
dateModified: 2024-08-08
title: Features of all articles
description: A list of all features supported by articles on this website.
draft: true
inlineCodeLanguage: plain
tags: internal
---

This document shows and tests all features of the articles.

## Contents

## Frontmatter

Articles have YAML frontmatter to specify metadata. The following fields are supported:

```yaml
---
# required

# Title of the article
title: string
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
# The cover color of the article. E.g. "#f0f0f0". If no color is given, a random color will be generated.
color: string | null = null
# The cover image of the article. E.g. "./images/cover.jpg".
image: string | null = null
# The color the image will fade out to. E.g. "#000". If `image` is specified, this should also be specified
imageFadeColor: string | null = null
---
```

Additional notes:

- `description` will be used both for post cards and for the meta description.
- `datePublished` and `dateModified` must be in the format `YYYY-MM-DD`.
- `image` must be either a file path relative to the article's `.md` file or a URL.
- `color` and `imageFadeColor` must be a valid CSS color and should ideally go together with `image`.

Also, when an article is marked as draft, it will not be deployed to the website. Draft-mode also enables TODOs, which are highlighted in the text.

TODO: Show how TODOs work

## Markdown

Text can be **bold**, _italic_, or **_both_**. It can also be ~~strikethrough~~. Links can be either [external](https://en.wikipedia.org/wiki/Extended_Euclidean_algorithm) or [internal](/) and are marked accordingly. [Links for `inline code`](https://en.wikipedia.org/wiki/Extended_Euclidean_algorithm) also work.

Heading 1-5 are supported and automatically get links. Header links also work for:

### H3

#### H4

##### H5

###### H6

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

#### Inline code

The default language for inline code can be set using `inlineCodeLanguage` in front matter:

```yaml
---
inlineCodeLanguage: rust
---
```

Inline code can then be declared as follows:

```md @render
`1 + 1 == 2 as u8` I am Rust code, because I use the default language.

<code class="language-c">(uint8_t) 4</code> I am C code, because I set my own language.

<code class="language-plain">(uint8_t) 4</code> I am plain text.
```

---

CSS color are automatically detected and displayed: `#f00`, `hsl(120deg 80% 70%)`, `oklch(70% 80% 120deg)`, `rgba(128, 16, 255, 60%)`, `rgb(128 16 255 / 60%)`, `rgb(255 255 255 / 25%)`, `rgb(0 0 0 / 25%)`.

Note: `long inline code blocks won't cause problems on small displays`.

#### Code blocks

**80 characters is recommended** to avoid horizontal scrolling. Only mobile, only 60 characters will be visible on screen.

```
                                    40 |
                                                        60 |
                                                                            80 |
                                                                                               100 |
                                                                                                                   120 |
```

You can specify additional meta information after the code language.

##### `@wide`

`@wide=true | false | auto` controls whether the code block is wide or not. Defaults to `true`.

````md @render
```rust @wide
// short but wide
pub fn main() {}
```

```rust @wide=false
// long but narrow
pub fn foo<T: Copy + Send + 'static>(first_param: impl Into<Cow<T>>, second_param: &mut [T; SOME_CONST]) {}
```
````

##### `@run`

`rust @run` will add a "Run" button that opens the code in the Rust Playground.

````md @render
```rust @run
assert_eq!(2 + 2, 4);
```

```rust @run
assert_eq!(2 + 2, 4, "A long assert message to test whether the button covers code");
```
````

##### `@render`

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

```md @render
| Default align       | Left           |     Center     |          Right |
| ------------------- | :------------- | :------------: | -------------: |
| short               | short          |     short      |          short |
| very very very long | very very long | very very long | very very long |
```

### Images

Images can be either relative paths to a file, a static file in `public/`, or URLs.

```md @render
![](test-image.png)

![](/grayscale-images/cat1.webp)

![](https://i.kym-cdn.com/photos/images/newsfeed/001/401/347/312.jpg)
```

Relative paths are resolved from the article's `.md` file. This means that you can use regular Markdown editors to preview images.

#### `@wide` and `@narrow`

By default, images are at most one page width wide. Use `@wide` or `@narrow` to make the image wider or narrower.

```md @render
![Saturn at Night @wide](https://apod.nasa.gov/apod/image/2605/LastRingPortrait_Cassini_4472.jpg)

![Saturn at Night](https://apod.nasa.gov/apod/image/2605/LastRingPortrait_Cassini_4472.jpg)

![Saturn at Night @narrow](https://apod.nasa.gov/apod/image/2605/LastRingPortrait_Cassini_4472.jpg)
```

#### `@max-width`

A custom max width can be set with `@max-width=<css>`. \
(Note: `@narrow` is equivalent to `@max-width=480px`)

```md @render
![@max-width=100px](https://i.kym-cdn.com/photos/images/newsfeed/001/401/347/312.jpg)

![@max-width=200px](https://i.kym-cdn.com/photos/images/newsfeed/001/401/347/312.jpg)

![@max-width=300px](https://i.kym-cdn.com/photos/images/newsfeed/001/401/347/312.jpg)
```

### Quotes

Quotes can be added like this:

```md @render
> This is a single-line quote.

> This is a quote with multiple lines.
>
> There's not much to it.
```

Use the following to automatically have the source attached:

````md @render
<blockquote data-src="https://doc.rust-lang.org/std/primitive.f32.html#method.max">

```rust
pub const fn max(self, other: f32) -> f32
```

Returns the maximum of the two numbers, ignoring NaN.

If exactly one of the arguments is NaN (quiet or signaling), then the other argument is returned. If both arguments are NaN, the return value is NaN, with the bit pattern picked using the usual [rules for arithmetic operations](https://doc.rust-lang.org/std/primitive.f32.html#nan-bit-patterns). If the inputs compare equal (such as for the case of `+0.0` and `-0.0`), either input may be returned non-deterministically.

The handling of NaNs follows the IEEE 754-2019 semantics for `maximumNumber`, treating all NaNs the same way to ensure the operation is associative. The handling of signed zeros follows the IEEE 754-2008 semantics for `maxNum`.

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

<details>
<summary>
For those unfamiliar with Rust:
</summary>

Rust explainer. Hehe.

</details>

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
```json:component
{
    "type": "ComponentName",
    "props": {
        "name": "World"
    }
}
```
````
